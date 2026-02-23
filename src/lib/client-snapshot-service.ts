import { db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { DecisionEngine, ClientTargets } from "@/lib/decision-engine";
import { EngineConfigService } from "@/lib/engine-config-service";
import { CreativeClassifier } from "@/lib/creative-classifier";
import { getDefaultEngineConfig } from "@/types/engine-config";
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

export class ClientSnapshotService {

    /**
     * Main pipeline: read raw data, compute everything in memory, write 2 docs.
     * Firestore reads: 3 (daily_entity_snapshots query + client doc + engine_config)
     * Firestore writes: 2 (client_snapshots + client_snapshots_ads)
     */
    static async computeAndStore(clientId: string, targetDate?: string): Promise<{ main: ClientSnapshot; ads: ClientSnapshotAds }> {
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
        const alerts = this.computeAlertsInMemory(
            clientId, rollingMetrics, classifications, allSnapshots,
            clientData, config, isEcommerce
        );

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
                    date,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    name: rolling.name,
                    performance: { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0 },
                    engagement: {},
                    audience: {},
                    stability: { daysActive: 0, daysSinceLastEdit: 0 },
                    meta: {}
                };
            }

            const conceptId = snap.meta?.conceptId || rolling.entityId.split(/[|_-]/)[0];
            const concept = conceptId ? conceptMetrics.find(c => c.conceptId === conceptId) : undefined;

            const decision = DecisionEngine.compute(
                snap, rolling, percentiles, config, concept,
                activeAdsets.length, conversions7d, clientTargets
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

        const cpaInverses = rolling
            .map(r => {
                let m = 0;
                if (businessType === 'ecommerce') m = r.rolling.purchases_7d || 0;
                else if (businessType === 'leads') m = r.rolling.leads_7d || 0;
                else if (businessType === 'whatsapp') m = r.rolling.whatsapp_7d || 0;
                else if (businessType === 'apps') m = r.rolling.installs_7d || 0;

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

    private static computeAlertsInMemory(
        clientId: string,
        rollingMetrics: EntityRollingMetrics[],
        classifications: ClassificationEntry[],
        dailySnapshots: DailyEntitySnapshot[],
        clientData: Client | null,
        config: any,
        isEcommerce: boolean
    ): Alert[] {
        const alerts: Alert[] = [];

        const nameMap: Record<string, string> = {};
        for (const rm of rollingMetrics) {
            if (rm.name) nameMap[rm.entityId] = rm.name;
        }

        const formatMessage = (template: string, vars: Record<string, string | number>) => {
            let msg = template;
            for (const [k, v] of Object.entries(vars)) {
                msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
            return msg;
        };

        const latestDate = dailySnapshots.length > 0 ? dailySnapshots.sort((a, b) => b.date.localeCompare(a.date))[0].date : '';
        const latestSnaps = dailySnapshots.filter(s => s.date === latestDate);

        for (const rolling of rollingMetrics) {
            const r = rolling.rolling;
            const snap = latestSnaps.find(s => s.entityId === rolling.entityId && s.level === rolling.level);
            const classif = classifications.find(c => c.entityId === rolling.entityId && c.level === rolling.level);

            const entityName = rolling.name || rolling.entityId;
            const contextName = rolling.level === 'ad' && snap?.meta.adsetId && snap?.meta.campaignId
                ? `${nameMap[snap.meta.campaignId] || 'Camp.'} > ${nameMap[snap.meta.adsetId] || 'Set'} > ${entityName}`
                : rolling.level === 'adset' && snap?.meta.campaignId
                    ? `${nameMap[snap.meta.campaignId] || 'Camp.'} > ${entityName}`
                    : entityName;

            const spend_7d = r.spend_7d || 0;
            const businessType = config.businessType || 'ecommerce';
            let primaryMetric = 0;
            let metricName = "Conv.";

            if (businessType === 'ecommerce') {
                primaryMetric = r.purchases_7d || 0;
                metricName = "Ventas";
            } else if (businessType === 'leads') {
                primaryMetric = r.leads_7d || 0;
                metricName = "Leads";
            } else if (businessType === 'whatsapp') {
                primaryMetric = r.whatsapp_7d || 0;
                metricName = "Conversaciones";
            } else if (businessType === 'apps') {
                primaryMetric = r.installs_7d || 0;
                metricName = "App Installs";
            }

            const isEcommerce = businessType === 'ecommerce';
            const primaryCpa = primaryMetric > 0 ? (spend_7d / primaryMetric) : undefined;
            const targetCpa = clientData?.targetCpa;
            const targetRoas = clientData?.targetRoas || 2.0;

            const commonVars = {
                entityName: contextName,
                spend_7d: `$${spend_7d.toFixed(2)}`,
                cpa_7d: primaryCpa ? `$${primaryCpa.toFixed(2)}` : 'N/A',
                targetCpa: targetCpa ? `$${targetCpa.toFixed(2)}` : 'N/A',
                frequency_7d: (r.frequency_7d || 0).toFixed(1),
                budget_change_3d_pct: (r.budget_change_3d_pct || 0).toFixed(0),
                cpa_delta_pct: (r.cpa_delta_pct || 0).toFixed(0)
            };

            const defaultConfig = getDefaultEngineConfig(clientId, businessType);

            // SCALING OPPORTUNITY (respects growthMode)
            const growthMode = clientData?.growthMode || "stable";
            const cpaMeetsTarget = targetCpa ? (primaryCpa || Infinity) <= targetCpa : false;
            const roasMeetsTarget = isEcommerce ? (r.roas_7d || 0) >= targetRoas : true;
            const velocity7d = isEcommerce ? (r.conversion_velocity_7d || 0) : (primaryMetric / 7);
            const velocityStable = velocity7d > 0.5;
            const freqSafe = (r.frequency_7d || 0) < config.alerts.scalingFrequencyMax;
            const daysStable = snap ? snap.stability.daysSinceLastEdit >= 3 : true;

            if ((cpaMeetsTarget || (isEcommerce && roasMeetsTarget)) && velocityStable && freqSafe && daysStable) {
                // Conservative mode: skip SCALING_OPPORTUNITY alerts entirely
                if (growthMode !== "conservative") {
                    const type = "SCALING_OPPORTUNITY";
                    const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                    const evidence = [
                        `${isEcommerce ? 'CPA' : `Coste/${metricName}`} 7d: ${commonVars.cpa_7d}`,
                        isEcommerce ? `ROAS 7d: ${(r.roas_7d || 0).toFixed(2)}x` : `Volumen 7d: ${primaryMetric}`,
                        `Frecuencia: ${commonVars.frequency_7d}`
                    ];
                    if (clientData?.constraints?.stockRisk) evidence.push("⚠️ Stock sensible — validar inventario antes de escalar");
                    alerts.push({
                        id: `SCALING_${rolling.entityId}_${Date.now()}`,
                        clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "INFO",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, commonVars),
                        impactScore: classif?.impactScore || 50,
                        evidence,
                        createdAt: new Date().toISOString()
                    });
                }
            }

            // LEARNING RESET RISK
            const budgetChange = r.budget_change_3d_pct || 0;
            const recentEdit = snap ? snap.stability.daysSinceLastEdit < 3 : false;

            if (Math.abs(budgetChange) > config.alerts.learningResetBudgetChangePct && recentEdit) {
                const type = "LEARNING_RESET_RISK";
                const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                alerts.push({
                    id: `LEARNING_RESET_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "WARNING",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, { ...commonVars, threshold_pct: config.alerts.learningResetBudgetChangePct }),
                    impactScore: Math.min((classif?.impactScore || 50) + 15, 100),
                    evidence: [`Budget Δ 3d: ${budgetChange.toFixed(1)}%`, `Edición hace < 3 días`],
                    createdAt: new Date().toISOString()
                });
            }

            // CPA SPIKE
            const cpaDelta = r.cpa_delta_pct || 0;
            if (cpaDelta > (config.findings.cpaSpikeThreshold * 100)) {
                const type = "CPA_SPIKE";
                const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                alerts.push({
                    id: `CPA_SPIKE_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "CRITICAL",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 80,
                    evidence: [`CPA 7d: ${commonVars.cpa_7d}`, `CPA 14d: $${(r.cpa_14d || 0).toFixed(2)}`, `Delta: ${cpaDelta.toFixed(1)}%`],
                    createdAt: new Date().toISOString()
                });
            }

            // BUDGET BLEED
            if (primaryMetric === 0 && targetCpa && spend_7d > (targetCpa * 2)) {
                const type = "BUDGET_BLEED";
                const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                alerts.push({
                    id: `BLEED_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "CRITICAL",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 90,
                    evidence: [`Gasto 7d: ${commonVars.spend_7d}`, `Conversiones: 0`, `Target CPA: ${commonVars.targetCpa}`],
                    createdAt: new Date().toISOString()
                });
            }

            // CPA VOLATILITY (respects acceptableVolatilityPct)
            const volatilityThreshold = clientData?.constraints?.acceptableVolatilityPct
                ? clientData.constraints.acceptableVolatilityPct
                : config.findings.volatilityThreshold * 100;
            if (Math.abs(budgetChange) > volatilityThreshold) {
                const type = "CPA_VOLATILITY";
                const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                alerts.push({
                    id: `VOLATILITY_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "WARNING",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 40,
                    evidence: [`Δ Budget 3d: ${budgetChange.toFixed(1)}%`, `Threshold: ${volatilityThreshold}%`],
                    createdAt: new Date().toISOString()
                });
            }

            if (classif) {
                // FATIGUE
                if (classif.fatigueState === "REAL" || classif.fatigueState === "CONCEPT_DECAY" || classif.fatigueState === "AUDIENCE_SATURATION") {
                    const type = "ROTATE_CONCEPT";
                    const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                    const fatigueLabels: Record<string, string> = {
                        REAL: "Fatiga Real", CONCEPT_DECAY: "Decaimiento Conceptual",
                        AUDIENCE_SATURATION: "Saturación de Audiencia", HEALTHY_REPETITION: "Repetición Saludable", NONE: "Ninguna"
                    };
                    alerts.push({
                        id: `FATIGUE_${rolling.entityId}_${Date.now()}`,
                        clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "CRITICAL",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, {
                            ...commonVars,
                            fatigueLabel: fatigueLabels[classif.fatigueState] || "Fatiga",
                            hook_rate_7d: `${(r.hook_rate_7d || 0).toFixed(2)}%`
                        }),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                // STRUCTURE
                if (classif.structuralState === "FRAGMENTED" || classif.structuralState === "OVERCONCENTRATED") {
                    const type = "CONSOLIDATE";
                    const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                    alerts.push({
                        id: `STRUCT_${rolling.entityId}_${Date.now()}`,
                        clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "WARNING",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, {
                            ...commonVars,
                            structuralState: classif.structuralState === "FRAGMENTED" ? "Fragmentada" : "Sobreconcentrada"
                        }),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.finalDecision === "KILL_RETRY") {
                    const type = "KILL_RETRY";
                    const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                    alerts.push({
                        id: `KILL_${rolling.entityId}_${Date.now()}`,
                        clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "WARNING",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, commonVars),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.finalDecision === "INTRODUCE_BOFU_VARIANTS") {
                    const type = "INTRODUCE_BOFU_VARIANTS";
                    const template = config.alertTemplates[type] || defaultConfig.alertTemplates[type];
                    alerts.push({
                        id: `UPSELL_${rolling.entityId}_${Date.now()}`,
                        clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "INFO",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, commonVars),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        return alerts;
    }

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
