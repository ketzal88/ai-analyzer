/**
 * Fill Empty Ecommerce Days
 *
 * For TiendaNube/Shopify/WooCommerce clients, writes zero-order snapshots
 * for days that are missing in channel_snapshots. This ensures every day
 * in Q1 has a snapshot (even if 0 orders).
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/fill-empty-ecommerce-days.ts
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
  console.log("=".repeat(70));
  console.log("  Fill Empty Ecommerce Days — Q1 2026");
  console.log(`  Range: ${START_DATE} -> ${END_DATE}`);
  console.log("=".repeat(70));

  const allDates = generateDateRange(START_DATE, END_DATE);
  console.log(`  Expected days: ${allDates.length}\n`);

  const clientsSnap = await db.collection("clients").where("active", "==", true).get();
  const clients = clientsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((c: any) => c.integraciones?.ecommerce);

  let totalFilled = 0;

  for (const client of clients) {
    const platform = client.integraciones.ecommerce;
    const prefix = `${client.id}__ECOMMERCE__`;

    // Get existing snapshots
    const snap = await db
      .collection("channel_snapshots")
      .where("__name__", ">=", prefix + START_DATE)
      .where("__name__", "<=", prefix + END_DATE)
      .get();

    const existingDates = new Set<string>();
    snap.docs.forEach((doc) => {
      const parts = doc.id.split("__");
      existingDates.add(parts[parts.length - 1]);
    });

    const missingDates = allDates.filter((d) => !existingDates.has(d));
    if (missingDates.length === 0) {
      console.log(`  ${client.name}: already complete (${existingDates.size}/${allDates.length})`);
      continue;
    }

    console.log(`  ${client.name} (${platform}): filling ${missingDates.length} empty days...`);

    // Write in batches of 400
    for (let i = 0; i < missingDates.length; i += 400) {
      const batch = db.batch();
      const chunk = missingDates.slice(i, i + 400);

      for (const date of chunk) {
        const docId = buildChannelSnapshotId(client.id, "ECOMMERCE", date);
        const snapshot: ChannelDailySnapshot = {
          clientId: client.id,
          channel: "ECOMMERCE",
          date,
          metrics: {
            orders: 0,
            revenue: 0,
            avgOrderValue: 0,
            grossRevenue: 0,
            netRevenue: 0,
            totalDiscounts: 0,
            totalShipping: 0,
            fulfilledOrders: 0,
            cancelledOrders: 0,
            itemsPerOrder: 0,
          },
          rawData: { source: platform, filled: true, reason: "no_orders" },
          syncedAt: new Date().toISOString(),
        };
        batch.set(db.collection("channel_snapshots").doc(docId), snapshot);
      }

      await batch.commit();
    }

    totalFilled += missingDates.length;
    console.log(`    OK: ${missingDates.length} days filled`);
  }

  console.log(`\n  Total empty days filled: ${totalFilled}`);
}

main().catch(console.error);
