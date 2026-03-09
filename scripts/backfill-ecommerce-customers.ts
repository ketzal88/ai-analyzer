/**
 * Backfill ecommerce_customers collection
 *
 * Populates lifetime customer records from existing order data.
 * Iterates all clients with ecommerce integration, fetches last 6 months
 * of orders, and upserts customer records.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/backfill-ecommerce-customers.ts
 *
 * Optional: Pass a single clientId to backfill just one client:
 *   npx tsx --require ./scripts/load-env.cjs scripts/backfill-ecommerce-customers.ts CLIENT_ID
 */

import { db } from "@/lib/firebase-admin";
import { EcommerceCustomerService } from "@/lib/ecommerce-customer-service";

async function main() {
    const targetClientId = process.argv[2];

    // Get 6 months ago as start date
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split("T")[0];
    const endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // yesterday

    console.log(`\n=== Backfilling ecommerce_customers ===`);
    console.log(`Period: ${startDate} → ${endDate}`);
    if (targetClientId) console.log(`Target client: ${targetClientId}`);

    // Get all active clients with ecommerce
    let clientQuery = db.collection("clients").where("active", "==", true);
    if (targetClientId) {
        const doc = await db.collection("clients").doc(targetClientId).get();
        if (!doc.exists) {
            console.error(`Client ${targetClientId} not found`);
            process.exit(1);
        }
        const client = doc.data()!;
        await processClient(targetClientId, client, startDate, endDate);
        return;
    }

    const snap = await clientQuery.get();
    console.log(`Found ${snap.size} active clients\n`);

    let processed = 0;
    for (const doc of snap.docs) {
        const client = doc.data();
        const platform = client.integraciones?.ecommerce;
        if (!platform) continue;

        await processClient(doc.id, client, startDate, endDate);
        processed++;
    }

    console.log(`\n=== Done! Processed ${processed} clients ===`);
}

async function processClient(
    clientId: string,
    client: Record<string, unknown>,
    startDate: string,
    endDate: string
) {
    const integraciones = client.integraciones as Record<string, unknown> | undefined;
    const platform = integraciones?.ecommerce as string | undefined;
    if (!platform) return;

    console.log(`\n--- ${clientId} (${platform}) ---`);

    try {
        if (platform === "shopify") {
            const domain = client.shopifyStoreDomain as string;
            const token = client.shopifyAccessToken as string;
            if (!domain || !token) { console.log("  Missing Shopify credentials, skipping"); return; }

            const { ShopifyService } = await import("@/lib/shopify-service");
            const orders = await ShopifyService.fetchOrders(domain, token, startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const paidOrders = orders.filter((o: any) =>
                ["paid", "partially_paid", "partially_refunded"].includes(o.financial_status)
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inputs = paidOrders
                .filter((o: any) => o.customer?.id)
                .map((o: any) => ({
                    customerId: String(o.customer.id),
                    email: o.customer.email || undefined,
                    date: o.created_at.split("T")[0],
                    totalPrice: parseFloat(o.total_price || "0"),
                }));
            const count = await EcommerceCustomerService.upsertFromOrders(clientId, 'shopify', inputs);
            console.log(`  Upserted ${count} customers from ${paidOrders.length} orders`);

        } else if (platform === "tiendanube") {
            const storeId = client.tiendanubeStoreId as string;
            const token = client.tiendanubeAccessToken as string;
            if (!storeId || !token) { console.log("  Missing TiendaNube credentials, skipping"); return; }

            const { TiendaNubeService } = await import("@/lib/tiendanube-service");
            const orders = await TiendaNubeService.fetchOrders(storeId, token, startDate, endDate, "paid");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inputs = orders
                .filter((o: any) => o.customer?.id)
                .map((o: any) => ({
                    customerId: String(o.customer.id),
                    email: o.customer?.email || undefined,
                    date: o.created_at.split("T")[0],
                    totalPrice: parseFloat(o.total || "0"),
                }));
            const count = await EcommerceCustomerService.upsertFromOrders(clientId, 'tiendanube', inputs);
            console.log(`  Upserted ${count} customers from ${orders.length} orders`);

        } else if (platform === "woocommerce") {
            const domain = client.woocommerceStoreDomain as string;
            const key = client.woocommerceConsumerKey as string;
            const secret = client.woocommerceConsumerSecret as string;
            if (!domain || !key || !secret) { console.log("  Missing WooCommerce credentials, skipping"); return; }

            const { WooCommerceService } = await import("@/lib/woocommerce-service");
            const orders = await WooCommerceService.fetchOrders(domain, key, secret, startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const paidOrders = orders.filter((o: any) =>
                ["processing", "completed", "on-hold"].includes(o.status) && o.customer_id > 0
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inputs = paidOrders.map((o: any) => ({
                customerId: String(o.customer_id),
                email: o.billing?.email || undefined,
                date: o.date_created.split("T")[0],
                totalPrice: parseFloat(o.total || "0"),
            }));
            const count = await EcommerceCustomerService.upsertFromOrders(clientId, 'woocommerce', inputs);
            console.log(`  Upserted ${count} customers from ${paidOrders.length} orders`);

        } else {
            console.log(`  Unknown platform: ${platform}`);
        }
    } catch (err: unknown) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
    }
}

main().catch(console.error);
