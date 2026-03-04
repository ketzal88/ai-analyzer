/**
 * Backfill Shopify ecommerce data for a client.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/sync-shopify-backfill.ts [clientId]
 */

import { db } from "@/lib/firebase-admin";
import { ShopifyService } from "@/lib/shopify-service";
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
        if (client.shopifyStoreDomain && client.shopifyAccessToken && client.integraciones?.ecommerce === "shopify") {
            return { id: doc.id, client };
        }
    }
    throw new Error("No active client with Shopify found");
}

async function main() {
    console.log("Finding client with Shopify integration...\n");
    const { id, client } = await findClient();
    console.log(`Client: ${client.name} (${id})`);
    console.log(`Store: ${client.shopifyStoreDomain}\n`);

    const months = [
        { name: "January 2026", start: "2026-01-01", end: "2026-01-31" },
        { name: "February 2026", start: "2026-02-01", end: "2026-02-28" },
        { name: "March 2026 (to date)", start: "2026-03-01", end: "2026-03-04" },
    ];

    let grandTotalDays = 0;
    let grandTotalOrders = 0;
    let grandTotalRevenue = 0;

    for (const month of months) {
        console.log(`Syncing ${month.name} (${month.start} → ${month.end})...`);
        try {
            const result = await ShopifyService.syncToChannelSnapshots(
                id,
                client.shopifyStoreDomain!,
                client.shopifyAccessToken!,
                month.start,
                month.end
            );
            console.log(`  ${result.daysWritten} days, ${result.totalOrders} orders, $${result.totalRevenue.toFixed(0)} revenue`);
            grandTotalDays += result.daysWritten;
            grandTotalOrders += result.totalOrders;
            grandTotalRevenue += result.totalRevenue;
        } catch (err: any) {
            console.error(`  Error: ${err.message}`);
        }
    }

    console.log(`\nBackfill complete!`);
    console.log(`Total: ${grandTotalDays} days, ${grandTotalOrders} orders, $${grandTotalRevenue.toFixed(0)} revenue`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
