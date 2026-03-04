/**
 * Backfill Meta Ads → channel_snapshots
 *
 * Fetches account-level daily insights from Meta API and writes proper
 * daily channel_snapshots (same format as Google Ads, Ecommerce, Email).
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/sync-meta-channel-snapshots.ts
 *
 * Optional env: BACKFILL_MONTHS=3 (default 3)
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { ChannelDailySnapshot, buildChannelSnapshotId } from "@/types/channel-snapshots";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const BACKFILL_MONTHS = parseInt(process.env.BACKFILL_MONTHS || "3", 10);

interface MetaInsightRow {
    date_start: string;
    date_stop: string;
    spend: string;
    impressions: string;
    clicks: string;
    reach: string;
    frequency: string;
    cpm: string;
    ctr: string;
    cpc: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
}

function getAction(actions: MetaInsightRow["actions"], type: string): number {
    return Number(actions?.find(a => a.action_type === type)?.value || 0);
}

function getActionValue(actionValues: MetaInsightRow["action_values"], type: string): number {
    return Number(actionValues?.find(a => a.action_type === type)?.value || 0);
}

async function fetchAccountInsights(
    adAccountId: string,
    since: string,
    until: string
): Promise<MetaInsightRow[]> {
    const cleanId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const fields = "spend,impressions,clicks,reach,frequency,cpm,ctr,cpc,actions,action_values";
    const timeRange = JSON.stringify({ since, until });

    let allRows: MetaInsightRow[] = [];
    let url: string | null = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/insights?level=account&time_increment=1&time_range=${encodeURIComponent(timeRange)}&fields=${fields}&limit=500&access_token=${META_ACCESS_TOKEN}`;

    while (url) {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Meta API Error: ${JSON.stringify(err)}`);
        }
        const json = await res.json();
        allRows = allRows.concat(json.data || []);
        url = json.paging?.next || null;
    }

    return allRows;
}

function buildSnapshot(clientId: string, row: MetaInsightRow): ChannelDailySnapshot {
    const spend = Number(row.spend || 0);
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);

    const purchases = getAction(row.actions, "purchase")
        || getAction(row.actions, "offsite_conversion.fb_pixel_purchase");
    const revenue = getActionValue(row.action_values, "purchase")
        || getActionValue(row.action_values, "offsite_conversion.fb_pixel_purchase");

    // Also capture leads and messaging for non-ecommerce clients
    const leads = getAction(row.actions, "lead")
        || getAction(row.actions, "offsite_conversion.fb_pixel_lead");
    const messages = getAction(row.actions, "onsite_conversion.messaging_first_reply");

    const conversions = purchases || leads || messages || 0;

    return {
        clientId,
        channel: "META",
        date: row.date_start,
        metrics: {
            spend,
            revenue,
            conversions,
            impressions,
            clicks,
            ctr: Number(row.ctr || 0),
            cpc: Number(row.cpc || 0),
            roas: spend > 0 ? revenue / spend : 0,
            cpa: conversions > 0 ? spend / conversions : 0,
            reach: Number(row.reach || 0),
            frequency: Number(row.frequency || 0),
        },
        syncedAt: new Date().toISOString(),
    };
}

async function main() {
    if (!META_ACCESS_TOKEN) {
        console.error("META_ACCESS_TOKEN not set");
        process.exit(1);
    }

    console.log("═".repeat(70));
    console.log("  Sync Meta Ads → channel_snapshots");
    console.log("═".repeat(70));

    // Date range: last N months
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - BACKFILL_MONTHS, 1);
    const sinceStr = since.toISOString().split("T")[0];
    const untilStr = now.toISOString().split("T")[0];
    console.log(`\nDate range: ${sinceStr} → ${untilStr} (${BACKFILL_MONTHS} months)\n`);

    // Get all active clients with Meta
    const clientsSnap = await db.collection("clients").where("active", "==", true).get();
    const clients = clientsSnap.docs
        .map(d => {
            const data = d.data() as Client;
            data.id = d.id;
            return data;
        })
        .filter(c => c.metaAdAccountId && c.integraciones?.meta);

    console.log(`Found ${clients.length} clients with Meta integration\n`);

    for (const client of clients) {
        console.log(`\n── ${client.name} (${client.id}) ──`);
        console.log(`   Meta Account: ${client.metaAdAccountId}`);

        try {
            const rows = await fetchAccountInsights(client.metaAdAccountId!, sinceStr, untilStr);
            console.log(`   Fetched ${rows.length} daily rows from Meta API`);

            if (rows.length === 0) {
                console.log("   SKIP: No data from Meta API");
                continue;
            }

            // Write in batches of 500
            let written = 0;
            for (let i = 0; i < rows.length; i += 400) {
                const chunk = rows.slice(i, i + 400);
                const batch = db.batch();

                for (const row of chunk) {
                    const snapshot = buildSnapshot(client.id, row);
                    const docId = buildChannelSnapshotId(client.id, "META", row.date_start);
                    batch.set(db.collection("channel_snapshots").doc(docId), snapshot, { merge: true });
                }

                await batch.commit();
                written += chunk.length;
            }

            // Summary
            const totalSpend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
            const totalRevenue = rows.reduce((s, r) => {
                return s + (getActionValue(r.action_values, "purchase") || getActionValue(r.action_values, "offsite_conversion.fb_pixel_purchase"));
            }, 0);

            console.log(`   Wrote ${written} channel_snapshots`);
            console.log(`   Total spend: $${totalSpend.toFixed(2)}`);
            console.log(`   Total revenue: $${totalRevenue.toFixed(2)}`);
            console.log(`   ROAS: ${totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "N/A"}x`);
        } catch (err: any) {
            console.error(`   ERROR: ${err.message}`);
        }
    }

    console.log("\n" + "═".repeat(70));
    console.log("  Done!");
    console.log("═".repeat(70));
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
