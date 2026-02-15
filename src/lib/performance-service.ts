import { db } from "@/lib/firebase-admin";
import {
    DailyEntitySnapshot,
    EntityLevel,
    EntityRollingMetrics,
    PerformanceMetrics,
    ConceptRollingMetrics,
    MetaInfo
} from "@/types/performance-snapshots";

const META_API_VERSION = "v18.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

export class PerformanceService {
    /**
     * Helper to fetch with simple retry/backoff
     */
    private static async fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response.json();

                const errorData = await response.json();
                console.error(`Meta API Error (Attempt ${i + 1}):`, errorData);

                if (response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, backoff * 2 * (i + 1)));
                    continue;
                }

                if (i === retries - 1) throw new Error(JSON.stringify(errorData));
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
            }
        }
    }

    /**
     * Sync all levels for a specific client and date range
     */
    static async syncAllLevels(clientId: string, metaAdAccountId: string, range: string = "last_7d") {
        if (!META_ACCESS_TOKEN) throw new Error("Meta API Token not configured");

        const cleanAdAccountId = metaAdAccountId.startsWith("act_") ? metaAdAccountId : `act_${metaAdAccountId}`;
        const levels: EntityLevel[] = ["account", "campaign", "adset", "ad"];

        const results = {
            account: 0,
            campaign: 0,
            adset: 0,
            ad: 0
        };

        for (const level of levels) {
            const fields = [
                "account_id",
                "campaign_id",
                "adset_id",
                "ad_id",
                "spend",
                "impressions",
                "reach",
                "clicks",
                "actions",
                "action_values",
                "frequency"
            ].join(",");

            const url = `https://graph.facebook.com/${META_API_VERSION}/${cleanAdAccountId}/insights?level=${level}&time_increment=1&date_preset=${range}&fields=${fields}&access_token=${META_ACCESS_TOKEN}`;

            const data = await this.fetchWithRetry(url);
            const rawInsights = data.data || [];

            const batch = db.batch();

            for (const item of rawInsights) {
                const date = item.date_start;
                const entityId = this.getEntityId(level, item);
                const docId = `${clientId}__${date}__${level}__${entityId}`;

                const performance = this.mapPerformanceMetrics(item);
                const meta = this.extractMetaInfo(level, item);

                const snapshot: DailyEntitySnapshot = {
                    clientId,
                    date,
                    level,
                    entityId,
                    parentId: this.getParentId(level, item),
                    meta,
                    performance,
                    engagement: {
                        hookViews: Number(item.inline_video_view_2s || 0),
                        hookRate: performance.impressions > 0 ? (Number(item.inline_video_view_2s || 0) / performance.impressions) * 100 : 0
                    },
                    audience: {}, // Placeholder for future enhancement
                    stability: {
                        daysActive: 1, // Will be calculated/updated
                        daysSinceLastEdit: 0 // Placeholder
                    }
                };

                const docRef = db.collection("daily_entity_snapshots").doc(docId);
                batch.set(docRef, snapshot, { merge: true });
                results[level]++;
            }

            await batch.commit();
        }

        return results;
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
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
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
            .orderBy("date", "desc")
            .limit(5000);

        const snapshotDocs = await snapshotsRef.get();
        const snapshots = snapshotDocs.docs.map(d => d.data() as DailyEntitySnapshot);

        // Group by entity
        const entityGroups: Record<string, DailyEntitySnapshot[]> = {};
        for (const s of snapshots) {
            const key = `${s.entityId}__${s.level}`;
            if (!entityGroups[key]) entityGroups[key] = [];
            entityGroups[key].push(s);
        }

        const batch = db.batch();

        // Pre-calculate concentration metrics (spend per ad entity in last 7d)
        const adEntitySpends7d: Record<string, number> = {};
        for (const [k, g] of Object.entries(entityGroups)) {
            const [eid, lvl] = k.split("__");
            if (lvl === 'ad') {
                const s7 = this.sumPerformance(g.slice(0, 7));
                adEntitySpends7d[eid] = s7.spend;
            }
        }
        const sortedAdSpends = Object.values(adEntitySpends7d).sort((a, b) => b - a);
        const totalAdSpend7d = sortedAdSpends.reduce((a, b) => a + b, 0);
        const globalSpendTop1Pct = totalAdSpend7d > 0 ? (sortedAdSpends[0] || 0) / totalAdSpend7d : 0;
        const globalSpendTop3Pct = totalAdSpend7d > 0 ? sortedAdSpends.slice(0, 3).reduce((a, b) => a + b, 0) / totalAdSpend7d : 0;

        for (const [key, group] of Object.entries(entityGroups)) {
            const [entityId, level] = key.split("__") as [string, EntityLevel];

            const r3d = this.sumPerformance(group.slice(0, 3));
            const r7d = this.sumPerformance(group.slice(0, 7));
            const r14d = this.sumPerformance(group.slice(0, 14));
            const r30d = this.sumPerformance(group.slice(0, 30));

            // Comparison windows for deltas
            const prev7d = this.sumPerformance(group.slice(7, 14));

            // CPA delta
            const cpa7d = r7d.purchases > 0 ? r7d.spend / r7d.purchases : 0;
            const cpa14d = r14d.purchases > 0 ? r14d.spend / r14d.purchases : 0;
            const cpaDeltaPct = this.calcDelta(cpa7d, cpa14d);

            // Conversion per impression delta
            const convPerImp7d = r7d.impressions > 0 ? r7d.purchases / r7d.impressions : 0;
            const convPerImpPrev = prev7d.impressions > 0 ? prev7d.purchases / prev7d.impressions : 0;
            const convPerImpDelta = this.calcDelta(convPerImp7d, convPerImpPrev);

            // Budget change (compare last 3d spend vs previous 3d spend)
            const prev3d = this.sumPerformance(group.slice(3, 6));
            const budgetChange3dPct = this.calcDelta(r3d.spend, prev3d.spend);

            // Concentration at entity level (for account/campaign parents)
            let spendTop1Pct = globalSpendTop1Pct;
            let spendTop3Pct = globalSpendTop3Pct;
            if (level === 'ad') {
                spendTop1Pct = totalAdSpend7d > 0 ? (adEntitySpends7d[entityId] || 0) / totalAdSpend7d : 0;
            }

            const rollingMetrics: EntityRollingMetrics = {
                clientId,
                entityId,
                level,
                lastUpdate: today,
                rolling: {
                    spend_3d: r3d.spend,
                    spend_7d: r7d.spend,
                    spend_14d: r14d.spend,
                    spend_30d: r30d.spend,

                    impressions_7d: r7d.impressions,
                    clicks_7d: r7d.clicks,
                    purchases_7d: r7d.purchases,
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
                    conversion_per_impression_delta: convPerImpDelta,

                    spend_top1_ad_pct: spendTop1Pct,
                    spend_top3_ads_pct: spendTop3Pct,
                    budget_change_3d_pct: budgetChange3dPct
                }
            };

            const docId = `${clientId}__${entityId}__${level}`;
            const docRef = db.collection("entity_rolling_metrics").doc(docId);
            batch.set(docRef, rollingMetrics, { merge: true });
        }

        await batch.commit();

        // Trigger concept metrics update
        await this.updateConceptMetrics(clientId, snapshots);
    }

    /**
     * Recalculate concept-level rolling metrics
     */
    static async updateConceptMetrics(clientId: string, snapshots: DailyEntitySnapshot[]) {
        const today = new Date().toISOString().split("T")[0];
        const adSnapshots = snapshots.filter(s => s.level === "ad" && s.meta.conceptId);

        // Group by conceptId
        const conceptGroups: Record<string, DailyEntitySnapshot[]> = {};
        for (const s of adSnapshots) {
            const cid = s.meta.conceptId!;
            if (!conceptGroups[cid]) conceptGroups[cid] = [];
            conceptGroups[cid].push(s);
        }

        const batch = db.batch();

        for (const [conceptId, group] of Object.entries(conceptGroups)) {
            const r7d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 7)));
            const r14d = this.sumPerformance(group.filter(s => this.isWithinDays(s.date, 14)));

            const adsInConcept = group.filter(s => this.isWithinDays(s.date, 7));
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

            const docId = `${clientId}__${conceptId}`;
            const docRef = db.collection("concept_rolling_metrics").doc(docId);
            batch.set(docRef, conceptMetrics, { merge: true });
        }

        await batch.commit();
    }

    private static sumPerformance(snapshots: DailyEntitySnapshot[]) {
        return snapshots.reduce((acc, s) => {
            acc.spend += s.performance.spend;
            acc.purchases += (s.performance.purchases || 0);
            acc.revenue += (s.performance.revenue || 0);
            acc.impressions += s.performance.impressions;
            acc.clicks += s.performance.clicks;
            acc.reach += (s.performance.reach || 0);
            acc.hookViews += (s.engagement?.hookViews || 0);
            return acc;
        }, { spend: 0, purchases: 0, revenue: 0, impressions: 0, clicks: 0, reach: 0, hookViews: 0 });
    }

    private static calcDelta(curr: number, prev: number) {
        if (prev === 0) return 0;
        return ((curr / prev) - 1) * 100;
    }

    private static isWithinDays(dateStr: string, days: number) {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= days;
    }
}
