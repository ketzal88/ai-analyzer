/**
 * Backfill Meta Ads — All clients with metaAdAccountId
 * Sequential with 3s pause between clients to respect rate limits.
 * Also fills zero-spend days for complete coverage.
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/backfill-meta-all.ts
 */

import { db } from "../src/lib/firebase-admin";
import { ChannelDailySnapshot, buildChannelSnapshotId } from "../src/types/channel-snapshots";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

const START_DATE = "2026-01-01";
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const END_DATE = yesterday.toISOString().split("T")[0];

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (current <= last) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface MetaRow {
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
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  inline_link_clicks?: string;
  inline_link_click_ctr?: string;
  cost_per_inline_link_click?: string;
  unique_clicks?: string;
  outbound_clicks?: any;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  [key: string]: any; // video fields
}

function getAction(actions: MetaRow["actions"], type: string): number {
  return Number(actions?.find(a => a.action_type === type)?.value || 0);
}
function getActionValue(vals: MetaRow["action_values"], type: string): number {
  return Number(vals?.find(a => a.action_type === type)?.value || 0);
}

async function syncClient(clientId: string, adAccountId: string, allDates: string[]): Promise<{ days: number; spend: number; error?: string }> {
  if (!META_ACCESS_TOKEN) return { days: 0, spend: 0, error: "No META_ACCESS_TOKEN" };

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

  let allRows: MetaRow[] = [];
  let url: string | null = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/insights?level=account&time_increment=1&time_range=${encodeURIComponent(timeRange)}&fields=${fields}&limit=500&access_token=${META_ACCESS_TOKEN}`;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err: any = await res.json();
      return { days: 0, spend: 0, error: err.error?.message || JSON.stringify(err).slice(0, 150) };
    }
    const json: any = await res.json();
    allRows = allRows.concat(json.data || []);
    url = json.paging?.next || null;
    if (url) await sleep(1000); // pace pagination
  }

  // Write real data
  const datesWithData = new Set<string>();
  for (let i = 0; i < allRows.length; i += 400) {
    const chunk = allRows.slice(i, i + 400);
    const batch = db.batch();
    for (const row of chunk) {
      datesWithData.add(row.date_start);
      const spend = Number(row.spend || 0);
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      const getCostPerAct = (type: string) => Number(row.cost_per_action_type?.find((a: any) => a.action_type === type)?.value || 0);
      const getVideoAct = (field: string) => Number(row[field]?.[0]?.value || 0);
      const purchases = getAction(row.actions, "purchase") || getAction(row.actions, "offsite_conversion.fb_pixel_purchase");
      const revenue = getActionValue(row.action_values, "purchase") || getActionValue(row.action_values, "offsite_conversion.fb_pixel_purchase");
      const leads = getAction(row.actions, "lead") || getAction(row.actions, "offsite_conversion.fb_pixel_lead");
      const messages = getAction(row.actions, "onsite_conversion.messaging_first_reply");
      const conversions = purchases || leads || messages || 0;

      const addToCart = getAction(row.actions, "offsite_conversion.fb_pixel_add_to_cart") || getAction(row.actions, "add_to_cart");
      const initiateCheckout = getAction(row.actions, "offsite_conversion.fb_pixel_initiate_checkout") || getAction(row.actions, "initiate_checkout");
      const viewContent = getAction(row.actions, "offsite_conversion.fb_pixel_view_content") || getAction(row.actions, "view_content");

      const snapshot: ChannelDailySnapshot = {
        clientId, channel: "META", date: row.date_start,
        metrics: {
          spend, revenue, conversions, impressions, clicks,
          ctr: Number(row.ctr || 0), cpc: Number(row.cpc || 0),
          cpm: Number(row.cpm || 0), cpp: Number(row.cpp || 0),
          roas: spend > 0 ? revenue / spend : 0,
          cpa: conversions > 0 ? spend / conversions : 0,
          reach: Number(row.reach || 0), frequency: Number(row.frequency || 0),
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
      batch.set(db.collection("channel_snapshots").doc(buildChannelSnapshotId(clientId, "META", row.date_start)), snapshot, { merge: true });
    }
    await batch.commit();
  }

  // Fill empty days
  const missingDates = allDates.filter(d => !datesWithData.has(d));
  if (missingDates.length > 0) {
    for (let i = 0; i < missingDates.length; i += 400) {
      const batch = db.batch();
      for (const date of missingDates.slice(i, i + 400)) {
        const snapshot: ChannelDailySnapshot = {
          clientId, channel: "META", date,
          metrics: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0, reach: 0, frequency: 0 },
          rawData: { filled: true, reason: "no_spend" },
          syncedAt: new Date().toISOString(),
        };
        batch.set(db.collection("channel_snapshots").doc(buildChannelSnapshotId(clientId, "META", date)), snapshot);
      }
      await batch.commit();
    }
  }

  const totalSpend = allRows.reduce((s, r) => s + Number(r.spend || 0), 0);
  return { days: allDates.length, spend: totalSpend };
}

async function main() {
  console.log("=".repeat(70));
  console.log("  Backfill Meta Ads — All Clients Q1 2026");
  console.log(`  Range: ${START_DATE} -> ${END_DATE}`);
  console.log("=".repeat(70));

  const allDates = generateDateRange(START_DATE, END_DATE);
  const snap = await db.collection("clients").where("active", "==", true).get();
  const clients = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter((c: any) => c.integraciones?.meta && c.metaAdAccountId);

  // Skip clients that already have 63/63 days
  const toSync: any[] = [];
  for (const c of clients) {
    const prefix = `${c.id}__META__`;
    const existing = await db.collection("channel_snapshots")
      .where("__name__", ">=", prefix + START_DATE)
      .where("__name__", "<=", prefix + END_DATE)
      .get();
    if (existing.size >= allDates.length) {
      console.log(`  ${c.name}: already ${existing.size}/${allDates.length} - skip`);
    } else {
      toSync.push(c);
      console.log(`  ${c.name}: ${existing.size}/${allDates.length} - WILL SYNC`);
    }
  }

  console.log(`\n  Syncing ${toSync.length} clients (skipping ${clients.length - toSync.length} already complete)\n`);

  const results: { name: string; status: string; details: string }[] = [];

  for (let i = 0; i < toSync.length; i++) {
    const c = toSync[i];
    console.log(`  [${i + 1}/${toSync.length}] ${c.name} (${c.metaAdAccountId})...`);
    const r = await syncClient(c.id, c.metaAdAccountId, allDates);
    if (r.error) {
      console.log(`    ERROR: ${r.error}`);
      results.push({ name: c.name, status: "ERROR", details: r.error });
    } else {
      console.log(`    OK: ${r.days} days, $${r.spend.toFixed(2)} spend`);
      results.push({ name: c.name, status: "OK", details: `${r.days} days, $${r.spend.toFixed(0)}` });
    }

    if (i < toSync.length - 1) await sleep(3000); // 3s between clients
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("  RESULTS");
  console.log("=".repeat(70));
  for (const r of results) {
    console.log(`  ${r.status === "OK" ? "[OK]" : "[ERR]"} ${r.name}: ${r.details}`);
  }
  const ok = results.filter(r => r.status === "OK").length;
  console.log(`\n  ${ok}/${results.length} successful`);
}

main().catch(console.error);
