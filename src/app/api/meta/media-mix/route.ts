import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { MetaCreativeDoc } from "@/types/meta-creative";
import { Client } from "@/types";

const ARS_TO_USD = 1500;

/**
 * GET /api/meta/media-mix?clientId=xxx
 *
 * Returns active ad count by format + recommended ads calculation.
 * Data source: meta_creatives collection (updated daily by sync-creatives).
 * Formula: recommendedAds = (monthlySpendUSD / 1000) * 20
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    try {
        // 1. Count active creatives by format
        const creativesSnap = await db.collection("meta_creatives")
            .where("clientId", "==", clientId)
            .where("status", "==", "ACTIVE")
            .get();

        const byFormat: Record<string, number> = {
            VIDEO: 0,
            IMAGE: 0,
            CAROUSEL: 0,
            CATALOG: 0,
        };

        for (const doc of creativesSnap.docs) {
            const data = doc.data() as MetaCreativeDoc;
            const format = data.creative?.format || "IMAGE";
            if (format in byFormat) {
                byFormat[format]++;
            } else {
                byFormat[format] = (byFormat[format] || 0) + 1;
            }
        }

        const totalActive = creativesSnap.size;

        // 2. Get current month spend from channel_snapshots
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const today = now.toISOString().split("T")[0];

        const snapshotsSnap = await db.collection("channel_snapshots")
            .where("clientId", "==", clientId)
            .where("channel", "==", "META")
            .where("date", ">=", monthStart)
            .where("date", "<=", today)
            .get();

        let monthlySpend = 0;
        for (const doc of snapshotsSnap.docs) {
            const data = doc.data();
            monthlySpend += data.metrics?.spend || 0;
        }

        // 3. Get client currency
        const clientDoc = await db.collection("clients").doc(clientId).get();
        const clientData = clientDoc.data() as Client | undefined;
        const currency = clientData?.currency || "USD";

        // 4. Convert to USD
        const monthlySpendUSD = currency === "ARS" ? monthlySpend / ARS_TO_USD : monthlySpend;

        // 5. Calculate recommendations based on actual spend
        const recommendedAds = Math.round((monthlySpendUSD / 1000) * 20);
        const adsToRotate = Math.ceil(recommendedAds * 0.20);
        const adsMissing = recommendedAds - totalActive;

        // 6. Calculate target-based recommendation (if revenue target + ROAS target exist)
        const targetRevenue = clientData?.targetSalesVolume;
        const targetRoasMeta = clientData?.targets?.roas_meta;
        let targetBased: {
            targetRevenue: number;
            targetRoas: number;
            neededSpendUSD: number;
            recommendedAds: number;
            adsToRotate: number;
            adsMissing: number;
        } | null = null;

        if (targetRevenue && targetRoasMeta && targetRoasMeta > 0) {
            const neededSpend = targetRevenue / targetRoasMeta;
            const neededSpendUSD = currency === "ARS" ? neededSpend / ARS_TO_USD : neededSpend;
            const targetRecommended = Math.round((neededSpendUSD / 1000) * 20);
            targetBased = {
                targetRevenue,
                targetRoas: targetRoasMeta,
                neededSpendUSD: Math.round(neededSpendUSD),
                recommendedAds: targetRecommended,
                adsToRotate: Math.ceil(targetRecommended * 0.20),
                adsMissing: targetRecommended - totalActive,
            };
        }

        return NextResponse.json({
            totalActive,
            byFormat,
            monthlySpend,
            monthlySpendUSD: Math.round(monthlySpendUSD),
            currency,
            recommendedAds,
            adsToRotate,
            adsMissing,
            targetBased,
        });
    } catch (error: any) {
        console.error("[API meta/media-mix] Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
