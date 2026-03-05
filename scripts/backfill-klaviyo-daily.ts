/**
 * Backfill Klaviyo — Daily Snapshots Q1 2026
 *
 * Strategy: Use the Reporting API once per client (campaigns + flows),
 * then distribute stats by day using each campaign's sendTime.
 * Days without campaigns get a zero-metric snapshot.
 *
 * Rate limits: 2/min reporting, 225/day total reporting calls.
 * With 5 clients × 2 calls each = 10 reporting calls. Well within limits.
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/backfill-klaviyo-daily.ts
 */

import { db } from "../src/lib/firebase-admin";
import { KlaviyoService } from "../src/lib/klaviyo-service";
import { buildChannelSnapshotId } from "../src/types/channel-snapshots";
import type { ChannelDailySnapshot, UnifiedChannelMetrics } from "../src/types/channel-snapshots";

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function syncClientDaily(
  clientId: string,
  clientName: string,
  apiKey: string,
  allDates: string[]
): Promise<{ daysWritten: number; error?: string }> {
  try {
    // 1. Discover conversion metric
    console.log(`    Finding conversion metric...`);
    const metricId = await KlaviyoService.findConversionMetricId(apiKey);

    // 2. Fetch campaigns list (not rate limited)
    console.log(`    Fetching campaigns list...`);
    const allCampaigns = await KlaviyoService.fetchCampaigns(apiKey);
    console.log(`    Found ${allCampaigns.length} campaigns total`);

    // 3. Fetch campaign report for full Q1 (1 reporting call)
    console.log(`    Querying campaign report (${START_DATE} -> ${END_DATE})...`);
    const campaignReport = await KlaviyoService.queryCampaignValues(apiKey, START_DATE, END_DATE, metricId);
    const campaignStats = KlaviyoService.parseCampaignValues(campaignReport);

    // Enrich with sendTime from campaigns list
    const campaignMap = new Map(allCampaigns.map((c) => [c.id, c]));
    for (const cs of campaignStats) {
      const info = campaignMap.get(cs.campaignId);
      if (info) {
        cs.campaignName = info.name;
        if (!cs.sendTime && info.sendTime) cs.sendTime = info.sendTime;
      }
    }

    // 4. Wait 31s then fetch flow report (1 reporting call)
    console.log(`    Waiting 31s for rate limit...`);
    await sleep(31_000);
    console.log(`    Querying flow report...`);
    const flowReport = await KlaviyoService.queryFlowValues(apiKey, START_DATE, END_DATE, metricId);
    const flowStats = KlaviyoService.parseFlowValues(flowReport);

    // Enrich flows
    const allFlows = await KlaviyoService.fetchFlows(apiKey);
    const flowMap = new Map(allFlows.map((f) => [f.id, f]));
    for (const fs of flowStats) {
      const info = flowMap.get(fs.flowId);
      if (info) {
        fs.flowName = info.name;
        fs.status = info.status;
      }
    }

    // 5. Group campaign stats by day (using sendTime)
    const dailyCampaigns = new Map<string, typeof campaignStats>();
    for (const cs of campaignStats) {
      const day = cs.sendTime ? cs.sendTime.split("T")[0] : undefined;
      if (day && day >= START_DATE && day <= END_DATE) {
        if (!dailyCampaigns.has(day)) dailyCampaigns.set(day, []);
        dailyCampaigns.get(day)!.push(cs);
      }
    }

    // Flow totals (lifetime, not daily — spread evenly is misleading, so we add to rawData only)
    const flowTotals = {
      totalRecipients: flowStats.reduce((s, f) => s + f.recipients, 0),
      totalRevenue: flowStats.reduce((s, f) => s + f.revenue, 0),
      totalConversions: flowStats.reduce((s, f) => s + f.conversions, 0),
    };

    // 6. Write daily snapshots
    let daysWritten = 0;
    for (let i = 0; i < allDates.length; i += 400) {
      const batch = db.batch();
      const chunk = allDates.slice(i, i + 400);

      for (const date of chunk) {
        const dayCampaigns = dailyCampaigns.get(date) || [];

        const sent = dayCampaigns.reduce((s, c) => s + c.recipients, 0);
        const bounces = dayCampaigns.reduce((s, c) => s + c.bounces, 0);
        const delivered = sent - bounces;
        const opens = dayCampaigns.reduce((s, c) => s + c.opens, 0);
        const clicks = dayCampaigns.reduce((s, c) => s + c.clicks, 0);
        const unsubscribes = dayCampaigns.reduce((s, c) => s + c.unsubscribes, 0);
        const revenue = dayCampaigns.reduce((s, c) => s + c.revenue, 0);
        const conversions = dayCampaigns.reduce((s, c) => s + c.conversions, 0);

        const metrics: UnifiedChannelMetrics = {
          sent,
          delivered,
          opens,
          openRate: delivered > 0 ? (opens / delivered) * 100 : 0,
          emailClicks: clicks,
          clickRate: delivered > 0 ? (clicks / delivered) * 100 : 0,
          bounces,
          unsubscribes,
          emailRevenue: revenue,
          conversions,
        };

        const docId = buildChannelSnapshotId(clientId, "EMAIL", date);
        const snapshot: ChannelDailySnapshot = {
          clientId,
          channel: "EMAIL",
          date,
          metrics,
          rawData: {
            source: "klaviyo",
            campaigns: dayCampaigns,
            ...(date === END_DATE ? { flows: flowStats, flowTotals } : {}),
          },
          syncedAt: new Date().toISOString(),
        };

        batch.set(db.collection("channel_snapshots").doc(docId), snapshot, { merge: true });
        daysWritten++;
      }

      await batch.commit();
    }

    const totalSent = campaignStats.reduce((s, c) => s + c.recipients, 0);
    const totalRevenue = campaignStats.reduce((s, c) => s + c.revenue, 0);
    const daysWithCampaigns = dailyCampaigns.size;
    console.log(`    OK: ${daysWritten} days written, ${daysWithCampaigns} days with campaigns, ${campaignStats.length} campaigns, ${totalSent} sent, $${totalRevenue.toFixed(2)} revenue`);

    return { daysWritten };
  } catch (err: any) {
    return { daysWritten: 0, error: err.message || String(err) };
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("  Backfill Klaviyo Daily — Q1 2026");
  console.log(`  Range: ${START_DATE} -> ${END_DATE}`);
  console.log("=".repeat(70));

  const allDates = generateDateRange(START_DATE, END_DATE);
  console.log(`  Days: ${allDates.length}\n`);

  const snap = await db.collection("clients").where("active", "==", true).get();
  const clients = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((c: any) => c.integraciones?.email === "klaviyo" && c.klaviyoApiKey);

  console.log(`  Clients with Klaviyo: ${clients.length}\n`);

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    console.log(`  [${i + 1}/${clients.length}] ${client.name}`);

    const result = await syncClientDaily(client.id, client.name, client.klaviyoApiKey, allDates);

    if (result.error) {
      console.log(`    ERROR: ${result.error.slice(0, 150)}`);
    }

    // Wait between clients to be safe with rate limits
    if (i < clients.length - 1) {
      console.log(`    Waiting 35s before next client...`);
      await sleep(35_000);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("  DONE");
  console.log("=".repeat(70));
}

main().catch(console.error);
