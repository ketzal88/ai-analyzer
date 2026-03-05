/**
 * Fill Empty Google Ads Days — write zero-spend snapshots for missing days
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/fill-empty-google-days.ts
 */

import { db } from "../src/lib/firebase-admin";
import { buildChannelSnapshotId } from "../src/types/channel-snapshots";
import type { ChannelDailySnapshot } from "../src/types/channel-snapshots";

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

async function main() {
  const allDates = generateDateRange(START_DATE, END_DATE);
  console.log(`Fill empty Google Ads days (${allDates.length} days)\n`);

  const snap = await db.collection("clients").where("active", "==", true).get();
  const clients = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((c: any) => c.integraciones?.google && c.googleAdsId);

  let totalFilled = 0;

  for (const client of clients) {
    const prefix = `${client.id}__GOOGLE__`;
    const existing = await db
      .collection("channel_snapshots")
      .where("__name__", ">=", prefix + START_DATE)
      .where("__name__", "<=", prefix + END_DATE)
      .get();

    const existingDates = new Set<string>();
    existing.docs.forEach((doc) => {
      existingDates.add(doc.id.split("__").pop()!);
    });

    const missing = allDates.filter((d) => !existingDates.has(d));
    if (missing.length === 0) {
      console.log(`  ${client.name}: complete (${existingDates.size}/${allDates.length})`);
      continue;
    }

    console.log(`  ${client.name}: filling ${missing.length} empty days...`);

    for (let i = 0; i < missing.length; i += 400) {
      const batch = db.batch();
      for (const date of missing.slice(i, i + 400)) {
        const docId = buildChannelSnapshotId(client.id, "GOOGLE", date);
        const snapshot: ChannelDailySnapshot = {
          clientId: client.id,
          channel: "GOOGLE",
          date,
          metrics: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0 },
          rawData: { source: "google", filled: true, reason: "no_spend" },
          syncedAt: new Date().toISOString(),
        };
        batch.set(db.collection("channel_snapshots").doc(docId), snapshot);
      }
      await batch.commit();
    }
    totalFilled += missing.length;
  }

  console.log(`\n  Total filled: ${totalFilled} days`);
}

main().catch(console.error);
