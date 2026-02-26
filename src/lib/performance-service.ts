import { db } from "@/lib/firebase-admin";
import { reportError } from "@/lib/error-reporter";
import {
    DailyEntitySnapshot,
    EntityLevel,
    EntityRollingMetrics,
    PerformanceMetrics,
    ConceptRollingMetrics,
    MetaInfo
} from "@/types/performance-snapshots";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

export class PerformanceService {
    /**
     * Helper to fetch with simple retry/backoff
     */
    private static async fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                const data = await response.json();

                if (response.ok) return data;

                // Handle specific Meta errors
                const metaError = data.error;
                console.error(`Meta API Error (Attempt ${i + 1}):`, data);

                // Code 200 is a permission issue - NO point in retrying
                if (metaError?.code === 200 || metaError?.message?.includes("permission")) {
                    const cleanMsg = `🛑 ERROR DE PERMISOS META: El token no tiene acceso a esta cuenta (${metaError?.message || 'sin detalle'})`;
                    reportError("Meta API Permissions", new Error(cleanMsg), { metadata: { url, error: data } });
                    throw new Error(cleanMsg);
                }

                if (i === retries - 1) {
                    reportError("Meta API", new Error(JSON.stringify(data)), { metadata: { url, attempt: i + 1 } });
                    throw new Error(JSON.stringify(data));
                }

                if (response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, backoff * 2 * (i + 1)));
                    continue;
                }

                await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
            } catch (error: any) {
                if (i === retries - 1 || error.message?.includes("PERMISOS")) throw error;
                await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
            }
        }
    }

    /**
     * Sync all levels for a specific client and date range
     *
     * Worker Brain V2: Now writes to BOTH structures (dual-write):
     * 1. daily_entity_snapshots (old) - for backward compatibility
     * 2. dashbo_snapshots/{clientId}/{date}/meta (new) - for ChannelBrain pattern
     */
    static async syncAllLevels(clientId: string, metaAdAccountId: string, range: string | { since: string; until: string } = "last_7d") {
        if (!META_ACCESS_TOKEN) throw new Error("Meta API Token not configured");

        const cleanAdAccountId = metaAdAccountId.startsWith("act_") ? metaAdAccountId : `act_${metaAdAccountId}`;
        const levels: EntityLevel[] = ["account", "campaign", "adset", "ad"];

        const results = {
            account: 0,
            campaign: 0,
            adset: 0,
            ad: 0
        };

        // Worker Brain V2: Accumulate snapshots for new structure
        const snapshotsByDate: Record<string, {
            account: DailyEntitySnapshot[],
            campaign: DailyEntitySnapshot[],
            adset: DailyEntitySnapshot[],
            ad: DailyEntitySnapshot[]
        }> = {};

        const rangeParam = typeof range === 'string'
            ? `date_preset=${range}`
            : `time_range=${encodeURIComponent(JSON.stringify(range))}`;

        for (const level of levels) {
            const fields = [
                "account_id",
                "campaign_id",
                "adset_id",
                "ad_id",
                "ad_name",
                "adset_name",
                "campaign_name",
                "account_name",
                "spend",
                "impressions",
                "reach",
                "clicks",
                "actions",
                "action_values",
                "frequency",
                "ctr",
                "cpc",
                "video_play_actions",
                "video_p25_watched_actions",
                "video_p50_watched_actions",
                "video_p75_watched_actions",
                "video_p100_watched_actions"
            ].join(",");

            // 1. Filter: Spend > 0 to reduce payload and processing
            const filtering = encodeURIComponent(JSON.stringify([
                { field: "spend", operator: "GREATER_THAN", value: 0 }
            ]));

            let nextUrl = `https://graph.facebook.com/${META_API_VERSION}/${cleanAdAccountId}/insights?level=${level}&time_increment=1&${rangeParam}&fields=${fields}&filtering=${filtering}&limit=500&access_token=${META_ACCESS_TOKEN}`;
            let pageCount = 0;
            let totalLevelCount = 0;

            console.log(`[Sync] Fetching ${level} data for ${clientId} (${typeof range === 'string' ? range : `${range.since} to ${range.until}`})...`);

            while (nextUrl && pageCount < 20) {
                pageCount++;
                const data = await this.fetchWithRetry(nextUrl);
                const rawInsights = data.data || [];

                if (rawInsights.length === 0) break;

                const batch = db.batch();
                let batchCount = 0;

                for (const item of rawInsights) {
                    const date = item.date_start;
                    const entityId = this.getEntityId(level, item);
                    const sanitizedEntityId = entityId.replace(/\//g, '_');
                    // Optimization: Shorter doc ID
                    const docId = `${clientId}__${date}__${level}__${sanitizedEntityId}`;

                    const performance = this.mapPerformanceMetrics(item);

                    // Safety check: Skip if somehow spend is 0 (though API filter should catch it)
                    if (performance.spend === 0 && performance.impressions === 0) continue;

                    const meta = this.extractMetaInfo(level, item);
                    const name = item.ad_name || item.adset_name || item.campaign_name || item.account_name || "";

                    const getActionValueFromList = (list: any[], type: string) => Number(list?.find((a: any) => a.action_type === type)?.value || 0);

                    const hookViews = getActionValueFromList(item.video_p25_watched_actions, 'video_view');
                    const videoPlayCount = getActionValueFromList(item.video_play_actions, 'video_view');
                    const videoP50Count = getActionValueFromList(item.video_p50_watched_actions, 'video_view');
                    const videoP75Count = getActionValueFromList(item.video_p75_watched_actions, 'video_view');
                    const videoP100Count = getActionValueFromList(item.video_p100_watched_actions, 'video_view');

                    const snapshot: DailyEntitySnapshot = {
                        clientId,
                        date,
                        level,
                        entityId,
                        parentId: this.getParentId(level, item),
                        meta,
                        name,
                        performance,
                        engagement: {
                            hookViews,
                            videoPlayCount,
                            videoP50Count,
                            videoP75Count,
                            videoP100Count,
                            hookRate: performance.impressions > 0 ? (hookViews / performance.impressions) * 100 : 0
                        },
                        audience: {},
                        stability: {
                            daysActive: 1,
                            daysSinceLastEdit: 0
                        }
                    };

                    // Write to old structure (backward compatibility)
                    const docRef = db.collection("daily_entity_snapshots").doc(docId);
                    batch.set(docRef, snapshot, { merge: true });

                    // Worker Brain V2: Accumulate for new structure
                    if (!snapshotsByDate[date]) {
                        snapshotsByDate[date] = { account: [], campaign: [], adset: [], ad: [] };
                    }
                    snapshotsByDate[date][level].push(snapshot);

                    results[level]++;
                    totalLevelCount++;
                    batchCount++;
                }

                if (batchCount > 0) {
                    await batch.commit();
                }

                nextUrl = data.paging?.next || null;
            }
            console.log(`[Sync] ${level} complete. Saved ${totalLevelCount} docs.`);
        }

        // Worker Brain V2: Write to new dashbo_snapshots structure
        await this.writeToDashboSnapshots(clientId, snapshotsByDate);

        return results;
    }

    /**
     * Worker Brain V2: Write snapshots to dashbo_snapshots structure
     *
     * Structure: dashbo_snapshots/{clientId}/{date}/meta
     * Contains: { account: [...], campaign: [...], adset: [...], ad: [...] }
     */
    private static async writeToDashboSnapshots(
        clientId: string,
        snapshotsByDate: Record<string, {
            account: DailyEntitySnapshot[],
            campaign: DailyEntitySnapshot[],
            adset: DailyEntitySnapshot[],
            ad: DailyEntitySnapshot[]
        }>
    ) {
        const dates = Object.keys(snapshotsByDate);
        if (dates.length === 0) {
            console.log('[Sync] No data to write to dashbo_snapshots (empty snapshotsByDate)');
            return;
        }

        console.log(`[Sync] Writing to dashbo_snapshots for ${dates.length} dates...`);

        for (const date of dates) {
            const snapshots = snapshotsByDate[date];
            const docRef = db.doc(`dashbo_snapshots/${clientId}/${date}/meta`);

            await docRef.set({
                account: snapshots.account,
                campaign: snapshots.campaign,
                adset: snapshots.adset,
                ad: snapshots.ad,
                updatedAt: new Date().toISOString(),
                syncedBy: 'PerformanceService.syncAllLevels',
                sourceCollection: 'daily_entity_snapshots'
            });

            const totalSnapshots =
                snapshots.account.length +
                snapshots.campaign.length +
                snapshots.adset.length +
                snapshots.ad.length;

            console.log(`[Sync] ✅ dashbo_snapshots/${clientId}/${date}/meta (${totalSnapshots} snapshots)`);
        }

        console.log(`[Sync] ✅ Dual-write complete: ${dates.length} dates synced to dashbo_snapshots`);
    }

    private static getEntityId(level: EntityLevel, item: any): string {
        switch (level) {
            case "account": return item.account_id;
            case "campaign": return item.campaign_id;
            case "adset": return item.adset_id;
            case "ad": return item.ad_id;
        }
    }

    private static getParentId(level: EntityLevel, item: any): string | undefined {
        switch (level) {
            case "campaign": return item.account_id;
            case "adset": return item.campaign_id;
            case "ad": return item.adset_id;
            default: return undefined;
        }
    }

    private static mapPerformanceMetrics(item: any): PerformanceMetrics {
        const getAction = (type: string) => Number(item.actions?.find((a: any) => a.action_type === type)?.value || 0);
        const getActionValue = (type: string) => Number(item.action_values?.find((a: any) => a.action_type === type)?.value || 0);

        const spend = Number(item.spend || 0);
        const clicks = Number(item.clicks || 0);
        const impressions = Number(item.impressions || 0);
        const purchases = getAction("purchase") || getAction("offsite_conversion.fb_pixel_purchase");
        const revenue = getActionValue("purchase") || getActionValue("offsite_conversion.fb_pixel_purchase");

        return {
            spend,
            impressions,
            reach: Number(item.reach || 0),
            clicks,
            ctr: item.ctr ? Number(item.ctr) : (impressions > 0 ? (clicks / impressions) * 100 : 0),
            cpc: item.cpc ? Number(item.cpc) : (clicks > 0 ? spend / clicks : 0),
            purchases,
            leads: getAction("lead"),
            whatsapp: getAction("onsite_conversion.messaging_conversation_started_7d"),
            revenue,
            roas: spend > 0 ? revenue / spend : 0,
            addToCart: getAction("add_to_cart"),
            checkout: getAction("initiate_checkout")
        };
    }

    private static extractMetaInfo(level: EntityLevel, item: any): MetaInfo {
        const meta: MetaInfo = {
            campaignId: item.campaign_id,
            adsetId: item.adset_id,
        };

        const name = item.ad_name || item.adset_name || item.campaign_name || "";

        // Pattern: [CONCEPT_ID] Persona | Proof | Format
        const conceptMatch = name.match(/\[(.*?)\]/);
        if (conceptMatch) {
            meta.conceptId = conceptMatch[1];
        } else {
            // Fallback: take first part before space or pipe
            const firstPart = name.split(/[|_-]/)[0]?.trim();
            if (firstPart && firstPart.length < 20) meta.conceptId = firstPart;
        }

        const parts = name.split(/[|]/).map((p: string) => p.trim());
        if (parts.length > 1) {
            meta.personaType = parts[0];
            meta.formatType = parts[1];
            if (parts.length > 2) meta.proofType = parts[2];
        }

        return meta;
    }

    /**
     * Recalculate rolling metrics for all entities
     */
    static async updateRollingMetrics(clientId: string) {
        const today = new Date().toISOString().split("T")[0];

        // 1. Get last 30 days of snapshots
        const snapshotsRef = db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .limit(5000);

        const snapshotDocs = await snapshotsRef.get();
        const allSnapshots = snapshotDocs.docs.map(d => d.data() as DailyEntitySnapshot);
        if (allSnapshots.length === 0) return;

        // Sort in memory and determine latest date for relative calculations
        const snapshots = allSnapshots.sort((a, b) => b.date.localeCompare(a.date));
        const refDateStr = snapshots[0].date;
        const refDate = new Date(refDateStr);

        // Group by entity
        const entityGroups: Record<string, DailyEntitySnapshot[]> = {};
        for (const s of snapshots) {
            const key = `${s.entityId}__${s.level}`;
            if (!entityGroups[key]) entityGroups[key] = [];
            entityGroups[key].push(s);
        }

        let batch = db.batch();

        // Pre-calculate concentration metrics (spend per ad entity in last 7d relative to refDate)
        const adEntitySpends7d: Record<string, number> = {};
        for (const [k, g] of Object.entries(entityGroups)) {
            const [eid, lvl] = k.split("__");
            if (lvl === 'ad') {
                const s7 = this.sumPerformance(g.filter(s => this.isWithinDays(s.date, 7, refDate)));
                adEntitySpends7d[eid] = s7.spend;
            }
        }
        const sortedAdSpends = Object.values(adEntitySpends7d).sort((a, b) => b - a);
        const totalAdSpend7d = sortedAdSpends.reduce((a, b) => a + b, 0);
        const globalSpendTop1Pct = totalAdSpend7d > 0 ? (sortedAdSpends[0] || 0) / totalAdSpend7d : 0;
        const globalSpendTop3Pct = totalAdSpend7d > 0 ? sortedAdSpends.slice(0, 3).reduce((a, b) => a + b, 0) / totalAdSpend7d : 0;

        let opCount = 0;

        for (const [key, group] of Object.entries(entityGroups)) {
            const [entityId, level] = key.split("__") as [string, EntityLevel];

            const r3d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 3, refDate)));
            const r7d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 7, refDate)));
            const r14d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 14, refDate)));
            const r30d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 30, refDate)));

            // Comparison windows for deltas
            const prev7d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 14, refDate) && !this.isWithinDays(s.date, 7, refDate)));

            // CPA delta
            const cpa7d = r7d.purchases > 0 ? r7d.spend / r7d.purchases : 0;
            const cpa14d = r14d.purchases > 0 ? r14d.spend / r14d.purchases : 0;
            const cpaDeltaPct = this.calcDelta(cpa7d, cpa14d);

            // Conversion per impression delta
            const convPerImp7d = r7d.impressions > 0 ? r7d.purchases / r7d.impressions : 0;
            const convPerImpPrev = prev7d.impressions > 0 ? prev7d.purchases / prev7d.impressions : 0;
            const convPerImpDelta = this.calcDelta(convPerImp7d, convPerImpPrev);

            // Budget change (compare last 3d spend vs previous 3d spend)
            const prev3d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 6, refDate) && !this.isWithinDays(s.date, 3, refDate)));
            const budgetChange3dPct = this.calcDelta(r3d.spend, prev3d.spend);

            // Concentration at entity level (for account/campaign parents)
            let spendTop1Pct = globalSpendTop1Pct;
            const spendTop3Pct = globalSpendTop3Pct;
            if (level === 'ad') {
                spendTop1Pct = totalAdSpend7d > 0 ? (adEntitySpends7d[entityId] || 0) / totalAdSpend7d : 0;
            }

            const rollingMetrics: EntityRollingMetrics = {
                clientId,
                entityId,
                level,
                name: group[0]?.name,
                lastUpdate: today,
                rolling: {
                    spend_3d: r3d.spend,
                    spend_7d: r7d.spend,
                    spend_14d: r14d.spend,
                    spend_30d: r30d.spend,

                    impressions_7d: r7d.impressions,
                    clicks_7d: r7d.clicks,
                    purchases_7d: r7d.purchases,
                    leads_7d: r7d.leads,
                    whatsapp_7d: r7d.whatsapp,
                    ctr_7d: r7d.impressions > 0 ? (r7d.clicks / r7d.impressions) * 100 : 0,

                    cpa_3d: r3d.purchases > 0 ? r3d.spend / r3d.purchases : undefined,
                    cpa_7d: r7d.purchases > 0 ? r7d.spend / r7d.purchases : undefined,
                    cpa_14d: r14d.purchases > 0 ? r14d.spend / r14d.purchases : undefined,
                    cpa_delta_pct: cpaDeltaPct,

                    roas_7d: r7d.spend > 0 ? r7d.revenue / r7d.spend : undefined,
                    roas_delta_pct: this.calcDelta(
                        r7d.spend > 0 ? r7d.revenue / r7d.spend : 0,
                        prev7d.spend > 0 ? prev7d.revenue / prev7d.spend : 0
                    ),

                    conversion_velocity_3d: r3d.purchases / 3,
                    conversion_velocity_7d: r7d.purchases / 7,
                    conversion_velocity_14d: r14d.purchases / 14,

                    frequency_7d: r7d.impressions > 0 ? r7d.impressions / (r7d.reach || 1) : undefined,
                    ctr_delta_pct: this.calcDelta(
                        r7d.impressions > 0 ? (r7d.clicks / r7d.impressions) * 100 : 0,
                        prev7d.impressions > 0 ? (prev7d.clicks / prev7d.impressions) * 100 : 0
                    ),
                    hook_rate_7d: r7d.impressions > 0 ? (r7d.hookViews / r7d.impressions) * 100 : 0,
                    hook_rate_delta_pct: this.calcDelta(
                        r7d.impressions > 0 ? (r7d.hookViews / r7d.impressions) * 100 : 0,
                        prev7d.impressions > 0 ? (prev7d.hookViews / prev7d.impressions) * 100 : 0
                    ),
                    fitr_7d: r7d.clicks > 0 ? (r7d.purchases / r7d.clicks) * 100 : 0,
                    retention_rate_7d: r7d.videoPlayCount > 0 ? (r7d.videoP50Count / r7d.videoPlayCount) * 100 : 0,
                    conversion_per_impression_delta: convPerImpDelta,

                    spend_top1_ad_pct: spendTop1Pct,
                    spend_top3_ads_pct: spendTop3Pct,
                    budget_change_3d_pct: budgetChange3dPct
                }
            };

            const docId = `${clientId}__${entityId.replace(/\//g, '_')}__${level}`;
            const docRef = db.collection("entity_rolling_metrics").doc(docId);
            batch.set(docRef, rollingMetrics, { merge: true });
            opCount++;

            if (opCount >= 400) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        if (opCount > 0) {
            await batch.commit();
        }

        // Trigger concept metrics update
        await this.updateConceptMetrics(clientId, snapshots, refDate);
    }


    /**
     * Recalculate concept-level rolling metrics
     */
    static async updateConceptMetrics(clientId: string, snapshots: DailyEntitySnapshot[], refDate: Date = new Date()) {
        const today = new Date().toISOString().split("T")[0];
        const adSnapshots = snapshots.filter(s => s.level === "ad" && s.meta.conceptId);

        // Group by conceptId
        const conceptGroups: Record<string, DailyEntitySnapshot[]> = {};
        for (const s of adSnapshots) {
            const cid = s.meta.conceptId!;
            if (!conceptGroups[cid]) conceptGroups[cid] = [];
            conceptGroups[cid].push(s);
        }

        let batch = db.batch();
        let opCount = 0;

        for (const [conceptId, group] of Object.entries(conceptGroups)) {
            const r7d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 7, refDate)));
            const r14d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 14, refDate)));

            const adsInConcept = group.filter(s => this.isWithinDays(s.date, 7, refDate));
            const adSpends = adsInConcept.reduce((acc, s) => {
                acc[s.entityId] = (acc[s.entityId] || 0) + s.performance.spend;
                return acc;
            }, {} as Record<string, number>);
            const sortedAdSpends = Object.values(adSpends).sort((a, b) => b - a);
            const top1Spend = sortedAdSpends[0] || 0;
            const concentration = r7d.spend > 0 ? top1Spend / r7d.spend : 0;

            const rolling: ConceptRollingMetrics["rolling"] = {
                avg_cpa_7d: r7d.purchases > 0 ? r7d.spend / r7d.purchases : 0,
                avg_cpa_14d: r14d.purchases > 0 ? r14d.spend / r14d.purchases : 0,
                hook_rate_delta: this.calcDelta(
                    r7d.impressions > 0 ? (r7d.clicks / r7d.impressions) * 100 : 0,
                    r14d.impressions > 0 ? (r14d.clicks / r14d.impressions) * 100 : 0
                ),
                spend_concentration_top1: concentration,
                frequency_7d: r7d.impressions > 0 ? r7d.impressions / (r7d.reach || 1) : 0,
                fatigue_flag: concentration > 0.8 && r7d.spend > 50
            };

            const conceptMetrics: ConceptRollingMetrics = {
                clientId,
                conceptId,
                rolling,
                lastUpdate: today
            };

            const docId = `${clientId}__${conceptId.replace(/\//g, '_')}`;
            const docRef = db.collection("concept_rolling_metrics").doc(docId);
            batch.set(docRef, conceptMetrics, { merge: true });
            opCount++;

            if (opCount >= 400) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        if (opCount > 0) {
            await batch.commit();
        }
    }

    static sumPerformance(snapshots: DailyEntitySnapshot[]) {
        return snapshots.reduce((acc, s) => {
            acc.spend += s.performance.spend;
            acc.purchases += (s.performance.purchases || 0);
            acc.leads += (s.performance.leads || 0);
            acc.whatsapp += (s.performance.whatsapp || 0);
            acc.revenue += (s.performance.revenue || 0);
            acc.impressions += s.performance.impressions;
            acc.clicks += s.performance.clicks;
            acc.reach += (s.performance.reach || 0);
            acc.hookViews += (s.engagement?.hookViews || 0);
            acc.videoPlayCount += (s.engagement?.videoPlayCount || 0);
            acc.videoP50Count += (s.engagement?.videoP50Count || 0);
            acc.videoP75Count += (s.engagement?.videoP75Count || 0);
            acc.videoP100Count += (s.engagement?.videoP100Count || 0);
            return acc;
        }, {
            spend: 0, purchases: 0, leads: 0, whatsapp: 0, revenue: 0, impressions: 0, clicks: 0, reach: 0,
            hookViews: 0, videoPlayCount: 0, videoP50Count: 0, videoP75Count: 0, videoP100Count: 0
        });
    }

    static calcDelta(curr: number, prev: number) {
        if (prev === 0) return 0;
        return ((curr / prev) - 1) * 100;
    }

    static isWithinDays(dateStr: string, days: number, refDate: Date = new Date()) {
        const d = new Date(dateStr);
        const diff = (refDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < days;
    }

    /**
     * Pure computation: compute rolling metrics for a single entity group.
     * No DB access — returns the rolling sub-object.
     */
    static computeRollingForEntity(
        group: DailyEntitySnapshot[],
        entityId: string,
        level: EntityLevel,
        refDate: Date,
        adEntitySpends7d: Record<string, number>,
        totalAdSpend7d: number,
        globalSpendTop1Pct: number,
        globalSpendTop3Pct: number
    ): EntityRollingMetrics["rolling"] {
        const r3d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 3, refDate)));
        const r7d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 7, refDate)));
        const r14d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 14, refDate)));
        const r30d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 30, refDate)));
        const prev7d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 14, refDate) && !this.isWithinDays(s.date, 7, refDate)));

        const cpa7d = r7d.purchases > 0 ? r7d.spend / r7d.purchases : 0;
        const cpa14d = r14d.purchases > 0 ? r14d.spend / r14d.purchases : 0;
        const cpaDeltaPct = this.calcDelta(cpa7d, cpa14d);

        const convPerImp7d = r7d.impressions > 0 ? r7d.purchases / r7d.impressions : 0;
        const convPerImpPrev = prev7d.impressions > 0 ? prev7d.purchases / prev7d.impressions : 0;
        const convPerImpDelta = this.calcDelta(convPerImp7d, convPerImpPrev);

        const prev3d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 6, refDate) && !this.isWithinDays(s.date, 3, refDate)));
        const budgetChange3dPct = this.calcDelta(r3d.spend, prev3d.spend);

        let spendTop1Pct = globalSpendTop1Pct;
        const spendTop3Pct = globalSpendTop3Pct;
        if (level === 'ad') {
            spendTop1Pct = totalAdSpend7d > 0 ? (adEntitySpends7d[entityId] || 0) / totalAdSpend7d : 0;
        }

        return {
            spend_3d: r3d.spend,
            spend_7d: r7d.spend,
            spend_14d: r14d.spend,
            spend_30d: r30d.spend,
            impressions_7d: r7d.impressions,
            clicks_7d: r7d.clicks,
            purchases_7d: r7d.purchases,
            leads_7d: r7d.leads,
            whatsapp_7d: r7d.whatsapp,
            ctr_7d: r7d.impressions > 0 ? (r7d.clicks / r7d.impressions) * 100 : 0,
            cpa_3d: r3d.purchases > 0 ? r3d.spend / r3d.purchases : undefined,
            cpa_7d: r7d.purchases > 0 ? r7d.spend / r7d.purchases : undefined,
            cpa_14d: r14d.purchases > 0 ? r14d.spend / r14d.purchases : undefined,
            cpa_delta_pct: cpaDeltaPct,
            roas_7d: r7d.spend > 0 ? r7d.revenue / r7d.spend : undefined,
            roas_delta_pct: this.calcDelta(
                r7d.spend > 0 ? r7d.revenue / r7d.spend : 0,
                prev7d.spend > 0 ? prev7d.revenue / prev7d.spend : 0
            ),
            conversion_velocity_3d: r3d.purchases / 3,
            conversion_velocity_7d: r7d.purchases / 7,
            conversion_velocity_14d: r14d.purchases / 14,
            frequency_7d: r7d.impressions > 0 ? r7d.impressions / (r7d.reach || 1) : undefined,
            ctr_delta_pct: this.calcDelta(
                r7d.impressions > 0 ? (r7d.clicks / r7d.impressions) * 100 : 0,
                prev7d.impressions > 0 ? (prev7d.clicks / prev7d.impressions) * 100 : 0
            ),
            hook_rate_7d: r7d.impressions > 0 ? (r7d.hookViews / r7d.impressions) * 100 : 0,
            hook_rate_delta_pct: this.calcDelta(
                r7d.impressions > 0 ? (r7d.hookViews / r7d.impressions) * 100 : 0,
                prev7d.impressions > 0 ? (prev7d.hookViews / prev7d.impressions) * 100 : 0
            ),
            fitr_7d: r7d.clicks > 0 ? (r7d.purchases / r7d.clicks) * 100 : 0,
            retention_rate_7d: r7d.videoPlayCount > 0 ? (r7d.videoP50Count / r7d.videoPlayCount) * 100 : 0,
            conversion_per_impression_delta: convPerImpDelta,
            spend_top1_ad_pct: spendTop1Pct,
            spend_top3_ads_pct: spendTop3Pct,
            budget_change_3d_pct: budgetChange3dPct
        };
    }

    /**
     * Pure computation: compute concept-level rolling metrics from ad snapshots.
     * No DB access.
     */
    static computeConceptRollingMetrics(
        adSnapshots: DailyEntitySnapshot[],
        refDate: Date
    ): Array<{ conceptId: string; rolling: ConceptRollingMetrics["rolling"] }> {
        const filtered = adSnapshots.filter(s => s.level === "ad" && s.meta.conceptId);

        const conceptGroups: Record<string, DailyEntitySnapshot[]> = {};
        for (const s of filtered) {
            const cid = s.meta.conceptId!;
            if (!conceptGroups[cid]) conceptGroups[cid] = [];
            conceptGroups[cid].push(s);
        }

        const results: Array<{ conceptId: string; rolling: ConceptRollingMetrics["rolling"] }> = [];

        for (const [conceptId, group] of Object.entries(conceptGroups)) {
            const r7d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 7, refDate)));
            const r14d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 14, refDate)));

            const adsInConcept = group.filter(s => this.isWithinDays(s.date, 7, refDate));
            const adSpends = adsInConcept.reduce((acc, s) => {
                acc[s.entityId] = (acc[s.entityId] || 0) + s.performance.spend;
                return acc;
            }, {} as Record<string, number>);
            const sortedAdSpends = Object.values(adSpends).sort((a, b) => b - a);
            const top1Spend = sortedAdSpends[0] || 0;
            const concentration = r7d.spend > 0 ? top1Spend / r7d.spend : 0;

            results.push({
                conceptId,
                rolling: {
                    avg_cpa_7d: r7d.purchases > 0 ? r7d.spend / r7d.purchases : 0,
                    avg_cpa_14d: r14d.purchases > 0 ? r14d.spend / r14d.purchases : 0,
                    hook_rate_delta: this.calcDelta(
                        r7d.impressions > 0 ? (r7d.clicks / r7d.impressions) * 100 : 0,
                        r14d.impressions > 0 ? (r14d.clicks / r14d.impressions) * 100 : 0
                    ),
                    spend_concentration_top1: concentration,
                    frequency_7d: r7d.impressions > 0 ? r7d.impressions / (r7d.reach || 1) : 0,
                    fatigue_flag: concentration > 0.8 && r7d.spend > 50
                }
            });
        }

        return results;
    }
}
