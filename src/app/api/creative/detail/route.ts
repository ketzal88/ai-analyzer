import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { calculateCreativeKPISnapshot } from "@/lib/creative-kpi-service";
import { MetaCreativeDoc } from "@/types/meta-creative";
import { CreativeKPIMetrics } from "@/types/creative-kpi";

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

        // 1. Fetch Creative Metadata
        const creativeDocId = `${clientId}__${adId}`;
        const creativeSnap = await db.collection("meta_creatives").doc(creativeDocId).get();
        if (!creativeSnap.exists) {
            return NextResponse.json({ error: "Creative not found" }, { status: 404 });
        }
        const creativeData = creativeSnap.data() as MetaCreativeDoc;

        // 2. Fetch KPIs for the range
        // Re-use snapshot logic to get standardized KPIs
        const snapshot = await calculateCreativeKPISnapshot(clientId, range);
        const kpis = snapshot.metricsByCreative.find(m => m.adId === adId) || {
            adId,
            creativeId: creativeData.creative.id,
            fingerprint: creativeData.fingerprint,
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

        // 3. Fetch Cluster Information (Ads with same fingerprint)
        const clusterSnap = await db.collection("meta_creatives")
            .where("clientId", "==", clientId)
            .where("fingerprint", "==", creativeData.fingerprint)
            .get();

        const clusterMembers = clusterSnap.docs
            .map(doc => doc.data() as MetaCreativeDoc)
            .filter(doc => doc.ad.id !== adId)
            .map(doc => ({
                adId: doc.ad.id,
                adName: doc.ad.name,
                campaignName: doc.campaign.name
            }));

        // 4. Check for existing AI Report (wrapped in try-catch to handle missing index gracefully)
        let latestReport = null;
        try {
            const reportSnap = await db.collection("creative_ai_reports")
                .where("clientId", "==", clientId)
                .where("adId", "==", adId)
                .orderBy("metadata.generatedAt", "desc")
                .limit(1)
                .get();

            latestReport = !reportSnap.empty ? reportSnap.docs[0].data() : null;
        } catch (reportError: any) {
            console.warn("[Creative Detail] AI Report fetch failed (likely missing index):", reportError.message);
            // We don't throw here to allow the main creative data to be returned
        }

        return NextResponse.json({
            creative: creativeData,
            kpis,
            cluster: {
                size: clusterSnap.size,
                totalSpend: snapshot.metricsByCreative
                    .filter(m => clusterSnap.docs.some(d => (d.data() as MetaCreativeDoc).ad.id === m.adId))
                    .reduce((sum, m) => sum + m.spend, 0),
                members: clusterMembers
            },
            aiReport: latestReport
        });

    } catch (error: any) {
        console.error("[Creative Detail] Error:", error);

        // Handle missing index error for the overall request if it happens elsewhere
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
