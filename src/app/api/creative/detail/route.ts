import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { calculateCreativeKPISnapshot, fetchMetaMediaForAds, scoreCreative } from "@/lib/creative-kpi-service";
import { MetaCreativeDoc } from "@/types/meta-creative";
import { CreativeKPIMetrics } from "@/types/creative-kpi";
import { DailyEntitySnapshot } from "@/types/performance-snapshots";

/**
 * AG-45: Get detailed creative data, KPIs, cluster info and AI reports
 * GET /api/creative/detail?clientId=xxx&adId=xxx&range=last_14d
 */
export async function GET(request: NextRequest) {
    try {
        const isDev = process.env.NODE_ENV === "development";
        const sessionCookie = request.cookies.get("session")?.value;

        if (!isDev) {
            if (!sessionCookie) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            await auth.verifySessionCookie(sessionCookie);
        }

        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const adId = searchParams.get("adId");
        const range = searchParams.get("range") || "last_14d";

        if (!clientId || !adId) {
            return NextResponse.json({ error: "Missing required params" }, { status: 400 });
        }

        // 1. Fetch KPIs first (we need them anyway)
        const snapshot = await calculateCreativeKPISnapshot(clientId, range);
        const kpis = snapshot.metricsByCreative.find(m => m.adId === adId) || {
            adId,
            creativeId: adId,
            fingerprint: adId, // Default fingerprint unless enriched
            spend: 0,
            impressions: 0,
            clicks: 0,
            primaryConversions: 0,
            value: 0,
            cpa: 0,
            roas: 0,
            ctr: 0,
            cpc: 0
        };

        // 2. Fetch Creative Metadata (Try meta_creatives first)
        const creativeDocId = `${clientId}__${adId}`;
        const creativeSnap = await db.collection("meta_creatives").doc(creativeDocId).get();

        let creativeData: MetaCreativeDoc;
        let fingerprint = kpis.fingerprint;

        if (creativeSnap.exists) {
            creativeData = creativeSnap.data() as MetaCreativeDoc;
            fingerprint = creativeData.fingerprint;
            // Ensure KPI matches Meta ID if available
            kpis.creativeId = creativeData.creative.id;
            kpis.fingerprint = fingerprint;
        } else {
            console.log(`[Creative Detail] meta_creatives doc not found for ${adId}, using fallback.`);
            // FALLBACK: Reconstruct from daily_entity_snapshots

            // Get Ad Snapshot - Query WITHOUT orderBy/limit to avoid missing index issues, sort in memory
            const adSnapQuery = await db.collection("daily_entity_snapshots")
                .where("clientId", "==", clientId)
                .where("level", "==", "ad")
                .where("entityId", "==", adId)
                .get();

            if (adSnapQuery.empty) {
                // If no meta_creative AND no snapshot -> 404
                return NextResponse.json({ error: "Creative not found in system" }, { status: 404 });
            }

            // Sort in memory to find latest
            const adSnaps = adSnapQuery.docs
                .map(d => d.data() as DailyEntitySnapshot)
                .sort((a, b) => b.date.localeCompare(a.date));
            const adSnap = adSnaps[0];

            const campaignId = adSnap.meta?.campaignId || "";
            const adsetId = adSnap.meta?.adsetId || "";

            // Fetch Names (also in-memory sort)
            let campaignName = campaignId;
            let adsetName = adsetId;

            if (campaignId) {
                const cmpSnap = await db.collection("daily_entity_snapshots")
                    .where("clientId", "==", clientId)
                    .where("level", "==", "campaign")
                    .where("entityId", "==", campaignId)
                    .get();
                if (!cmpSnap.empty) {
                    const snaps = cmpSnap.docs.map(d => d.data()).sort((a, b) => b.date.localeCompare(a.date));
                    campaignName = snaps[0].name || campaignId;
                }
            }

            if (adsetId) {
                const asetSnap = await db.collection("daily_entity_snapshots")
                    .where("clientId", "==", clientId)
                    .where("level", "==", "adset")
                    .where("entityId", "==", adsetId)
                    .get();
                if (!asetSnap.empty) {
                    const snaps = asetSnap.docs.map(d => d.data()).sort((a, b) => b.date.localeCompare(a.date));
                    adsetName = snaps[0].name || adsetId;
                }
            }

            // Construct Fake MetaDoc
            creativeData = {
                clientId,
                metaAccountId: "unknown",
                status: "ACTIVE",
                effectiveStatus: "ACTIVE",
                lastSeenActiveAt: adSnap.date,
                firstSeenAt: adSnap.date,
                updatedAt: new Date().toISOString(),
                campaign: {
                    id: campaignId,
                    name: campaignName,
                    objective: "CONVERSIONS",
                    buyingType: "AUCTION"
                },
                adset: {
                    id: adsetId,
                    name: adsetName,
                    optimizationGoal: "OFFSITE_CONVERSIONS",
                    billingEvent: "IMPRESSIONS"
                },
                ad: {
                    id: adId,
                    name: adSnap.name || adId
                },
                creative: {
                    id: adId, // fallback
                    format: "IMAGE", // unknown, default to simplified view
                    isDynamicProductAd: false,
                    hasCatalog: false,
                    assets: {}
                },
                fingerprint: adId // fallback fingerprint
            };
        }

        // 3. Fetch Cluster Information (Ads with same fingerprint)
        const clusterSnap = await db.collection("meta_creatives")
            .where("clientId", "==", clientId)
            .where("fingerprint", "==", fingerprint)
            .get();

        const clusterMembers = clusterSnap.docs
            .map(doc => doc.data() as MetaCreativeDoc)
            .filter(doc => doc.ad.id !== adId)
            .map(doc => ({
                adId: doc.ad.id,
                adName: doc.ad.name,
                campaignName: doc.campaign.name
            }));

        // 4. Check for existing AI Report
        let latestReport = null;
        try {
            const reportSnap = await db.collection("creative_ai_reports")
                .where("clientId", "==", clientId)
                .where("adId", "==", adId)
                .orderBy("metadata.generatedAt", "desc")
                .get();

            latestReport = reportSnap.docs
                .map(d => d.data())
                .find(d =>
                    d.metadata?.capability !== "variations_copy" &&
                    d.output?.diagnosis
                ) || null;
        } catch (reportError: any) {
            console.warn("[Creative Detail] AI Report fetch failed (non-fatal):", reportError.message);
        }

        // 5. Enrichment: Media URLs & Metadata
        const mediaMap = await fetchMetaMediaForAds([adId]);
        const media = mediaMap.get(adId);

        if (media?.videoId) {
            creativeData.creative.format = "VIDEO";
        }

        // Calculate Score IA & Reasons
        const maxSpend = Math.max(...snapshot.metricsByCreative.map(m => m.spend), 1);
        const maxImpressions = Math.max(...snapshot.metricsByCreative.map(m => m.impressions), 1);
        const avgCpa = snapshot.metricsByCreative.reduce((s, m) => s + m.cpa, 0) /
            snapshot.metricsByCreative.length || 1;
        const reference = { maxSpend, maxImpressions, avgCpa };

        const { score, reasons } = scoreCreative(kpis, reference, creativeData);

        return NextResponse.json({
            creative: creativeData,
            kpis: {
                ...kpis,
                headline: media?.headline || kpis.headline,
                primaryText: media?.primaryText || kpis.primaryText,
                imageUrl: media?.imageUrl,
                videoUrl: media?.videoUrl,
                videoId: media?.videoId,
                previewUrl: media?.previewUrl
            },
            score,
            reasons,
            cluster: {
                size: clusterSnap.size || 1,
                totalSpend: snapshot.metricsByCreative
                    .filter(m => {
                        if (clusterSnap.size > 0) {
                            return clusterSnap.docs.some(d => (d.data() as MetaCreativeDoc).ad.id === m.adId);
                        }
                        return m.adId === adId;
                    })
                    .reduce((sum, m) => sum + m.spend, 0),
                members: clusterMembers
            },
            aiReport: latestReport,
            imageUrl: media?.imageUrl,
            videoUrl: media?.videoUrl,
            videoId: media?.videoId,
            previewUrl: media?.previewUrl
        });

    } catch (error: any) {
        console.error("[Creative Detail] Error:", error);

        if (error.code === 9 || error.message?.toLowerCase().includes("index")) {
            return NextResponse.json({
                error: "Missing Firestore index",
                message: "Please create the required composite index for this query",
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
