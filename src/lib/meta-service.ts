import { db } from "@/lib/firebase-admin";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

/**
 * Fetch insights from Meta Marketing API
 */
export async function fetchMetaInsights(adAccountId: string, accessToken: string, range: string) {
    // Handling "act_" prefix
    const cleanId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    const fields = "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,reach,frequency,cpm";
    const url = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/insights?level=campaign&time_increment=1&date_preset=${range}&fields=${fields}&access_token=${accessToken}`;

    // Simple fetch with 1 retry (simplified for service)
    let res = await fetch(url);
    if (!res.ok && res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        res = await fetch(url);
    }

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Meta API Error: ${JSON.stringify(err)}`);
    }

    return await res.json();
}

/**
 * Process and store insights into Firestore
 */
export async function storeInsights(clientId: string, rawInsights: any[]) {
    const batch = db.batch();
    let processedCount = 0;

    for (const item of rawInsights) {
        const date = item.date_start;
        const campaignId = item.campaign_id;
        const docId = `${clientId}_${campaignId}_${date}`;

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
            campaignName: item.campaign_name,
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
    return processedCount;
}

/**
 * High-level Sync Function
 */
export async function syncClientInsights(clientId: string, metaAdAccountId: string, range: string) {
    if (!META_ACCESS_TOKEN) throw new Error("Meta Access Token missing");

    const data = await fetchMetaInsights(metaAdAccountId, META_ACCESS_TOKEN, range);
    const count = await storeInsights(clientId, data.data || []);

    return count;
}
