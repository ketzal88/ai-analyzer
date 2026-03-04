import { db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { DecisionEngine, ClientTargets } from "@/lib/decision-engine";
import { EngineConfigService } from "@/lib/engine-config-service";
import { CreativeClassifier } from "@/lib/creative-classifier";
import { resolveObjective, getPrimaryMetric, getPrimaryMetricValue, isConversionObjective, businessTypeToObjective } from "@/lib/objective-utils";
import { AlertEngine } from "@/lib/alert-engine";
import { DailyEntitySnapshot, EntityLevel, EntityRollingMetrics, ConceptRollingMetrics } from "@/types/performance-snapshots";
import { EntityClassification, ClientPercentiles } from "@/types/classifications";
import { Client, Alert } from "@/types";
import {
    ClientSnapshot,
    ClientSnapshotAds,
    EntitySnapshotEntry,
    ConceptSnapshotEntry,
    ClassificationEntry,
    MTDAggregation
} from "@/types/client-snapshot";
import { MetaBrain } from "@/lib/meta-brain";
import { buildDateRanges } from "@/lib/date-utils";

export class ClientSnapshotService {

    /**
     * Main pipeline: read raw data, compute everything in memory, write 2 docs.
     * Firestore reads: 3 (daily_entity_snapshots query + client doc + engine_config)
     * Firestore writes: 2 (client_snapshots + client_snapshots_ads)
     *
     * Worker Brain V2: If USE_METABRAIN_ALERTS env is true, reads alerts from MetaBrain instead of AlertEngine.
     */
    static async computeAndStore(clientId: string, targetDate?: string): Promise<{ main: ClientSnapshot; ads: ClientSnapshotAds }> {
        const useMetaBrain = process.env.USE_METABRAIN_ALERTS === 'true';
        const today = new Date().toISOString().split("T")[0];
        const computationDateStr = targetDate || today;

        // ── 1. Fetch all raw data (3 reads) ────────────────────
        const [snapshotDocs, clientDoc, config] = await Promise.all([
            db.collection("daily_entity_snapshots")
                .where("clientId", "==", clientId)
                .limit(5000)
                .get(),
            db.collection("clients").doc(clientId).get(),
            EngineConfigService.getEngineConfig(clientId)
        ]);

        const allSnapshots = snapshotDocs.docs.map(d => d.data() as DailyEntitySnapshot);
        const clientData = clientDoc.exists ? clientDoc.data() as Client : null;
        const isEcommerce = clientData?.isEcommerce ?? true;

        if (allSnapshots.length === 0) {
            const emptyMain = this.buildEmptySnapshot(clientId, today);
            const emptyAds = this.buildEmptyAdsSnapshot(clientId, today);
            await this.writeSnapshots(clientId, emptyMain, emptyAds);
            return { main: emptyMain, ads: emptyAds };
        }

        // Determine reference date for sliding windows (rolling metrics)
        // If targetDate is provided, we use it. Otherwise, we use the latest available snapshot date.
        const snapshotsSorted = allSnapshots.sort((a, b) => b.date.localeCompare(a.date));
        const latestSnapDate = snapshotsSorted[0].date;
        const refDate = new Date(targetDate || latestSnapDate);

        // Filter snapshots to only include those on or before refDate for historical accuracy
        const snapshots = allSnapshots.filter(s => s.date <= (targetDate || latestSnapDate));
        if (snapshots.length === 0) {
            const emptyMain = this.buildEmptySnapshot(clientId, computationDateStr);
            const emptyAds = this.buildEmptyAdsSnapshot(clientId, computationDateStr);
            await this.writeSnapshots(clientId, emptyMain, emptyAds);
            return { main: emptyMain, ads: emptyAds };
        }

        // ── 2. Group by entity ─────────────────────────────────
        const entityGroups: Record<string, DailyEntitySnapshot[]> = {};
        for (const s of snapshots) {
            const key = `${s.entityId}__${s.level}`;
            if (!entityGroups[key]) entityGroups[key] = [];
            entityGroups[key].push(s);
        }

        // ── 3. Pre-calculate concentration metrics ─────────────
        const adEntitySpends7d: Record<string, number> = {};
        for (const [k, g] of Object.entries(entityGroups)) {
            const [eid, lvl] = k.split("__");
            if (lvl === 'ad') {
                const s7 = PerformanceService.sumPerformance(g.filter(s => PerformanceService.isWithinDays(s.date, 7, refDate)));
                adEntitySpends7d[eid] = s7.spend;
            }
        }
        const sortedAdSpends = Object.values(adEntitySpends7d).sort((a, b) => b - a);
        const totalAdSpend7d = sortedAdSpends.reduce((a, b) => a + b, 0);
        const globalSpendTop1Pct = totalAdSpend7d > 0 ? (sortedAdSpends[0] || 0) / totalAdSpend7d : 0;
        const globalSpendTop3Pct = totalAdSpend7d > 0 ? sortedAdSpends.slice(0, 3).reduce((a, b) => a + b, 0) / totalAdSpend7d : 0;

        // ── 4. Compute rolling metrics for ALL entities ────────
        const entityEntries: EntitySnapshotEntry[] = [];
        const rollingMap = new Map<string, EntityRollingMetrics>();

        for (const [key, group] of Object.entries(entityGroups)) {
            const [entityId, level] = key.split("__") as [string, EntityLevel];

            const rolling = PerformanceService.computeRollingForEntity(
                group, entityId, level, refDate,
                adEntitySpends7d, totalAdSpend7d, globalSpendTop1Pct, globalSpendTop3Pct
            );

            const entry: EntitySnapshotEntry = {
                entityId,
                name: group[0]?.name,
                level,
                parentId: group[0]?.parentId,
                conceptId: group[0]?.meta?.conceptId,
                rolling
            };
            entityEntries.push(entry);

            // Build full EntityRollingMetrics for classification/alert engines
            rollingMap.set(key, {
                clientId,
                entityId,
                level,
                name: group[0]?.name,
                lastUpdate: computationDateStr,
                rolling
            });
        }

        // ── 5. Compute concept rolling metrics ─────────────────
        const conceptResults = PerformanceService.computeConceptRollingMetrics(allSnapshots, refDate);
        const conceptEntries: ConceptSnapshotEntry[] = conceptResults.map(c => ({
            conceptId: c.conceptId,
            rolling: c.rolling
        }));

        // Build ConceptRollingMetrics map for classification engine
        const conceptMetricsMap = new Map<string, ConceptRollingMetrics>();
        for (const c of conceptResults) {
            conceptMetricsMap.set(c.conceptId, {
                clientId,
                conceptId: c.conceptId,
                rolling: c.rolling,
                lastUpdate: computationDateStr
            });
        }

        // ── 6. Compute classifications in memory ───────────────
        const rollingMetrics = Array.from(rollingMap.values());
        const classifications = this.computeClassificationsInMemory(
            clientId, computationDateStr, rollingMetrics, allSnapshots,
            Array.from(conceptMetricsMap.values()), clientData, config
        );

        // ── 6b. Creative classification for ads ─────────────────
        const adEntitiesForClassifier = entityEntries.filter(e => e.level === 'ad');
        const adClassificationsForClassifier = classifications.filter(c => c.level === 'ad');
        const accountEntry = entityEntries.find(e => e.level === 'account');
        const accountSpend7d = accountEntry?.rolling?.spend_7d || totalAdSpend7d || 0;

        if (adEntitiesForClassifier.length > 0) {
            const categoryResults = CreativeClassifier.classifyAll(
                adEntitiesForClassifier,
                adClassificationsForClassifier,
                accountSpend7d,
                clientData?.targetCpa
            );
            // Enrich ad classifications with creative category
            for (const cat of categoryResults) {
                const classif = classifications.find(c => c.entityId === cat.entityId && c.level === 'ad');
                if (classif) {
                    classif.creativeCategory = cat.category;
                    classif.creativeCategoryReasoning = cat.reasoning;
                }
            }
        }

        // ── 7. Compute alerts in memory ────────────────────────
        let alerts: Alert[];

        if (useMetaBrain && clientData) {
            // Worker Brain V2: Use MetaBrain for alert generation
            console.log(`[ClientSnapshot] Using MetaBrain for ${clientId}`);
            alerts = await this.computeAlertsViaMetaBrain(clientId, clientData, targetDate);
        } else {
            // Use unified AlertEngine
            alerts = AlertEngine.evaluate({
                clientId,
                rollingMetrics,
                classifications: classifications as any,
                dailySnapshots: allSnapshots,
                clientData,
                config
            });
        }

        // ── 8. Compute MTD aggregation ─────────────────────────
        const mtd = this.computeMTD(allSnapshots, refDate);

        // ── 9. Find account-level rolling for summary ──────────
        const accountRolling: EntityRollingMetrics["rolling"] = accountEntry?.rolling || this.emptyRolling();

        // ── 10. Split into main + ads ──────────────────────────
        const nonAdEntries = entityEntries.filter(e => e.level !== 'ad');
        const adEntries = entityEntries.filter(e => e.level === 'ad');
        const nonAdClassifications = classifications.filter(c => c.level !== 'ad');
        const adClassifications = classifications.filter(c => c.level === 'ad');

        const mainSnapshot: ClientSnapshot = {
            clientId,
            computedAt: new Date().toISOString(),
            computedDate: computationDateStr,
            entities: {
                account: nonAdEntries.filter(e => e.level === 'account'),
                campaign: nonAdEntries.filter(e => e.level === 'campaign'),
                adset: nonAdEntries.filter(e => e.level === 'adset')
            },
            concepts: conceptEntries,
            classifications: nonAdClassifications,
            alerts,
            accountSummary: {
                rolling: accountRolling,
                mtd
            },
            meta: {
                entityCounts: {
                    account: entityEntries.filter(e => e.level === 'account').length,
                    campaign: entityEntries.filter(e => e.level === 'campaign').length,
                    adset: entityEntries.filter(e => e.level === 'adset').length,
                    ad: adEntries.length
                },
                alertCounts: {
                    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
                    warning: alerts.filter(a => a.severity === 'WARNING').length,
                    info: alerts.filter(a => a.severity === 'INFO').length
                },
                docSizeKB: 0 // Will be computed after serialization
            }
        };

        const adsSnapshot: ClientSnapshotAds = {
            clientId,
            computedDate: computationDateStr,
            ads: adEntries,
            classifications: adClassifications,
            meta: { adCount: adEntries.length, docSizeKB: 0 }
        };

        // Compute doc sizes
        const mainJson = JSON.stringify(mainSnapshot);
        const adsJson = JSON.stringify(adsSnapshot);
        mainSnapshot.meta.docSizeKB = Math.round(mainJson.length / 1024);
        adsSnapshot.meta.docSizeKB = Math.round(adsJson.length / 1024);

        // ── 11. Write 2 docs ───────────────────────────────────
        await this.writeSnapshots(clientId, mainSnapshot, adsSnapshot);

        console.log(`[ClientSnapshot] ${clientId} — Main: ${mainSnapshot.meta.docSizeKB}KB, Ads: ${adsSnapshot.meta.docSizeKB}KB, Entities: ${entityEntries.length}, Alerts: ${alerts.length}`);

        return { main: mainSnapshot, ads: adsSnapshot };
    }

    /**
     * Cleanup old raw snapshots beyond retention period.
     */
    static async cleanupOldSnapshots(clientId: string, retentionDays: number = 35) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffStr = cutoffDate.toISOString().split("T")[0];

        const oldDocs = await db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .where("date", "<", cutoffStr)
            .limit(400)
            .get();

        if (oldDocs.empty) return 0;

        const batch = db.batch();
        for (const doc of oldDocs.docs) {
            batch.delete(doc.ref);
        }
        await batch.commit();

        console.log(`[ClientSnapshot] Cleaned up ${oldDocs.size} old snapshots for ${clientId} (before ${cutoffStr})`);
        return oldDocs.size;
    }

    // ─── PRIVATE: Classification computation ─────────────────

    private static computeClassificationsInMemory(
        clientId: string,
        date: string,
        rollingMetrics: EntityRollingMetrics[],
        dailySnapshots: DailyEntitySnapshot[],
        conceptMetrics: ConceptRollingMetrics[],
        clientData: Client | null,
        config: any
    ): ClassificationEntry[] {
        const clientTargets: ClientTargets = {
            targetCpa: clientData?.targetCpa,
            targetRoas: clientData?.targetRoas,
            primaryGoal: clientData?.primaryGoal,
            growthMode: clientData?.growthMode,
            fatigueTolerance: clientData?.constraints?.fatigueTolerance,
            scalingSpeed: clientData?.constraints?.scalingSpeed,
            acceptableVolatilityPct: clientData?.constraints?.acceptableVolatilityPct,
        };

        const activeAdsets = rollingMetrics.filter(r => r.level === 'adset' && (r.rolling.spend_7d || 0) > 0);
        const accountRolling = rollingMetrics.find(r => r.level === 'account');
        const conversions7d = accountRolling?.rolling.conversion_velocity_7d ? accountRolling.rolling.conversion_velocity_7d * 7 : 0;

        const activeEntities = rollingMetrics.filter(r => (r.rolling.spend_7d || 0) > 0);
        const percentiles = this.calculatePercentiles(rollingMetrics, config);

        const classifications: ClassificationEntry[] = [];

        // Get latest daily snapshots for today
        const latestDate = dailySnapshots.length > 0 ? dailySnapshots[0].date : date;
        const todaySnapshots = dailySnapshots.filter(s => s.date === latestDate);

        for (const rolling of activeEntities) {
            let snap = todaySnapshots.find(s => s.entityId === rolling.entityId && s.level === rolling.level);

            if (!snap) {
                snap = {
                    clientId,
                    date: latestDate,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    name: rolling.name,
                    performance: { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0 },
                    engagement: {},
                    audience: {},
                    stability: { daysActive: 0, daysSinceLastEdit: 7 },
                    meta: {}
                };
            }

            const entityName = rolling.name || rolling.entityId;
            const entityMeta = snap?.meta || {};
            const objective = entityMeta.objective;

            const resolvedObj = resolveObjective(objective, entityName);
            const isNonConversion = !isConversionObjective(resolvedObj);

            // Structural insight: only count adsets that share same goal (conversion vs non-conversion)
            const peerAdsetsCount = activeAdsets.filter(a => {
                const aName = a.name || "";
                const aMeta = dailySnapshots.find(ds => ds.entityId === a.entityId)?.meta || {};
                const aResolved = resolveObjective(aMeta.objective, aName);
                return !isConversionObjective(aResolved) === isNonConversion;
            }).length;

            const conceptId = snap.meta?.conceptId || rolling.entityId.split(/[|_-]/)[0];
            const concept = conceptId ? conceptMetrics.find(c => c.conceptId === conceptId) : undefined;

            const decision = DecisionEngine.compute(
                snap, rolling, percentiles, config, concept,
                peerAdsetsCount, conversions7d, clientTargets,
                clientData?.currency || "USD"
            );

            classifications.push({
                entityId: rolling.entityId,
                level: rolling.level,
                conceptId: snap.meta?.conceptId,
                learningState: decision.learningState,
                intentScore: decision.intentScore,
                intentStage: decision.intentStage,
                fatigueState: decision.fatigueState,
                structuralState: decision.structuralState,
                finalDecision: decision.finalDecision,
                evidence: decision.evidence,
                confidenceScore: decision.confidenceScore,
                impactScore: decision.impactScore
            });
        }

        return classifications;
    }

    private static calculatePercentiles(rolling: EntityRollingMetrics[], config: any): ClientPercentiles {
        const getPercentile = (values: number[], p: number) => {
            if (values.length === 0) return 0;
            const sorted = [...values].sort((a, b) => a - b);
            const pos = (sorted.length - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
        };

        const businessType = config.businessType || 'ecommerce';
        const defaultObjective = businessTypeToObjective(businessType);

        const cpaInverses = rolling
            .map(r => {
                const m = getPrimaryMetricValue(r.rolling, defaultObjective);
                const cpa = m > 0 ? (r.rolling.spend_7d || 0) / m : 0;
                return cpa > 0 ? 1 / cpa : 0;
            })
            .filter(v => v > 0);

        return {
            fitr: { p10: 0.01, p90: 0.12 },
            convRate: { p10: 0.001, p90: 0.018 },
            cpaInv: {
                p10: getPercentile(cpaInverses, 0.1) || 0.01,
                p90: getPercentile(cpaInverses, 0.9) || 0.2
            },
            ctr: { p10: 0.7, p90: 2.8 }
        };
    }

    // ─── PRIVATE: Alert computation ──────────────────────────

    /**
     * Worker Brain V2: Compute alerts via MetaBrain
     */
    private static async computeAlertsViaMetaBrain(
        clientId: string,
        clientData: Client,
        targetDate?: string
    ): Promise<Alert[]> {
        try {
            // Build date range
            const dateRanges = buildDateRanges();
            const dateRange = targetDate
                ? { start: targetDate, end: targetDate }
                : dateRanges.yesterday;

            // Run MetaBrain analysis
            const metaBrain = new MetaBrain();
            const signals = await metaBrain.analyze(clientId, dateRange, clientData);

            // Convert ChannelAlerts to system Alerts
            const alerts: Alert[] = signals.alerts.map(channelAlert => ({
                clientId,
                type: channelAlert.type,
                severity: channelAlert.severity,
                title: channelAlert.message,
                description: channelAlert.recommendation,
                entityId: channelAlert.data.entityId as string,
                entityName: channelAlert.data.entityName as string,
                level: channelAlert.data.level as any,
                evidence: channelAlert.data.evidence as string[],
                impactScore: channelAlert.data.impactScore as number || 50,
                createdAt: new Date().toISOString(),
                status: 'active'
            }));

            console.log(`[ClientSnapshot] MetaBrain generated ${alerts.length} alerts`);
            return alerts;

        } catch (error) {
            console.error('[ClientSnapshot] MetaBrain error, falling back to AlertEngine:', error);
            return [];
        }
    }

    // Legacy alert computation delegated to AlertEngine.evaluate()
    // See src/lib/alert-engine.ts for the unified alert evaluation logic.

    // ─── PRIVATE: MTD aggregation ────────────────────────────

    private static computeMTD(snapshots: DailyEntitySnapshot[], refDate: Date): MTDAggregation | null {
        const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        const startStr = startOfMonth.toISOString().split("T")[0];
        const endStr = refDate.toISOString().split("T")[0];

        const accountSnaps = snapshots.filter(
            s => s.level === 'account' && s.date >= startStr && s.date <= endStr
        );

        if (accountSnaps.length === 0) return null;

        return accountSnaps.reduce((acc, s) => {
            acc.spend += s.performance.spend || 0;
            acc.clicks += s.performance.clicks || 0;
            acc.impressions += s.performance.impressions || 0;
            acc.purchases += s.performance.purchases || 0;
            acc.revenue += s.performance.revenue || 0;
            acc.leads += s.performance.leads || 0;
            acc.whatsapp += s.performance.whatsapp || 0;
            acc.addToCart += s.performance.addToCart || 0;
            acc.checkout += s.performance.checkout || 0;
            return acc;
        }, { spend: 0, clicks: 0, impressions: 0, purchases: 0, revenue: 0, leads: 0, whatsapp: 0, addToCart: 0, checkout: 0 } as MTDAggregation);
    }

    // ─── PRIVATE: Write helpers ──────────────────────────────

    private static async writeSnapshots(clientId: string, main: ClientSnapshot, ads: ClientSnapshotAds) {
        const batch = db.batch();
        const today = main.computedDate; // YYYY-MM-DD

        // Latest snapshots
        batch.set(db.collection("client_snapshots").doc(clientId), main);
        batch.set(db.collection("client_snapshots_ads").doc(clientId), ads);

        // Historical snapshots (dated)
        batch.set(db.collection("client_snapshots").doc(`${clientId}_${today}`), main);
        batch.set(db.collection("client_snapshots_ads").doc(`${clientId}_${today}`), ads);

        await batch.commit();
    }

    private static buildEmptySnapshot(clientId: string, date: string): ClientSnapshot {
        return {
            clientId, computedAt: new Date().toISOString(), computedDate: date,
            entities: { account: [], campaign: [], adset: [] },
            concepts: [], classifications: [], alerts: [],
            accountSummary: { rolling: this.emptyRolling(), mtd: null },
            meta: {
                entityCounts: { account: 0, campaign: 0, adset: 0, ad: 0 },
                alertCounts: { critical: 0, warning: 0, info: 0 },
                docSizeKB: 0
            }
        };
    }

    private static buildEmptyAdsSnapshot(clientId: string, date: string): ClientSnapshotAds {
        return {
            clientId, computedDate: date,
            ads: [], classifications: [],
            meta: { adCount: 0, docSizeKB: 0 }
        };
    }

    private static emptyRolling(): EntityRollingMetrics["rolling"] {
        return {
            spend_3d: 0, spend_7d: 0, spend_14d: 0, spend_30d: 0,
            impressions_7d: 0, clicks_7d: 0, purchases_7d: 0, leads_7d: 0, whatsapp_7d: 0,
            ctr_7d: 0, cpa_delta_pct: 0,
            conversion_velocity_3d: 0, conversion_velocity_7d: 0, conversion_velocity_14d: 0,
            hook_rate_7d: 0, hook_rate_delta_pct: 0,
            fitr_7d: 0, retention_rate_7d: 0, conversion_per_impression_delta: 0,
            spend_top1_ad_pct: 0, spend_top3_ads_pct: 0, budget_change_3d_pct: 0
        };
    }
}
