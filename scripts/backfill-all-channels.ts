/**
 * Unified Q1 Backfill — All Channels, All Clients
 *
 * Iterates every active client and syncs ALL connected channels
 * (Meta, Google, Ecommerce, Email) from Jan 1 to yesterday.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/backfill-all-channels.ts
 *
 * Optional:
 *   npx tsx --require ./scripts/load-env.cjs scripts/backfill-all-channels.ts [clientId]
 *   (Run only for a specific client)
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { GoogleAdsService } from "@/lib/google-ads-service";
import { ShopifyService } from "@/lib/shopify-service";
import { TiendaNubeService } from "@/lib/tiendanube-service";
import { WooCommerceService } from "@/lib/woocommerce-service";
import { KlaviyoService } from "@/lib/klaviyo-service";
import { PerfitService } from "@/lib/perfit-service";
import { ChannelDailySnapshot, buildChannelSnapshotId } from "@/types/channel-snapshots";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const TARGET_CLIENT_ID = process.argv[2] || "";

// Date range: Jan 1 to yesterday
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const START_DATE = "2026-01-01";
const END_DATE = yesterday.toISOString().split("T")[0];

interface SyncResult {
    channel: string;
    status: "success" | "skipped" | "error";
    details?: string;
    error?: string;
}

// ─── Meta Sync ─────────────────────────────────────────────

interface MetaInsightRow {
    date_start: string;
    spend: string;
    impressions: string;
    clicks: string;
    reach: string;
    frequency: string;
    ctr: string;
    cpc: string;
    cpm: string;
    cpp: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
    cost_per_action_type?: Array<{ action_type: string; value: string }>;
    inline_link_clicks?: string;
    inline_link_click_ctr?: string;
    cost_per_inline_link_click?: string;
    unique_clicks?: string;
    outbound_clicks?: any;
    quality_ranking?: string;
    engagement_rate_ranking?: string;
    conversion_rate_ranking?: string;
    video_play_actions?: Array<{ value: string }>;
    video_p25_watched_actions?: Array<{ value: string }>;
    video_p50_watched_actions?: Array<{ value: string }>;
    video_p75_watched_actions?: Array<{ value: string }>;
    video_p100_watched_actions?: Array<{ value: string }>;
    video_30_sec_watched_actions?: Array<{ value: string }>;
    video_avg_time_watched_actions?: Array<{ value: string }>;
}

function getAction(actions: MetaInsightRow["actions"], type: string): number {
    return Number(actions?.find(a => a.action_type === type)?.value || 0);
}
function getActionValue(vals: MetaInsightRow["action_values"], type: string): number {
    return Number(vals?.find(a => a.action_type === type)?.value || 0);
}

async function syncMeta(clientId: string, adAccountId: string): Promise<SyncResult> {
    if (!META_ACCESS_TOKEN) return { channel: "META", status: "skipped", details: "No META_ACCESS_TOKEN" };

    const cleanId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const fields = [
        "spend", "impressions", "clicks", "reach", "frequency", "ctr", "cpc", "cpm", "cpp",
        "actions", "action_values", "cost_per_action_type",
        "inline_link_clicks", "inline_link_click_ctr", "outbound_clicks", "cost_per_inline_link_click",
        "unique_clicks", "unique_inline_link_clicks",
        "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
        "video_play_actions", "video_p25_watched_actions", "video_p50_watched_actions",
        "video_p75_watched_actions", "video_p100_watched_actions",
        "video_30_sec_watched_actions", "video_avg_time_watched_actions",
    ].join(",");
    const timeRange = JSON.stringify({ since: START_DATE, until: END_DATE });

    let allRows: MetaInsightRow[] = [];
    let url: string | null = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/insights?level=account&time_increment=1&time_range=${encodeURIComponent(timeRange)}&fields=${fields}&limit=500&access_token=${META_ACCESS_TOKEN}`;

    while (url) {
        const res: Response = await fetch(url);
        if (!res.ok) {
            const err: any = await res.json();
            return { channel: "META", status: "error", error: JSON.stringify(err.error?.message || err) };
        }
        const json: any = await res.json();
        allRows = allRows.concat(json.data || []);
        url = json.paging?.next || null;
    }

    if (allRows.length === 0) return { channel: "META", status: "success", details: "0 days (no data)" };

    // Write in batches
    let written = 0;
    for (let i = 0; i < allRows.length; i += 400) {
        const chunk = allRows.slice(i, i + 400);
        const batch = db.batch();
        for (const row of chunk) {
            const spend = Number(row.spend || 0);
            const impressions = Number(row.impressions || 0);
            const clicks = Number(row.clicks || 0);
            const purchases = getAction(row.actions, "purchase") || getAction(row.actions, "offsite_conversion.fb_pixel_purchase");
            const revenue = getActionValue(row.action_values, "purchase") || getActionValue(row.action_values, "offsite_conversion.fb_pixel_purchase");
            const leads = getAction(row.actions, "lead") || getAction(row.actions, "offsite_conversion.fb_pixel_lead");
            const messages = getAction(row.actions, "onsite_conversion.messaging_first_reply");
            const conversions = purchases || leads || messages || 0;
            const getCostPerAct = (type: string) => Number(row.cost_per_action_type?.find(a => a.action_type === type)?.value || 0);
            const getVideoAct = (field: string) => Number((row as any)[field]?.[0]?.value || 0);

            const addToCart = getAction(row.actions, "offsite_conversion.fb_pixel_add_to_cart") || getAction(row.actions, "add_to_cart");
            const initiateCheckout = getAction(row.actions, "offsite_conversion.fb_pixel_initiate_checkout") || getAction(row.actions, "initiate_checkout");
            const viewContent = getAction(row.actions, "offsite_conversion.fb_pixel_view_content") || getAction(row.actions, "view_content");

            const snapshot: ChannelDailySnapshot = {
                clientId,
                channel: "META",
                date: row.date_start,
                metrics: {
                    spend, revenue, conversions, impressions, clicks,
                    ctr: Number(row.ctr || 0),
                    cpc: Number(row.cpc || 0),
                    cpm: Number(row.cpm || 0),
                    cpp: Number(row.cpp || 0),
                    roas: spend > 0 ? revenue / spend : 0,
                    cpa: conversions > 0 ? spend / conversions : 0,
                    reach: Number(row.reach || 0),
                    frequency: Number(row.frequency || 0),
                    inlineLinkClicks: Number(row.inline_link_clicks || 0),
                    inlineLinkClickCtr: Number(row.inline_link_click_ctr || 0),
                    costPerInlineLinkClick: Number(row.cost_per_inline_link_click || 0),
                    uniqueClicks: Number(row.unique_clicks || 0),
                    outboundClicks: Number(row.outbound_clicks?.[0]?.value || row.outbound_clicks || 0),
                    addToCart: addToCart || undefined,
                    initiateCheckout: initiateCheckout || undefined,
                    viewContent: viewContent || undefined,
                    costPerAddToCart: addToCart > 0 ? getCostPerAct("offsite_conversion.fb_pixel_add_to_cart") || getCostPerAct("add_to_cart") : undefined,
                    costPerInitiateCheckout: initiateCheckout > 0 ? getCostPerAct("offsite_conversion.fb_pixel_initiate_checkout") || getCostPerAct("initiate_checkout") : undefined,
                    qualityRanking: row.quality_ranking || undefined,
                    engagementRateRanking: row.engagement_rate_ranking || undefined,
                    conversionRateRanking: row.conversion_rate_ranking || undefined,
                    videoPlays: getVideoAct("video_play_actions") || undefined,
                    videoP25: getVideoAct("video_p25_watched_actions") || undefined,
                    videoP50: getVideoAct("video_p50_watched_actions") || undefined,
                    videoP75: getVideoAct("video_p75_watched_actions") || undefined,
                    videoP100: getVideoAct("video_p100_watched_actions") || undefined,
                    video30sViews: getVideoAct("video_30_sec_watched_actions") || undefined,
                    videoAvgWatchTime: getVideoAct("video_avg_time_watched_actions") || undefined,
                },
                syncedAt: new Date().toISOString(),
            };
            const docId = buildChannelSnapshotId(clientId, "META", row.date_start);
            batch.set(db.collection("channel_snapshots").doc(docId), snapshot, { merge: true });
        }
        await batch.commit();
        written += chunk.length;
    }

    const totalSpend = allRows.reduce((s, r) => s + Number(r.spend || 0), 0);
    return { channel: "META", status: "success", details: `${written} days, $${totalSpend.toFixed(0)} spend` };
}

// ─── Google Sync ───────────────────────────────────────────

async function syncGoogle(clientId: string, googleAdsId: string): Promise<SyncResult> {
    const result = await GoogleAdsService.syncToChannelSnapshots(clientId, googleAdsId, START_DATE, END_DATE);
    return { channel: "GOOGLE", status: "success", details: `${result.daysWritten} days, $${result.totalSpend.toFixed(0)} spend` };
}

// ─── Ecommerce Sync ────────────────────────────────────────

async function syncEcommerce(clientId: string, client: Client): Promise<SyncResult> {
    const platform = client.integraciones?.ecommerce;
    if (!platform) return { channel: "ECOMMERCE", status: "skipped", details: "No ecommerce integration" };

    if (platform === "shopify" && client.shopifyStoreDomain && client.shopifyAccessToken) {
        const r = await ShopifyService.syncToChannelSnapshots(clientId, client.shopifyStoreDomain, client.shopifyAccessToken, START_DATE, END_DATE);
        return { channel: "ECOMMERCE (Shopify)", status: "success", details: `${r.daysWritten} days, ${r.totalOrders} orders, $${r.totalRevenue.toFixed(0)} rev` };
    }

    if (platform === "tiendanube" && client.tiendanubeStoreId && client.tiendanubeAccessToken) {
        const r = await TiendaNubeService.syncToChannelSnapshots(clientId, client.tiendanubeStoreId, client.tiendanubeAccessToken, START_DATE, END_DATE);
        return { channel: "ECOMMERCE (TiendaNube)", status: "success", details: `${r.daysWritten} days, ${r.totalOrders} orders, $${r.totalRevenue.toFixed(0)} rev` };
    }

    if (platform === "woocommerce" && client.woocommerceStoreDomain && client.woocommerceConsumerKey && client.woocommerceConsumerSecret) {
        const r = await WooCommerceService.syncToChannelSnapshots(clientId, client.woocommerceStoreDomain, client.woocommerceConsumerKey, client.woocommerceConsumerSecret, START_DATE, END_DATE);
        return { channel: "ECOMMERCE (WooCommerce)", status: "success", details: `${r.daysWritten} days, ${r.totalOrders} orders, $${r.totalRevenue.toFixed(0)} rev` };
    }

    return { channel: "ECOMMERCE", status: "skipped", details: `Platform ${platform} configured but missing credentials` };
}

// ─── Email Sync ────────────────────────────────────────────

async function syncEmail(clientId: string, client: Client): Promise<SyncResult> {
    const platform = client.integraciones?.email;
    if (!platform) return { channel: "EMAIL", status: "skipped", details: "No email integration" };

    if (platform === "klaviyo" && client.klaviyoApiKey) {
        const r = await KlaviyoService.syncToChannelSnapshots(clientId, client.klaviyoApiKey, START_DATE, END_DATE);
        return { channel: "EMAIL (Klaviyo)", status: "success", details: `${r.daysWritten} days, ${r.totalSent} sent` };
    }

    if (platform === "perfit" && client.perfitApiKey) {
        const r = await PerfitService.syncToChannelSnapshots(clientId, client.perfitApiKey, START_DATE, END_DATE);
        return { channel: "EMAIL (Perfit)", status: "success", details: `${r.daysWritten} days, ${r.totalSent} sent` };
    }

    return { channel: "EMAIL", status: "skipped", details: `Platform ${platform} configured but missing credentials` };
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
    console.log("=".repeat(70));
    console.log("  BACKFILL ALL CHANNELS — Q1 2026");
    console.log("  Date range: " + START_DATE + " -> " + END_DATE);
    console.log("=".repeat(70));

    // Get clients
    let clientDocs;
    if (TARGET_CLIENT_ID) {
        const doc = await db.collection("clients").doc(TARGET_CLIENT_ID).get();
        if (!doc.exists) { console.error(`Client ${TARGET_CLIENT_ID} not found`); process.exit(1); }
        clientDocs = [doc];
    } else {
        const snap = await db.collection("clients").where("active", "==", true).get();
        clientDocs = snap.docs;
    }

    console.log(`\nFound ${clientDocs.length} client(s) to process\n`);

    const allResults: Array<{ clientName: string; clientId: string; results: SyncResult[] }> = [];

    for (const doc of clientDocs) {
        const client = doc.data() as Client;
        const clientId = doc.id;
        const results: SyncResult[] = [];

        console.log("\n" + "-".repeat(60));
        console.log(`  ${client.name} (${clientId})`);
        console.log("-".repeat(60));

        // 1. Meta
        if (client.metaAdAccountId && client.integraciones?.meta) {
            console.log("  [META] Syncing...");
            try {
                const r = await syncMeta(clientId, client.metaAdAccountId);
                console.log(`  [META] ${r.status}: ${r.details || r.error || ""}`);
                results.push(r);
            } catch (err: any) {
                console.error(`  [META] ERROR: ${err.message}`);
                results.push({ channel: "META", status: "error", error: err.message });
            }
        } else {
            console.log("  [META] skipped (no integration)");
            results.push({ channel: "META", status: "skipped", details: "No Meta integration" });
        }

        // 2. Google
        if (client.googleAdsId && client.integraciones?.google) {
            console.log("  [GOOGLE] Syncing...");
            try {
                const r = await syncGoogle(clientId, client.googleAdsId);
                console.log(`  [GOOGLE] ${r.status}: ${r.details || r.error || ""}`);
                results.push(r);
            } catch (err: any) {
                console.error(`  [GOOGLE] ERROR: ${err.message}`);
                results.push({ channel: "GOOGLE", status: "error", error: err.message });
            }
        } else {
            console.log("  [GOOGLE] skipped (no integration)");
            results.push({ channel: "GOOGLE", status: "skipped" });
        }

        // 3. Ecommerce
        console.log(`  [ECOMMERCE] Syncing (${client.integraciones?.ecommerce || "none"})...`);
        try {
            const r = await syncEcommerce(clientId, client);
            console.log(`  [ECOMMERCE] ${r.status}: ${r.details || r.error || ""}`);
            results.push(r);
        } catch (err: any) {
            console.error(`  [ECOMMERCE] ERROR: ${err.message}`);
            results.push({ channel: "ECOMMERCE", status: "error", error: err.message });
        }

        // 4. Email
        console.log(`  [EMAIL] Syncing (${client.integraciones?.email || "none"})...`);
        try {
            const r = await syncEmail(clientId, client);
            console.log(`  [EMAIL] ${r.status}: ${r.details || r.error || ""}`);
            results.push(r);
        } catch (err: any) {
            console.error(`  [EMAIL] ERROR: ${err.message}`);
            results.push({ channel: "EMAIL", status: "error", error: err.message });
        }

        allResults.push({ clientName: client.name, clientId, results });
    }

    // Summary
    console.log("\n\n" + "=".repeat(70));
    console.log("  SUMMARY");
    console.log("=".repeat(70));

    for (const { clientName, clientId, results } of allResults) {
        const successes = results.filter(r => r.status === "success").length;
        const errors = results.filter(r => r.status === "error").length;
        const skipped = results.filter(r => r.status === "skipped").length;
        console.log(`\n  ${clientName} (${clientId}): ${successes} synced, ${skipped} skipped, ${errors} errors`);
        for (const r of results) {
            const icon = r.status === "success" ? "OK" : r.status === "skipped" ? "--" : "!!";
            console.log(`    [${icon}] ${r.channel}: ${r.details || r.error || r.status}`);
        }
    }

    console.log("\n" + "=".repeat(70));
    console.log("  DONE!");
    console.log("=".repeat(70));
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
