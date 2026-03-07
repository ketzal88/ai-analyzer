import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { MetaCreativeDoc } from "@/types/meta-creative";
import { Client } from "@/types";
import { getCurrentQuarter, buildObjectiveId } from "@/types/semaforo";

const ARS_TO_USD = 1500;
const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";

/**
 * GET /api/meta/media-mix?clientId=xxx
 *
 * Returns active ad count by format + recommended ads calculation.
 * Data source: meta_creatives collection first, falls back to live Meta API.
 * Formula: recommendedAds = (monthlySpendUSD / 1000) * 20
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    try {
        // 1. Get client config
        const clientDoc = await db.collection("clients").doc(clientId).get();
        const clientData = clientDoc.data() as Client | undefined;
        const currency = clientData?.currency || "USD";
        const metaAdAccountId = clientData?.metaAdAccountId;

        // 2. Count active creatives by format — try meta_creatives first, fallback to Meta API
        const byFormat: Record<string, number> = {
            VIDEO: 0,
            IMAGE: 0,
            CAROUSEL: 0,
            CATALOG: 0,
        };
        let totalActive = 0;

        const creativesSnap = await db.collection("meta_creatives")
            .where("clientId", "==", clientId)
            .where("status", "==", "ACTIVE")
            .get();

        if (creativesSnap.size > 0) {
            // Use cached data from meta_creatives
            for (const doc of creativesSnap.docs) {
                const data = doc.data() as MetaCreativeDoc;
                const format = data.creative?.format || "IMAGE";
                byFormat[format] = (byFormat[format] || 0) + 1;
            }
            totalActive = creativesSnap.size;
        } else if (metaAdAccountId && META_ACCESS_TOKEN) {
            // Fallback: fetch live from Meta API
            const liveResult = await fetchLiveMediaMix(metaAdAccountId);
            totalActive = liveResult.totalActive;
            Object.assign(byFormat, liveResult.byFormat);
        }

        // 3. Get monthly spend reference:
        //    Priority 1: Meta spend target from quarterly_objectives (channelGoals.META.spend)
        //    Priority 2: Last full month actual spend from channel_snapshots
        const now = new Date();
        let monthlySpend = 0;
        let spendSource: "objective" | "last_month" = "last_month";

        // Try quarterly objective first
        const { quarter } = getCurrentQuarter(now);
        const objectiveId = buildObjectiveId(clientId, quarter);
        const objectiveDoc = await db.collection("quarterly_objectives").doc(objectiveId).get();

        if (objectiveDoc.exists) {
            const objective = objectiveDoc.data();
            const metaSpendTarget = (objective?.channelGoals?.META as Record<string, { target: number }> | undefined)?.spend?.target;
            const globalSpendTarget = (objective?.goals as Record<string, { target: number }> | undefined)?.spend?.target;

            if (metaSpendTarget && metaSpendTarget > 0) {
                // Quarterly target → divide by months in quarter (4 months for cuatrimestres)
                monthlySpend = metaSpendTarget / 4;
                spendSource = "objective";
            } else if (globalSpendTarget && globalSpendTarget > 0) {
                monthlySpend = globalSpendTarget / 4;
                spendSource = "objective";
            }
        }

        // Fallback: last full month actual spend
        if (monthlySpend === 0) {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;
            const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
            const lastMonthEndStr = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, "0")}-${String(lastMonthEnd.getDate()).padStart(2, "0")}`;

            const snapshotsSnap = await db.collection("channel_snapshots")
                .where("clientId", "==", clientId)
                .where("channel", "==", "META")
                .where("date", ">=", lastMonthStart)
                .where("date", "<=", lastMonthEndStr)
                .get();

            for (const doc of snapshotsSnap.docs) {
                const data = doc.data();
                monthlySpend += data.metrics?.spend || 0;
            }
        }

        // 4. Convert to USD
        const monthlySpendUSD = currency === "ARS" ? monthlySpend / ARS_TO_USD : monthlySpend;

        // 5. Calculate recommendations based on spend reference
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
            spendSource,
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

/**
 * Fetch active ads from Meta API and classify by format.
 * Lightweight version — only fetches fields needed for format detection.
 */
async function fetchLiveMediaMix(adAccountId: string) {
    const cleanId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const fields = [
        "id",
        "effective_status",
        "campaign{effective_status}",
        "adset{effective_status,promoted_object}",
        "creative{id,object_story_spec,asset_feed_spec}",
    ].join(",");

    const byFormat: Record<string, number> = {
        VIDEO: 0,
        IMAGE: 0,
        CAROUSEL: 0,
        CATALOG: 0,
    };
    let totalActive = 0;

    const params = new URLSearchParams({
        fields,
        effective_status: JSON.stringify(["ACTIVE"]),
        limit: "100",
        access_token: META_ACCESS_TOKEN,
    });

    let url: string | null = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/ads?${params.toString()}`;
    let pages = 0;

    while (url && pages < 20) {
        pages++;
        const res = await fetch(url);
        if (!res.ok) break;

        const data = await res.json();
        const ads = data.data || [];

        for (const ad of ads) {
            // Only count truly active (campaign + adset + ad all ACTIVE)
            if (ad.campaign?.effective_status !== "ACTIVE") continue;
            if (ad.adset?.effective_status !== "ACTIVE") continue;

            totalActive++;
            const format = detectFormat(ad);
            byFormat[format] = (byFormat[format] || 0) + 1;
        }

        url = data.paging?.next || null;
    }

    return { totalActive, byFormat };
}

/** Detect ad format from Meta API creative fields */
function detectFormat(ad: any): string {
    const creative = ad.creative || {};
    const objectStorySpec = creative.object_story_spec || {};
    const assetFeedSpec = creative.asset_feed_spec || {};
    const linkData = objectStorySpec.link_data || {};
    const videoData = objectStorySpec.video_data || {};

    if (assetFeedSpec.videos?.length > 0 || videoData.video_id) return "VIDEO";
    if (assetFeedSpec.link_urls?.length > 1 || linkData.child_attachments?.length > 0) return "CAROUSEL";
    if (ad.adset?.promoted_object?.catalog_id || assetFeedSpec.product_set_id) return "CATALOG";
    return "IMAGE";
}
