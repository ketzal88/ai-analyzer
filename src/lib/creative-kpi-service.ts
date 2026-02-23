import { db } from "@/lib/firebase-admin";
import { MetaCreativeDoc } from "@/types/meta-creative";
import { CreativeKPISnapshot, CreativeKPIMetrics, SelectedCreative, SelectionReason } from "@/types/creative-kpi";
import { DailyEntitySnapshot } from "@/types/performance-snapshots";
import { createHash } from "crypto";

/**
 * AG-42: Creative KPI Snapshot Service (v2)
 * Sources KPIs from daily_entity_snapshots (ad-level) which has data for all clients.
 * Falls back gracefully when meta_creatives metadata is not available.
 */

const CACHE_FRESHNESS_HOURS = 6;

/**
 * Calculate Selection Score for a creative
 */
export function scoreCreative(
    metrics: CreativeKPIMetrics,
    reference: { maxSpend: number; maxImpressions: number; avgCpa: number },
    meta?: { firstSeenAt?: string }
): { score: number; reasons: SelectionReason[] } {
    const normSpend = metrics.spend / (reference.maxSpend || 1);
    const normImpressions = metrics.impressions / (reference.maxImpressions || 1);
    const fatigueRisk = (metrics.frequency || 0) > 3 ? 0.5 : 0;
    const isUnderfunded = metrics.cpa > 0 && metrics.cpa < reference.avgCpa * 0.7 && normSpend < 0.3;
    const underfundedOpportunity = isUnderfunded ? 0.8 : 0;

    const daysSinceFirst = meta?.firstSeenAt
        ? (Date.now() - new Date(meta.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24)
        : 999;
    const newnessBoost = daysSinceFirst <= 5 ? 0.7 : 0;
    const lowSignalPenalty = metrics.impressions < 500 ? 0.5 : 0;

    const score =
        0.35 * normSpend +
        0.20 * normImpressions +
        0.20 * fatigueRisk +
        0.15 * underfundedOpportunity +
        0.10 * newnessBoost -
        0.30 * lowSignalPenalty;

    const reasons: SelectionReason[] = [];
    if (normSpend > 0.7) reasons.push("TOP_SPEND");
    if (normImpressions > 0.7) reasons.push("TOP_IMPRESSIONS");
    if (fatigueRisk > 0) reasons.push("HIGH_FATIGUE_RISK");
    if (underfundedOpportunity > 0) reasons.push("UNDERFUNDED_WINNER");
    if (newnessBoost > 0) reasons.push("NEW_CREATIVE");
    if (lowSignalPenalty > 0) reasons.push("LOW_SIGNAL");
    if (reasons.length === 0) reasons.push("LOW_SIGNAL");

    return { score: Math.max(0, score), reasons };
}

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

function generateSnapshotId(clientId: string, start: string, end: string): string {
    return createHash("sha256").update(`${clientId}|${start}|${end}|v2`).digest("hex");
}

/**
 * Build KPI snapshot from daily_entity_snapshots (ad-level)
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
    const cached = await db.collection("creative_kpi_snapshots").doc(snapshotId).get();
    if (cached.exists) {
        const data = cached.data() as CreativeKPISnapshot;
        const ageHours = (Date.now() - new Date(data.createdAt).getTime()) / (1000 * 60 * 60);
        if (ageHours < CACHE_FRESHNESS_HOURS) {
            console.log(`[KPI] Using cached snapshot (age: ${ageHours.toFixed(1)}h, metrics: ${data.metricsByCreative.length})`);
            return data;
        }
    }

    console.log(`[KPI] Calculating fresh snapshot for ${clientId}, range: ${startStr} to ${endStr}`);

    // 2. Fetch ad-level daily snapshots for the date range
    const adSnapshotDocs = await db.collection("daily_entity_snapshots")
        .where("clientId", "==", clientId)
        .where("level", "==", "ad")
        .where("date", ">=", startStr)
        .where("date", "<=", endStr)
        .get();

    const snapshots = adSnapshotDocs.docs.map(d => d.data() as DailyEntitySnapshot);
    console.log(`[KPI] Found ${snapshots.length} ad-level daily snapshots`);

    // 3. Aggregate by adId (entityId)
    const adAggregated = new Map<string, {
        spend: number; impressions: number; clicks: number;
        primaryConversions: number; value: number; reach: number;
        daysActive: number; firstDate: string; lastDate: string;
        name: string;
        meta: { campaignId?: string; adsetId?: string; conceptId?: string };
    }>();

    for (const snap of snapshots) {
        const adId = snap.entityId;
        if (!adId) continue;

        if (!adAggregated.has(adId)) {
            adAggregated.set(adId, {
                spend: 0, impressions: 0, clicks: 0,
                primaryConversions: 0, value: 0, reach: 0,
                daysActive: 0, firstDate: snap.date, lastDate: snap.date,
                name: snap.name || adId,
                meta: snap.meta || {}
            });
        }

        const m = adAggregated.get(adId)!;
        m.spend += snap.performance.spend || 0;
        m.impressions += snap.performance.impressions || 0;
        m.clicks += snap.performance.clicks || 0;
        m.primaryConversions += snap.performance.purchases || snap.performance.leads || 0;
        m.value += snap.performance.revenue || 0;
        m.reach += snap.performance.reach || 0;
        m.daysActive++;
        if (snap.date < m.firstDate) m.firstDate = snap.date;
        if (snap.date > m.lastDate) m.lastDate = snap.date;
        // Update meta from later dates
        if (snap.meta?.campaignId) m.meta.campaignId = snap.meta.campaignId;
        if (snap.meta?.adsetId) m.meta.adsetId = snap.meta.adsetId;
        if (snap.meta?.conceptId) m.meta.conceptId = snap.meta.conceptId;
        if (snap.name) m.name = snap.name;
    }

    // 4. Build metrics array
    const metricsByCreative: CreativeKPIMetrics[] = [];

    for (const [adId, m] of adAggregated) {
        const cpa = m.primaryConversions > 0 ? m.spend / m.primaryConversions : 0;
        const roas = m.spend > 0 ? m.value / m.spend : 0;
        const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
        const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
        const frequency = m.reach > 0 ? m.impressions / m.reach : 0;

        metricsByCreative.push({
            adId,
            creativeId: adId,    // Will be enriched below if meta_creatives available
            fingerprint: adId,   // Will be enriched below if meta_creatives available
            spend: m.spend,
            impressions: m.impressions,
            reach: m.reach,
            frequency,
            clicks: m.clicks,
            primaryConversions: m.primaryConversions,
            value: m.value,
            cpa, roas, ctr, cpc
        });
    }

    // 5. Enrich with meta_creatives metadata (fingerprint, format) — non-fatal
    try {
        const creativeDocs = await db.collection("meta_creatives")
            .where("clientId", "==", clientId)
            .get();
        const creativesMap = new Map<string, MetaCreativeDoc>();
        creativeDocs.docs.forEach(d => {
            const data = d.data() as MetaCreativeDoc;
            creativesMap.set(data.ad.id, data);
        });
        for (const metric of metricsByCreative) {
            const meta = creativesMap.get(metric.adId);
            if (meta) {
                metric.creativeId = meta.creative.id;
                metric.fingerprint = meta.fingerprint;
            }
        }
    } catch (e) {
        console.warn("[KPI] meta_creatives enrichment skipped:", e);
    }

    const uniqueDates = new Set(snapshots.map(s => s.date));

    const snapshot: CreativeKPISnapshot = {
        id: snapshotId,
        clientId,
        range: { start: startStr, end: endStr },
        createdAt: new Date().toISOString(),
        metricsByCreative,
        coverage: { daysRequested: days, daysAvailable: uniqueDates.size },
        lastSyncAt: new Date().toISOString()
    };

    await db.collection("creative_kpi_snapshots").doc(snapshotId).set(snapshot);
    console.log(`[KPI] Saved snapshot: ${metricsByCreative.length} creatives for ${clientId}`);

    return snapshot;
}

/**
 * Fetch creative media URLs (image_url, thumbnail_url) and metadata from Meta in batch
 */
export async function fetchMetaMediaForAds(adIds: string[]): Promise<Map<string, {
    imageUrl?: string;
    videoUrl?: string;
    videoId?: string;
    headline?: string;
    primaryText?: string;
    previewUrl?: string;
}>> {
    const results = new Map<string, {
        imageUrl?: string;
        videoUrl?: string;
        videoId?: string;
        headline?: string;
        primaryText?: string;
        previewUrl?: string;
    }>();
    if (adIds.length === 0 || !process.env.META_ACCESS_TOKEN) return results;

    const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
    const BATCH_SIZE = 50;

    for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
        const chunk = adIds.slice(i, i + BATCH_SIZE);

        // Fetch basic metadata + Ad-level preview link
        const batch = chunk.map(id => ({
            method: "GET",
            relative_url: `${id}?fields=preview_shareable_link,creative{id,object_story_spec,asset_feed_spec,thumbnail_url,image_url,body,title}`
        }));

        try {
            const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_token: process.env.META_ACCESS_TOKEN,
                    batch: JSON.stringify(batch)
                })
            });

            if (!res.ok) throw new Error("Meta Batch API failed");

            const responses: any[] = await res.json();
            const videoRequests: { adId: string, videoId: string }[] = [];

            for (let j = 0; j < chunk.length; j++) {
                const r = responses[j];
                if (r.code !== 200) {
                    console.warn(`[Creative KPI] Batch item ${chunk[j]} failed with code ${r.code}:`, r.body);
                    continue;
                }

                const data = JSON.parse(r.body);
                const creative = data.creative;
                if (!creative) continue;

                const adId = chunk[j];
                const storySpec = creative.object_story_spec || {};
                const assetSpec = creative.asset_feed_spec || {};
                const linkData = storySpec.link_data || {};
                const videoData = storySpec.video_data || {};

                // 1. Extract Copy (Enrichment)
                const primaryText = creative.body || linkData.message || assetSpec.bodies?.[0]?.text;
                const headline = creative.title || linkData.name || assetSpec.titles?.[0]?.text;
                const previewUrl = data.preview_shareable_link;

                // 2. Identify Media & Video ID
                let imageUrl: string | undefined;
                let videoUrl: string | undefined;
                let videoId = creative.video_id || videoData.video_id || assetSpec.videos?.[0]?.video_id;

                // Priority for Image Quality: creative.image_url (Full Res) > story_spec images > thumbnail_url
                if (creative.image_url) {
                    imageUrl = creative.image_url;
                } else if (creative.thumbnail_url) {
                    imageUrl = creative.thumbnail_url;
                } else if (videoData.image_url || videoData.thumbnail_url) {
                    imageUrl = videoData.image_url || videoData.thumbnail_url;
                } else if (linkData.image_url) {
                    imageUrl = linkData.image_url;
                } else if (assetSpec.images?.[0]?.url) {
                    imageUrl = assetSpec.images[0].url;
                }

                if (videoId) {
                    videoRequests.push({ adId, videoId });
                }

                results.set(adId, {
                    imageUrl,
                    videoUrl,
                    videoId,
                    headline,
                    primaryText,
                    previewUrl
                });
            }

            // 3. Optional: Fetch Video Source URLs if we found videos
            if (videoRequests.length > 0) {
                const videoBatch = videoRequests.map(v => ({
                    method: "GET",
                    relative_url: `${v.videoId}?fields=source,thumbnail_url,thumbnails{uri,width,height}`
                }));

                const vRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        access_token: process.env.META_ACCESS_TOKEN,
                        batch: JSON.stringify(videoBatch)
                    })
                });

                if (vRes.ok) {
                    const vResponses: any[] = await vRes.json();
                    for (let k = 0; k < videoRequests.length; k++) {
                        const vr = vResponses[k];
                        if (vr.code === 200) {
                            const vData = JSON.parse(vr.body);
                            const current = results.get(videoRequests[k].adId);
                            if (current) {
                                // Find highest resolution thumbnail if available
                                let bestThumb = vData.thumbnail_url;
                                if (vData.thumbnails?.data) {
                                    const sorted = [...vData.thumbnails.data].sort((a: any, b: any) => b.width - a.width);
                                    if (sorted[0]) bestThumb = sorted[0].uri;
                                }

                                results.set(videoRequests[k].adId, {
                                    ...current,
                                    videoUrl: vData.source, // Actual playable mp4 URL
                                    imageUrl: bestThumb || current.imageUrl,
                                    previewUrl: current.previewUrl
                                });
                            }
                        }
                    }
                }
            }

        } catch (error) {
            console.error("[Creative KPI] Media fetch error:", error);
        }
    }

    return results;
}

/**
 * Build creative selection with scoring — queries all entity info in batch
 */
export async function selectCreativesForAudit(
    clientId: string,
    rangePreset: string = "last_14d",
    limit: number = 40
): Promise<SelectedCreative[]> {
    limit = Math.min(limit, 50);

    const snapshot = await calculateCreativeKPISnapshot(clientId, rangePreset);
    if (snapshot.metricsByCreative.length === 0) {
        console.log(`[KPI] No ad metrics found for ${clientId}`);
        return [];
    }

    // Pull all ad-level snapshots for latest name/meta — one query, filter locally
    // Use the actual latest date that has data (not necessarily today)
    const latestSnapshotDate = snapshot.range.end;
    // Try today-1 as well in case today has no data yet
    const prevDate = new Date(latestSnapshotDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split("T")[0];

    const adInfoDocs = await db.collection("daily_entity_snapshots")
        .where("clientId", "==", clientId)
        .where("level", "==", "ad")
        .where("date", ">=", prevDateStr)
        .where("date", "<=", latestSnapshotDate)
        .get();

    const adInfoMap = new Map<string, { name: string; meta: { campaignId?: string; adsetId?: string; conceptId?: string } }>();
    adInfoDocs.docs.forEach(d => {
        const data = d.data() as DailyEntitySnapshot;
        if (data.entityId) {
            adInfoMap.set(data.entityId, { name: data.name || data.entityId, meta: data.meta || {} });
        }
    });

    // If some ads didn't have data on the last date, fill from the snapshot range start
    const missingAdIds = snapshot.metricsByCreative
        .map(m => m.adId)
        .filter(id => !adInfoMap.has(id));

    if (missingAdIds.length > 0) {
        const fallbackDocs = await db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .where("level", "==", "ad")
            .where("date", "==", snapshot.range.start)
            .get();
        fallbackDocs.docs.forEach(d => {
            const data = d.data() as DailyEntitySnapshot;
            if (data.entityId && !adInfoMap.has(data.entityId)) {
                adInfoMap.set(data.entityId, { name: data.name || data.entityId, meta: data.meta || {} });
            }
        });
    }

    // Fetch campaign and adset names from entity snapshots (batch)
    const [campaignDocs, adsetDocs] = await Promise.all([
        db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .where("level", "==", "campaign")
            .where("date", ">=", prevDateStr)
            .where("date", "<=", latestSnapshotDate)
            .get(),
        db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .where("level", "==", "adset")
            .where("date", ">=", prevDateStr)
            .where("date", "<=", latestSnapshotDate)
            .get()
    ]);


    const campaignNameMap = new Map<string, string>();
    campaignDocs.docs.forEach(d => {
        const data = d.data();
        if (data.entityId && data.name) campaignNameMap.set(data.entityId, data.name);
    });

    const adsetNameMap = new Map<string, string>();
    adsetDocs.docs.forEach(d => {
        const data = d.data();
        if (data.entityId && data.name) adsetNameMap.set(data.entityId, data.name);
    });

    // Fetch meta_creatives metadata (optional enrichment)
    const creativesMap = new Map<string, MetaCreativeDoc>();
    try {
        const creativeDocs = await db.collection("meta_creatives")
            .where("clientId", "==", clientId)
            .get();
        creativeDocs.docs.forEach(d => {
            const data = d.data() as MetaCreativeDoc;
            creativesMap.set(data.ad.id, data);
        });
    } catch (e) {
        console.warn("[KPI] meta_creatives fetch skipped:", e);
    }

    // Score and rank
    const maxSpend = Math.max(...snapshot.metricsByCreative.map(m => m.spend), 1);
    const maxImpressions = Math.max(...snapshot.metricsByCreative.map(m => m.impressions), 1);
    const avgCpa = snapshot.metricsByCreative.reduce((s, m) => s + m.cpa, 0) /
        snapshot.metricsByCreative.length || 1;

    const reference = { maxSpend, maxImpressions, avgCpa };
    const candidates: Array<SelectedCreative & { rawScore: number }> = [];

    for (const metrics of snapshot.metricsByCreative) {
        const adId = metrics.adId;
        const metaDoc = creativesMap.get(adId);
        const adInfo = adInfoMap.get(adId);

        const { score, reasons } = scoreCreative(metrics, reference, metaDoc);
        const rawScore = score;

        const campaignId = adInfo?.meta?.campaignId || metaDoc?.campaign?.id || "";
        const adsetId = adInfo?.meta?.adsetId || metaDoc?.adset?.id || "";
        const conceptId = adInfo?.meta?.conceptId || "";

        candidates.push({
            adId,
            creativeId: metaDoc?.creative?.id || adId,
            campaignId,
            campaignName: campaignNameMap.get(campaignId) || metaDoc?.campaign?.name || conceptId || adId,
            adsetId,
            adsetName: adsetNameMap.get(adsetId) || metaDoc?.adset?.name || "",
            adName: adInfo?.name || metaDoc?.ad?.name || adId,
            format: metaDoc?.creative?.format || "IMAGE",
            fingerprint: metrics.fingerprint,
            headline: metaDoc?.creative?.headline,
            primaryText: metaDoc?.creative?.primaryText,
            kpis: metrics,
            score: rawScore,
            rawScore,
            reasons
        });
    }

    // Dedupe by fingerprint
    const fingerprintGroups = new Map<string, typeof candidates>();
    for (const c of candidates) {
        if (!fingerprintGroups.has(c.fingerprint)) fingerprintGroups.set(c.fingerprint, []);
        fingerprintGroups.get(c.fingerprint)!.push(c);
    }

    const deduped: SelectedCreative[] = [];
    for (const group of fingerprintGroups.values()) {
        group.sort((a, b) => b.kpis.spend !== a.kpis.spend ? b.kpis.spend - a.kpis.spend : b.kpis.impressions - a.kpis.impressions);
        const rep = group[0];
        if (group.length > 1) {
            rep.cluster = {
                size: group.length,
                spendSum: group.reduce((s, c) => s + c.kpis.spend, 0),
                memberIds: group.slice(1).map(c => c.adId)
            };
        }
        deduped.push(rep);
    }

    deduped.sort((a, b) => b.score - a.score);
    const finalSelected = deduped.slice(0, limit);

    // ── Enrichment: Fetch Media URLs for final selection ──
    const selectedAdIds = finalSelected.map(c => c.adId);
    const mediaMap = await fetchMetaMediaForAds(selectedAdIds);

    for (const creative of finalSelected) {
        const media = mediaMap.get(creative.adId);
        if (media) {
            creative.imageUrl = media.imageUrl;
            creative.videoUrl = media.videoUrl;
            creative.videoId = media.videoId;
            creative.previewUrl = media.previewUrl;

            // Enrich text if missing
            if (media.headline) creative.headline = media.headline;
            if (media.primaryText) creative.primaryText = media.primaryText;

            // Force format if we found a videoId
            if (media.videoId) {
                creative.format = "VIDEO";
            }

            // Also update the metrics object inside since it's used in some places
            creative.kpis.imageUrl = media.imageUrl;
            creative.kpis.videoUrl = media.videoUrl;
            creative.kpis.videoId = media.videoId;
            creative.kpis.headline = media.headline;
            creative.kpis.primaryText = media.primaryText;
            creative.kpis.previewUrl = media.previewUrl;
        }
    }

    return finalSelected;
}
