/**
 * Backfill Perfit — Daily Snapshots Q1 2026
 *
 * Same approach as Klaviyo: fetch all campaigns, group by launchDate,
 * write daily snapshots. Days without campaigns get zero-metric snapshots.
 *
 * Runs clients sequentially with 5s pause between to avoid rate limits.
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/backfill-perfit-daily.ts
 */

import { db } from "../src/lib/firebase-admin";
import { PerfitService } from "../src/lib/perfit-service";
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

async function syncClient(
  clientId: string,
  clientName: string,
  apiKey: string,
  allDates: string[]
): Promise<{ daysWritten: number; error?: string }> {
  try {
    const accountId = PerfitService.extractAccountId(apiKey);
    console.log(`    Account: ${accountId}`);

    // 1. Fetch campaigns + automations + account info
    console.log(`    Fetching campaigns...`);
    const campaigns = await PerfitService.fetchCampaigns(accountId, apiKey);
    console.log(`    Found ${campaigns.length} sent campaigns total`);

    await sleep(2000);

    console.log(`    Fetching automations...`);
    const automations = await PerfitService.fetchAutomations(accountId, apiKey);
    const automationSummaries = PerfitService.buildAutomationSummaries(automations);
    console.log(`    Found ${automations.length} automations`);

    await sleep(2000);

    let accountInfo: any = null;
    try {
      accountInfo = await PerfitService.fetchAccountInfo(accountId, apiKey);
    } catch { /* skip */ }

    // 2. Group campaigns by launch date
    const dailyCampaigns = new Map<string, typeof campaigns>();
    let inRangeCount = 0;
    for (const c of campaigns) {
      const day = c.launchDate?.split("T")[0];
      if (day && day >= START_DATE && day <= END_DATE) {
        inRangeCount++;
        if (!dailyCampaigns.has(day)) dailyCampaigns.set(day, []);
        dailyCampaigns.get(day)!.push(c);
      }
    }
    console.log(`    Campaigns in Q1 range: ${inRangeCount} across ${dailyCampaigns.size} days`);

    // 3. Write daily snapshots (all days, including zeros)
    let daysWritten = 0;
    const enabledAutomations = automationSummaries.filter((a) => a.enabled);
    const automationTotals = {
      totalConverted: enabledAutomations.reduce((s, a) => s + a.converted, 0),
      totalConvertedAmount: enabledAutomations.reduce((s, a) => s + a.convertedAmount, 0),
      totalTriggered: enabledAutomations.reduce((s, a) => s + a.triggered, 0),
      totalCompleted: enabledAutomations.reduce((s, a) => s + a.completed, 0),
    };

    for (let i = 0; i < allDates.length; i += 400) {
      const batch = db.batch();
      const chunk = allDates.slice(i, i + 400);

      for (const date of chunk) {
        const dayCamps = dailyCampaigns.get(date) || [];

        const sent = dayCamps.reduce((s, c) => s + (c.metrics?.sent || 0), 0);
        const bounced = dayCamps.reduce((s, c) => s + (c.metrics?.bounced || 0), 0);
        const delivered = sent - bounced;
        const opens = dayCamps.reduce((s, c) => s + (c.metrics?.opened || 0), 0);
        const clicks = dayCamps.reduce((s, c) => s + (c.metrics?.clicked || 0), 0);
        const conversions = dayCamps.reduce((s, c) => s + (c.metrics?.conversions || 0), 0);
        const revenue = dayCamps.reduce((s, c) => s + (c.metrics?.conversionsAmount || 0), 0);

        const metrics: UnifiedChannelMetrics = {
          sent,
          delivered,
          opens,
          openRate: delivered > 0 ? (opens / delivered) * 100 : 0,
          emailClicks: clicks,
          clickRate: delivered > 0 ? (clicks / delivered) * 100 : 0,
          bounces: bounced,
          emailRevenue: revenue,
          conversions,
        };

        const campaignDetails = dayCamps.map((c) => {
          const s = c.metrics?.sent || 0;
          const b = c.metrics?.bounced || 0;
          const d = s - b;
          const o = c.metrics?.opened || 0;
          const cl = c.metrics?.clicked || 0;
          return {
            id: c.id,
            name: c.name,
            sent: s,
            opens: o,
            openRate: d > 0 ? (o / d) * 100 : 0,
            clicks: cl,
            clickRate: d > 0 ? (cl / d) * 100 : 0,
            bounces: b,
            bounceRate: s > 0 ? (b / s) * 100 : 0,
            conversions: c.metrics?.conversions || 0,
            conversionsAmount: c.metrics?.conversionsAmount || 0,
            launchDate: c.launchDate || "",
          };
        });

        const docId = buildChannelSnapshotId(clientId, "EMAIL", date);
        const snapshot: ChannelDailySnapshot = {
          clientId,
          channel: "EMAIL",
          date,
          metrics,
          rawData: {
            source: "perfit",
            campaigns: campaignDetails,
            ...(date === END_DATE
              ? {
                  automations: automationSummaries,
                  automationTotals,
                  account: accountInfo
                    ? {
                        name: accountInfo.name,
                        activeContacts: accountInfo.plan?.contacts?.active,
                        planState: accountInfo.plan?.state,
                      }
                    : undefined,
                }
              : {}),
          },
          syncedAt: new Date().toISOString(),
        };

        batch.set(db.collection("channel_snapshots").doc(docId), snapshot, { merge: true });
        daysWritten++;
      }

      await batch.commit();
    }

    const totalSent = campaigns
      .filter((c) => {
        const d = c.launchDate?.split("T")[0];
        return d && d >= START_DATE && d <= END_DATE;
      })
      .reduce((s, c) => s + (c.metrics?.sent || 0), 0);
    const totalRevenue = campaigns
      .filter((c) => {
        const d = c.launchDate?.split("T")[0];
        return d && d >= START_DATE && d <= END_DATE;
      })
      .reduce((s, c) => s + (c.metrics?.conversionsAmount || 0), 0);

    console.log(`    OK: ${daysWritten} days, ${dailyCampaigns.size} with campaigns, ${totalSent} sent, $${totalRevenue.toFixed(2)} revenue`);
    return { daysWritten };
  } catch (err: any) {
    return { daysWritten: 0, error: err.message || String(err) };
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("  Backfill Perfit Daily — Q1 2026");
  console.log(`  Range: ${START_DATE} -> ${END_DATE}`);
  console.log("=".repeat(70));

  const allDates = generateDateRange(START_DATE, END_DATE);
  console.log(`  Days: ${allDates.length}\n`);

  const snap = await db.collection("clients").where("active", "==", true).get();
  const clients = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((c: any) => c.integraciones?.email === "perfit" && c.perfitApiKey);

  console.log(`  Clients with Perfit: ${clients.length}\n`);

  const results: { name: string; status: string; details?: string }[] = [];

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    console.log(`  [${i + 1}/${clients.length}] ${client.name}`);

    const result = await syncClient(client.id, client.name, client.perfitApiKey, allDates);

    if (result.error) {
      console.log(`    ERROR: ${result.error.slice(0, 200)}`);
      results.push({ name: client.name, status: "ERROR", details: result.error.slice(0, 150) });
    } else {
      results.push({ name: client.name, status: "OK", details: `${result.daysWritten} days` });
    }

    // Wait between clients
    if (i < clients.length - 1) {
      console.log(`    Waiting 5s before next client...`);
      await sleep(5_000);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("  RESULTS");
  console.log("=".repeat(70));
  for (const r of results) {
    const icon = r.status === "OK" ? "[OK]" : "[ERR]";
    console.log(`  ${icon} ${r.name}: ${r.details}`);
  }
  const ok = results.filter((r) => r.status === "OK").length;
  console.log(`\n  Total: ${ok}/${results.length} successful`);
}

main().catch(console.error);
