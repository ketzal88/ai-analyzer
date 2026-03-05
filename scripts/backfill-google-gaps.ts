/**
 * Backfill Google Ads gaps — Only clients with incomplete data
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/backfill-google-gaps.ts
 */

import { db } from "../src/lib/firebase-admin";
import { GoogleAdsService } from "../src/lib/google-ads-service";

const START_DATE = "2026-01-01";
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const END_DATE = yesterday.toISOString().split("T")[0];

async function main() {
  console.log("=".repeat(70));
  console.log("  Backfill Google Ads Gaps — Q1 2026");
  console.log(`  Range: ${START_DATE} -> ${END_DATE}`);
  console.log("=".repeat(70));

  const snap = await db.collection("clients").where("active", "==", true).get();
  const clients = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((c: any) => c.integraciones?.google && c.googleAdsId);

  console.log(`\n  Clients with Google Ads: ${clients.length}\n`);

  for (const client of clients) {
    console.log(`  ${client.name} (${client.googleAdsId})...`);
    try {
      const result = await GoogleAdsService.syncToChannelSnapshots(
        client.id,
        client.googleAdsId,
        START_DATE,
        END_DATE
      );
      console.log(`    OK: ${result.daysWritten} days, $${result.totalSpend.toFixed(2)} spend`);
    } catch (err: any) {
      console.log(`    ERROR: ${err.message?.slice(0, 150) || err}`);
    }
  }

  console.log(`\n  DONE`);
}

main().catch(console.error);
