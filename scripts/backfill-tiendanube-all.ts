/**
 * Backfill TiendaNube ecommerce data for all clients with TN credentials.
 * Q1 2026: Jan 1 - yesterday
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/backfill-tiendanube-all.ts
 */

import { db } from "../src/lib/firebase-admin";
import { TiendaNubeService } from "../src/lib/tiendanube-service";

const START_DATE = "2026-01-01";
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const END_DATE = yesterday.toISOString().split("T")[0];

async function main() {
  console.log("=".repeat(70));
  console.log("  Backfill TiendaNube — All Clients Q1 2026");
  console.log(`  Range: ${START_DATE} -> ${END_DATE}`);
  console.log("=".repeat(70));

  const snap = await db.collection("clients").where("active", "==", true).get();
  const clients = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c: any) =>
      c.integraciones?.ecommerce === "tiendanube" && c.tiendanubeStoreId && c.tiendanubeAccessToken
    ) as any[];

  console.log(`\n  Found ${clients.length} clients with TN credentials\n`);

  const results: { name: string; status: string; details?: string }[] = [];

  for (const client of clients) {
    console.log(`  Syncing: ${client.name} (Store #${client.tiendanubeStoreId})...`);
    try {
      const result = await TiendaNubeService.syncToChannelSnapshots(
        client.id,
        client.tiendanubeStoreId,
        client.tiendanubeAccessToken,
        START_DATE,
        END_DATE
      );
      const msg = `${result.daysWritten} days, ${result.totalOrders} orders, $${result.totalRevenue?.toFixed(2) || 0}`;
      console.log(`    OK: ${msg}`);
      results.push({ name: client.name, status: "OK", details: msg });
    } catch (err: any) {
      const errMsg = err.message || String(err);
      console.log(`    ERROR: ${errMsg.slice(0, 120)}`);
      results.push({ name: client.name, status: "ERROR", details: errMsg.slice(0, 120) });
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("  RESULTS");
  console.log("=".repeat(70));
  for (const r of results) {
    const icon = r.status === "OK" ? "[OK]" : "[ERR]";
    console.log(`  ${icon} ${r.name}: ${r.details || ""}`);
  }
  const ok = results.filter((r) => r.status === "OK").length;
  console.log(`\n  Total: ${ok}/${results.length} successful`);
}

main().catch(console.error);
