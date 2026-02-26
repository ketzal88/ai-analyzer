import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { generateCreativeAudit } from "@/lib/creative-analysis-service";
import { calculateCreativeKPISnapshot } from "@/lib/creative-kpi-service";
import { MetaCreativeDoc } from "@/types/meta-creative";
import { DailyEntitySnapshot } from "@/types/performance-snapshots";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * AG-45: Trigger AI Audit for a specific creative
 * POST /api/creative/analyze
 * Body: { clientId, adId, range }
 */
export const POST = withErrorReporting("API Creative Analyze", async (request: NextRequest) => {
    try {
        const isDev = process.env.NODE_ENV === "development";
        const sessionCookie = request.cookies.get("session")?.value;

        if (!isDev) {
            if (!sessionCookie) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            await auth.verifySessionCookie(sessionCookie);
        }

        const body = await request.json();
        const { clientId, adId, range = "last_14d" } = body;

        if (!clientId || !adId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch Creative and KPIs
        const creativeSnap = await db.collection("meta_creatives").doc(`${clientId}__${adId}`).get();
        let creative: MetaCreativeDoc;

        if (creativeSnap.exists) {
            creative = creativeSnap.data() as MetaCreativeDoc;
        } else {
            // Fallback: reconstruct from daily_entity_snapshots
            const adSnapQuery = await db.collection("daily_entity_snapshots")
                .where("clientId", "==", clientId)
                .where("level", "==", "ad")
                .where("entityId", "==", adId)
                .get();

            if (adSnapQuery.empty) {
                return NextResponse.json({ error: "Creative not found" }, { status: 404 });
            }

            const adSnaps = adSnapQuery.docs
                .map(d => d.data() as DailyEntitySnapshot)
                .sort((a, b) => b.date.localeCompare(a.date));
            const adSnap = adSnaps[0];

            creative = {
                clientId,
                metaAccountId: "unknown",
                status: "ACTIVE",
                effectiveStatus: "ACTIVE",
                lastSeenActiveAt: adSnap.date,
                firstSeenAt: adSnap.date,
                updatedAt: new Date().toISOString(),
                campaign: {
                    id: adSnap.meta?.campaignId || "",
                    name: adSnap.meta?.campaignId || "Unknown",
                    objective: "CONVERSIONS",
                    buyingType: "AUCTION"
                },
                adset: {
                    id: adSnap.meta?.adsetId || "",
                    name: adSnap.meta?.adsetId || "Unknown",
                    optimizationGoal: "OFFSITE_CONVERSIONS",
                    billingEvent: "IMPRESSIONS"
                },
                ad: { id: adId, name: adSnap.name || adId },
                creative: {
                    id: adId,
                    format: "IMAGE",
                    isDynamicProductAd: false,
                    hasCatalog: false,
                    assets: {}
                },
                fingerprint: adId
            } as MetaCreativeDoc;
        }

        const snapshot = await calculateCreativeKPISnapshot(clientId, range);
        const kpis = snapshot.metricsByCreative.find(m => m.adId === adId);

        if (!kpis) {
            return NextResponse.json({ error: "KPIs not available for this range" }, { status: 400 });
        }

        // 2. Generate Audit
        const report = await generateCreativeAudit(clientId, creative, kpis, snapshot.range);

        return NextResponse.json({
            ok: true,
            report
        });

    } catch (error: any) {
        console.error("[Creative Analyze] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
