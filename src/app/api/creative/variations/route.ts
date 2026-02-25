import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { generateCreativeVariations } from "@/lib/creative-analysis-service";
import { withErrorReporting } from "@/lib/error-reporter";

export const POST = withErrorReporting("API Creative Variations", async (request: NextRequest) => {
    try {
        const isDev = process.env.NODE_ENV === "development";
        const sessionCookie = request.cookies.get("session")?.value;

        if (!isDev && !sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { clientId, adId, objective, checkOnly } = body;
        let { range } = body;

        if (!clientId || !adId) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        // Handle range preset (e.g. "last_14d")
        if (typeof range === "string" || !range) {
            const preset = typeof range === "string" ? range : "last_14d";
            const today = new Date();
            const end = new Date(today);
            let days = 14;
            if (preset === "last_7d") days = 7;
            else if (preset === "last_30d") days = 30;

            const start = new Date(today);
            start.setDate(today.getDate() - days + 1);

            range = {
                start: start.toISOString().split("T")[0],
                end: end.toISOString().split("T")[0]
            };
        }

        // 1. Fetch Creative and KPIs for detailed prompt
        const creativeSnap = await db.collection("meta_creatives").doc(`${clientId}__${adId}`).get();
        if (!creativeSnap.exists) return NextResponse.json({ error: "Creative not found" }, { status: 404 });
        const creative = creativeSnap.data();

        // Fetch KPIs from snapshots
        const kpiSnap = await db.collection("creative_kpi_snapshots")
            .where("clientId", "==", clientId)
            .where("adId", "==", adId)
            .where("rangeKey", "==", `${range.start}_${range.end}`)
            .limit(1)
            .get();

        const kpis = kpiSnap.empty ? { roas: 0, cpa: 0, spend: 0 } : kpiSnap.docs[0].data().metrics;

        // 2. Fetch or Generate
        // If checkOnly is true, we ONLY check the cache (handled by the service if we wrap it or just handle here)
        // Actually, let's just do a manual cache check here if checkOnly is true to avoid calling the full service logic

        if (checkOnly) {
            // Re-using the logic from the service but simplified for the API check
            const promptSnap = await db.collection("prompt_templates")
                .where("key", "==", "creative-variations")
                .where("status", "==", "active")
                .limit(1)
                .get();
            const promptId = promptSnap.empty ? "default" : promptSnap.docs[0].id;
            const rangeKey = `${range.start}_${range.end}`;
            const reportId = `${clientId}__${adId}__${rangeKey}__${promptId}`;

            const cacheSnap = await db.collection("creative_ai_reports").doc(reportId).get();
            if (cacheSnap.exists) {
                const data = cacheSnap.data()!;
                // Only return if it actually has variations (avoiding bad cache)
                if (data.variations && Array.isArray(data.variations) && data.variations.length > 0) {
                    return NextResponse.json({ report: data });
                }
            }
            return NextResponse.json({ report: null });
        }

        const report = await generateCreativeVariations(clientId, { ad: { id: adId }, ...creative }, kpis, range, objective);

        return NextResponse.json({ report });
    } catch (error: any) {
        console.error("[API Variations] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
