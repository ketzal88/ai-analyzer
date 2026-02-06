import { db } from "@/lib/firebase-admin";
import { MetaCreativeDoc } from "@/types/meta-creative";
import { CreativeKPISnapshot, CreativeKPIMetrics, SelectedCreative, SelectionReason } from "@/types/creative-kpi";
import { createHash } from "crypto";

/**
 * AG-42: Creative KPI Snapshot Service
 * Calculates performance metrics for creatives from DB (no Meta API calls)
 */

const CACHE_FRESHNESS_HOURS = 6;

/**
 * Parse range preset to date objects
 */
function parseRange(rangePreset: string): { start: Date; end: Date; days: number } {
    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    let days = 14;
    switch (rangePreset) {
        case "last_7d": days = 7; break;
        case "last_14d": days = 14; break;
        case "last_30d": days = 30; break;
        default: days = 14;
    }

    const start = new Date(end);
    start.setDate(end.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    return { start, end, days };
}

/**
 * Generate snapshot ID (cache key)
 */
function generateSnapshotId(clientId: string, start: string, end: string): string {
    const data = `${clientId}|${start}|${end}|v1`;
    return createHash("sha256").update(data).digest("hex");
}

/**
 * Calculate KPI snapshot for creatives
 * NOTE: Current limitation - insights_daily is at campaign level, not ad level
 * This is a hybrid approach that maps campaign KPIs to creatives
 */
export async function calculateCreativeKPISnapshot(
    clientId: string,
    rangePreset: string = "last_14d"
): Promise<CreativeKPISnapshot> {
    const { start, end, days } = parseRange(rangePreset);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    const snapshotId = generateSnapshotId(clientId, startStr, endStr);

    // 1. Check cache
    const cachedSnapshot = await db.collection("creative_kpi_snapshots").doc(snapshotId).get();
    if (cachedSnapshot.exists) {
        const data = cachedSnapshot.data() as CreativeKPISnapshot;
        const ageHours = (Date.now() - new Date(data.createdAt).getTime()) / (1000 * 60 * 60);

        if (ageHours < CACHE_FRESHNESS_HOURS) {
            console.log(`Using cached KPI snapshot (age: ${ageHours.toFixed(1)}h)`);
            return data;
        }
    }

    console.log(`Calculating fresh KPI snapshot for ${clientId}, range: ${startStr} to ${endStr}`);

    // 2. Fetch active creatives
    const activeSince = new Date(start);
    activeSince.setDate(activeSince.getDate() - 7); // Include creatives active in last 7 days before range

    const creativesSnapshot = await db.collection("meta_creatives")
        .where("clientId", "==", clientId)
        .where("lastSeenActiveAt", ">=", activeSince.toISOString())
        .get();

    const creatives = creativesSnapshot.docs.map(doc => doc.data() as MetaCreativeDoc);
    console.log(`Found ${creatives.length} active creatives`);

    // 3. Fetch campaign-level insights for the range
    const insightsSnapshot = await db.collection("insights_daily")
        .where("clientId", "==", clientId)
        .where("date", ">=", startStr)
        .where("date", "<=", endStr)
        .get();

    const insights = insightsSnapshot.docs.map(doc => doc.data());
    console.log(`Found ${insights.length} insight records`);

    // 4. Aggregate insights by campaign
    const campaignMetrics = new Map<string, any>();

    for (const insight of insights) {
        const campaignId = insight.campaignId;
        if (!campaignMetrics.has(campaignId)) {
            campaignMetrics.set(campaignId, {
                spend: 0,
                impressions: 0,
                clicks: 0,
                purchases: 0,
                purchaseValue: 0,
                reach: 0,
                frequency: 0,
                days: 0
            });
        }

        const metrics = campaignMetrics.get(campaignId);
        metrics.spend += insight.spend || 0;
        metrics.impressions += insight.impressions || 0;
        metrics.clicks += insight.clicks || 0;
        metrics.purchases += insight.purchases || 0;
        metrics.purchaseValue += insight.purchaseValue || 0;
        metrics.reach += insight.reach || 0;
        metrics.days++;
    }

    // Calculate avg frequency per campaign
    for (const [campaignId, metrics] of campaignMetrics.entries()) {
        if (metrics.reach > 0) {
            metrics.frequency = metrics.impressions / metrics.reach;
        }
    }

    // 5. Map campaign metrics to creatives (hybrid approach)
    const metricsByCreative: CreativeKPIMetrics[] = [];

    for (const creative of creatives) {
        const campaignId = creative.campaign.id;
        const campaignData = campaignMetrics.get(campaignId);

        if (!campaignData) {
            // No data for this campaign in range - skip or mark as low signal
            continue;
        }

        // Count creatives in this campaign for proportional distribution
        const creativesInCampaign = creatives.filter(c => c.campaign.id === campaignId);
        const shareRatio = 1 / creativesInCampaign.length;

        // Distribute campaign metrics proportionally
        // NOTE: This is an approximation until we have ad-level insights
        const spend = campaignData.spend * shareRatio;
        const impressions = Math.round(campaignData.impressions * shareRatio);
        const clicks = Math.round(campaignData.clicks * shareRatio);
        const primaryConversions = campaignData.purchases * shareRatio;
        const value = campaignData.purchaseValue * shareRatio;

        const cpa = primaryConversions > 0 ? spend / primaryConversions : 0;
        const roas = spend > 0 ? value / spend : 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;

        metricsByCreative.push({
            adId: creative.ad.id,
            creativeId: creative.creative.id,
            fingerprint: creative.fingerprint,
            spend,
            impressions,
            reach: Math.round((campaignData.reach || 0) * shareRatio),
            frequency: campaignData.frequency,
            clicks,
            primaryConversions,
            value,
            cpa,
            roas,
            ctr,
            cpc
        });
    }

    // 6. Create snapshot
    const snapshot: CreativeKPISnapshot = {
        id: snapshotId,
        clientId,
        range: { start: startStr, end: endStr },
        createdAt: new Date().toISOString(),
        metricsByCreative,
        coverage: {
            daysRequested: days,
            daysAvailable: insights.length > 0 ? Math.max(...insights.map((i: any) =>
                new Date(i.date).getTime()
            )) - Math.min(...insights.map((i: any) =>
                new Date(i.date).getTime()
            )) / (1000 * 60 * 60 * 24) + 1 : 0
        },
        lastSyncAt: new Date().toISOString()
    };

    // 7. Save to cache
    await db.collection("creative_kpi_snapshots").doc(snapshotId).set(snapshot);
    console.log(`Saved KPI snapshot with ${metricsByCreative.length} creative metrics`);

    return snapshot;
}

/**
 * Intelligent selector: Score and rank creatives for audit/analysis
 */
export async function selectCreativesForAudit(
    clientId: string,
    rangePreset: string = "last_14d",
    limit: number = 40
): Promise<SelectedCreative[]> {
    // Hard limit
    const maxLimit = 50;
    limit = Math.min(limit, maxLimit);

    // 1. Get KPI snapshot
    const snapshot = await calculateCreativeKPISnapshot(clientId, rangePreset);

    // 2. Fetch creative metadata
    const creativeDocs = await db.collection("meta_creatives")
        .where("clientId", "==", clientId)
        .get();

    const creativesMap = new Map<string, MetaCreativeDoc>();
    for (const doc of creativeDocs.docs) {
        const data = doc.data() as MetaCreativeDoc;
        creativesMap.set(data.ad.id, data);
    }

    // 3. Calculate features and score
    const candidates: Array<SelectedCreative & { rawScore: number }> = [];

    // Calculate normalization factors
    const maxSpend = Math.max(...snapshot.metricsByCreative.map(m => m.spend), 1);
    const maxImpressions = Math.max(...snapshot.metricsByCreative.map(m => m.impressions), 1);
    const avgCpa = snapshot.metricsByCreative.reduce((sum, m) => sum + m.cpa, 0) / snapshot.metricsByCreative.length || 1;

    for (const metrics of snapshot.metricsByCreative) {
        const creative = creativesMap.get(metrics.adId);
        if (!creative) continue;

        // Feature calculation
        const normSpend = metrics.spend / maxSpend;
        const normImpressions = metrics.impressions / maxImpressions;

        // Fatigue risk: high frequency + declining performance
        const fatigueRisk = (metrics.frequency || 0) > 3 ? 0.5 : 0;

        // Underfunded opportunity: great CPA but low spend
        const isUnderfunded = metrics.cpa > 0 && metrics.cpa < avgCpa * 0.7 && normSpend < 0.3;
        const underfundedOpportunity = isUnderfunded ? 0.8 : 0;

        // Newness boost
        const daysSinceFirstSeen = (Date.now() - new Date(creative.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);
        const newnessBoost = daysSinceFirstSeen <= 5 ? 0.7 : 0;

        // Low signal penalty
        const lowSignalPenalty = metrics.impressions < 1000 ? 0.5 : 0;

        // Calculate score
        const rawScore =
            0.35 * normSpend +
            0.20 * normImpressions +
            0.20 * fatigueRisk +
            0.15 * underfundedOpportunity +
            0.10 * newnessBoost -
            0.30 * lowSignalPenalty;

        // Determine reasons
        const reasons: SelectionReason[] = [];
        if (normSpend > 0.7) reasons.push("TOP_SPEND");
        if (normImpressions > 0.7) reasons.push("TOP_IMPRESSIONS");
        if (fatigueRisk > 0) reasons.push("HIGH_FATIGUE_RISK");
        if (underfundedOpportunity > 0) reasons.push("UNDERFUNDED_WINNER");
        if (newnessBoost > 0) reasons.push("NEW_CREATIVE");
        if (lowSignalPenalty > 0) reasons.push("LOW_SIGNAL");

        candidates.push({
            adId: creative.ad.id,
            creativeId: creative.creative.id,
            campaignId: creative.campaign.id,
            campaignName: creative.campaign.name,
            adsetId: creative.adset.id,
            adsetName: creative.adset.name,
            adName: creative.ad.name,
            format: creative.creative.format,
            fingerprint: creative.fingerprint,
            headline: creative.creative.headline,
            primaryText: creative.creative.primaryText,
            kpis: metrics,
            score: rawScore,
            rawScore,
            reasons
        });
    }

    // 4. Dedupe by fingerprint (cluster)
    const fingerprintGroups = new Map<string, typeof candidates>();

    for (const candidate of candidates) {
        if (!fingerprintGroups.has(candidate.fingerprint)) {
            fingerprintGroups.set(candidate.fingerprint, []);
        }
        fingerprintGroups.get(candidate.fingerprint)!.push(candidate);
    }

    const deduped: SelectedCreative[] = [];

    for (const [fingerprint, group] of fingerprintGroups.entries()) {
        // Sort by spend desc, then impressions desc
        group.sort((a, b) => {
            if (b.kpis.spend !== a.kpis.spend) return b.kpis.spend - a.kpis.spend;
            return b.kpis.impressions - a.kpis.impressions;
        });

        const representative = group[0];

        // Add cluster info if multiple members
        if (group.length > 1) {
            representative.cluster = {
                size: group.length,
                spendSum: group.reduce((sum, c) => sum + c.kpis.spend, 0),
                memberIds: group.slice(1).map(c => c.adId)
            };
        }

        deduped.push(representative);
    }

    // 5. Sort by score and limit
    deduped.sort((a, b) => b.score - a.score);
    const selected = deduped.slice(0, limit);

    return selected;
}
