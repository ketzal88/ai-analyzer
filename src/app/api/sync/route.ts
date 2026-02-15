import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/error-reporter";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

/**
 * Helper to fetch with simple retry/backoff
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response.json();

            const errorData = await response.json();
            console.error(`Meta API Error (Attempt ${i + 1}):`, errorData);
            if (i === retries - 1) {
                reportError("API Sync Meta API", new Error(JSON.stringify(errorData)), { metadata: { url, attempt: i + 1 } });
            }

            // If rate limited, wait longer
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

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const range = searchParams.get("range") || "last_14d";

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        if (!META_ACCESS_TOKEN) {
            return NextResponse.json({ error: "Meta API Token not configured" }, { status: 500 });
        }

        // 1. Auth check
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await auth.verifySessionCookie(sessionCookie);

        // 2. Load client info from Firestore
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const clientData = clientDoc.data();

        if (!clientData?.active) {
            return NextResponse.json({ error: "Client is inactive. Sychronization disabled." }, { status: 403 });
        }

        const metaAdAccountId = clientData.metaAdAccountId;
        if (!metaAdAccountId) {
            return NextResponse.json({ error: "Client has no Meta Ad Account ID configured." }, { status: 400 });
        }

        const cleanAdAccountId = metaAdAccountId.startsWith("act_") ? metaAdAccountId : `act_${metaAdAccountId}`;

        // 3. Record start of sync
        const syncRunRef = await db.collection("sync_runs").add({
            clientId,
            status: "running",
            range,
            startedAt: new Date().toISOString(),
            campaignsProcessed: 0
        });

        console.log(`Starting sync for client ${clientId} (Meta ID: ${cleanAdAccountId}). Range: ${range}`);

        // 4. Call Meta Insights API
        const fields = "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,reach,frequency,cpm";
        const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${cleanAdAccountId}/insights?level=campaign&time_increment=1&date_preset=${range}&fields=${fields}&access_token=${META_ACCESS_TOKEN}`;

        const insightsData = await fetchWithRetry(insightsUrl);
        const rawInsights = insightsData.data || [];

        // 5. Normalize and Upsert
        const batch = db.batch();
        let processedCount = 0;

        for (const item of rawInsights) {
            const date = item.date_start;
            const campaignId = item.campaign_id;
            const campaignName = item.campaign_name;
            const docId = `${clientId}_${campaignId}_${date}`;

            // Extract actions
            const getAction = (type: string) => Number(item.actions?.find((a: any) => a.action_type === type)?.value || 0);
            const getActionValue = (type: string) => Number(item.action_values?.find((a: any) => a.action_type === type)?.value || 0);

            const purchases = getAction("purchase") || getAction("offsite_conversion.fb_pixel_purchase");
            const purchaseValue = getActionValue("purchase") || getActionValue("offsite_conversion.fb_pixel_purchase");

            const spend = Number(item.spend || 0);
            const impressions = Number(item.impressions || 0);
            const clicks = Number(item.clicks || 0);

            const insightDoc = {
                clientId,
                campaignId,
                campaignName,
                date,
                spend,
                impressions,
                clicks,
                reach: Number(item.reach || 0),
                frequency: Number(item.frequency || 0),
                cpm: Number(item.cpm || 0),
                purchases,
                purchaseValue,
                rawActions: item.actions || [],
                rawActionValues: item.action_values || [],
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                roas: spend > 0 ? purchaseValue / spend : 0,
                cpa: purchases > 0 ? spend / purchases : 0,
                updatedAt: new Date().toISOString()
            };

            const docRef = db.collection("insights_daily").doc(docId);
            batch.set(docRef, insightDoc, { merge: true });
            processedCount++;
        }

        await batch.commit();

        // 6. Complete sync run
        await syncRunRef.update({
            status: "completed",
            completedAt: new Date().toISOString(),
            campaignsProcessed: processedCount
        });

        return NextResponse.json({
            success: true,
            syncRunId: syncRunRef.id,
            campaignsProcessed: processedCount
        });

    } catch (error: any) {
        reportError("API Sync (Fatal)", error, { metadata: { clientId: new URL(request.url).searchParams.get('clientId') } });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
