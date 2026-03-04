/**
 * Backfill Tienda Nube ecommerce data for a client.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/sync-tiendanube-backfill.ts [clientId]
 */

import { db } from "@/lib/firebase-admin";
import { TiendaNubeService } from "@/lib/tiendanube-service";
import { Client } from "@/types";

const TARGET_CLIENT_ID = process.argv[2] || "";

async function findClient(): Promise<{ id: string; client: Client }> {
    if (TARGET_CLIENT_ID) {
        const doc = await db.collection("clients").doc(TARGET_CLIENT_ID).get();
        if (!doc.exists) throw new Error(`Client ${TARGET_CLIENT_ID} not found`);
        return { id: doc.id, client: doc.data() as Client };
    }

    const snap = await db.collection("clients").where("active", "==", true).get();
    for (const doc of snap.docs) {
        const client = doc.data() as Client;
        if (client.tiendanubeStoreId && client.tiendanubeAccessToken && client.integraciones?.ecommerce === "tiendanube") {
            return { id: doc.id, client };
        }
    }
    throw new Error("No active client with Tienda Nube credentials found");
}

async function main() {
    console.log("Finding client with Tienda Nube integration...\n");
    const { id, client } = await findClient();
    console.log(`Client: ${client.name} (${id})`);
    console.log(`Store ID: ${client.tiendanubeStoreId}`);
    console.log(`Token: ${client.tiendanubeAccessToken!.substring(0, 12)}...\n`);

    // Step 1: Verify connectivity
    console.log("Step 1: Verifying Tienda Nube API connectivity...");
    try {
        const orders = await TiendaNubeService.fetchOrders(
            client.tiendanubeStoreId!,
            client.tiendanubeAccessToken!,
            "2026-03-01",
            "2026-03-04",
            "paid"
        );
        console.log(`  Found ${orders.length} paid orders in last few days`);
        if (orders.length > 0) {
            const o = orders[0];
            console.log(`  Latest: #${o.number} | ${o.currency} ${o.total} | ${o.created_at}`);
        }
    } catch (err: any) {
        console.error(`  API verification failed: ${err.message}`);
        return;
    }

    // Step 2: Sync month by month
    console.log("\nStep 2: Syncing data month by month...\n");

    const months = [
        { name: "January 2026", start: "2026-01-01", end: "2026-01-31" },
        { name: "February 2026", start: "2026-02-01", end: "2026-02-28" },
        { name: "March 2026 (to date)", start: "2026-03-01", end: "2026-03-04" },
    ];

    let grandTotalOrders = 0;
    let grandTotalRevenue = 0;

    for (const month of months) {
        console.log(`Syncing ${month.name} (${month.start} -> ${month.end})...`);
        try {
            const result = await TiendaNubeService.syncToChannelSnapshots(
                id,
                client.tiendanubeStoreId!,
                client.tiendanubeAccessToken!,
                month.start,
                month.end
            );
            console.log(`  ${result.totalOrders} orders, $${result.totalRevenue.toFixed(2)} revenue, ${result.daysWritten} days written`);
            grandTotalOrders += result.totalOrders;
            grandTotalRevenue += result.totalRevenue;
        } catch (err: any) {
            console.error(`  Error: ${err.message}`);
        }
    }

    console.log(`\nBackfill complete!`);
    console.log(`Total: ${grandTotalOrders} orders, $${grandTotalRevenue.toFixed(2)} revenue`);

    // Verify
    console.log(`\nVerifying channel_snapshots in Firestore...`);
    const snapshotsSnap = await db.collection("channel_snapshots")
        .where("clientId", "==", id)
        .where("channel", "==", "ECOMMERCE")
        .orderBy("date", "desc")
        .limit(10)
        .get();

    console.log(`Found ${snapshotsSnap.size} ECOMMERCE snapshots for ${client.name}:\n`);
    for (const doc of snapshotsSnap.docs) {
        const data = doc.data();
        const m = data.metrics || {};
        const source = data.rawData?.source || "unknown";
        console.log(`  ${data.date} [${source}] | orders: ${m.orders || 0} | revenue: $${(m.revenue || 0).toFixed(2)} | AOV: $${(m.avgOrderValue || 0).toFixed(2)} | refunds: ${m.refunds || 0}`);
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
