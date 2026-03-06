/**
 * Tienda Nube Service — Direct API integration
 *
 * Fetches orders from Tienda Nube REST API, aggregates daily metrics,
 * and writes to channel_snapshots collection.
 *
 * API Docs: https://tiendanube.github.io/api-documentation/resources/order
 * Base URL: https://api.tiendanube.com/v1/{storeId}
 * Auth: Authentication: bearer {accessToken}
 */

import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";

// ── Config ───────────────────────────────────────────
const BASE_URL = "https://api.tiendanube.com/v1";
const PER_PAGE = 200;
const MAX_RETRIES = 3;

// ── Types ────────────────────────────────────────────
export interface TiendaNubeOrder {
    id: number;
    number: number;
    status: "open" | "closed" | "cancelled";
    payment_status: string;
    total: string;
    subtotal: string;
    discount: string;
    shipping_cost_customer: string;
    total_usd: string;
    currency: string;
    created_at: string;
    storefront: string; // "store", "meli", "api", "form", "pos"
    shipping_status: string; // "unpacked", "unfulfilled", "fulfilled", "delivered"
    products: Array<{
        id: number;
        product_id: number;
        name: string;
        price: string;
        quantity: number;
    }>;
    customer?: { id: number };
}

export interface TiendaNubeDailyAggregate {
    date: string;
    metrics: UnifiedChannelMetrics;
    breakdown: {
        byStorefront: Record<string, { orders: number; revenue: number }>;
        totalProducts: number;
        topProducts?: Array<{ productId: number; title: string; unitsSold: number; revenue: number; orders: number }>;
        uniqueCustomers?: number;
        customerCohorts?: {
            firstTime: { count: number; revenue: number };
            returning: { count: number; revenue: number };
        };
        byPaymentStatus?: { paid: number; pending: number; refunded: number };
    };
}

// ── Service ──────────────────────────────────────────
export class TiendaNubeService {

    private static async fetchWithRetry(url: string, accessToken: string, retries = MAX_RETRIES): Promise<any> {
        for (let attempt = 0; attempt < retries; attempt++) {
            const response = await fetch(url, {
                headers: {
                    "Authentication": `bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    "User-Agent": "AI-Analyzer/1.0",
                },
            });

            if (response.ok) {
                return response.json();
            }

            if (response.status === 429) {
                // Rate limited — wait and retry
                const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
                console.warn(`[TiendaNube] Rate limited, waiting ${retryAfter}s...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }

            if (response.status >= 500) {
                // Server error — retry with backoff
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                continue;
            }

            const errorText = await response.text();
            throw new Error(`TiendaNube API error ${response.status}: ${errorText}`);
        }
        throw new Error(`TiendaNube API: max retries (${retries}) exceeded`);
    }

    /**
     * Fetch orders for a date range with pagination
     */
    static async fetchOrders(
        storeId: string,
        accessToken: string,
        startDate: string,
        endDate: string,
        paymentStatus = "paid"
    ): Promise<TiendaNubeOrder[]> {
        const allOrders: TiendaNubeOrder[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const url = `${BASE_URL}/${storeId}/orders?created_at_min=${startDate}T00:00:00&created_at_max=${endDate}T23:59:59&payment_status=${paymentStatus}&per_page=${PER_PAGE}&page=${page}`;

            const orders = await this.fetchWithRetry(url, accessToken);

            if (!Array.isArray(orders) || orders.length === 0) {
                hasMore = false;
            } else {
                allOrders.push(...orders);
                if (orders.length < PER_PAGE) {
                    hasMore = false;
                } else {
                    page++;
                    // Safety: max 10,000 results per TiendaNube API
                    if (allOrders.length >= 10000) {
                        console.warn("[TiendaNube] Reached 10,000 order limit");
                        hasMore = false;
                    }
                }
            }
        }

        return allOrders;
    }

    /**
     * Also fetch refunded orders separately for refund count
     */
    static async fetchRefundedOrders(
        storeId: string,
        accessToken: string,
        startDate: string,
        endDate: string
    ): Promise<TiendaNubeOrder[]> {
        try {
            const url = `${BASE_URL}/${storeId}/orders?created_at_min=${startDate}T00:00:00&created_at_max=${endDate}T23:59:59&payment_status=refunded&per_page=${PER_PAGE}`;
            const orders = await this.fetchWithRetry(url, accessToken);
            return Array.isArray(orders) ? orders : [];
        } catch {
            return [];
        }
    }

    /**
     * Aggregate orders into daily metrics
     */
    static aggregateByDay(
        paidOrders: TiendaNubeOrder[],
        refundedOrders: TiendaNubeOrder[] = []
    ): TiendaNubeDailyAggregate[] {
        const byDate = new Map<string, TiendaNubeOrder[]>();
        const refundsByDate = new Map<string, number>();

        for (const order of paidOrders) {
            const date = order.created_at.split("T")[0];
            const existing = byDate.get(date) || [];
            existing.push(order);
            byDate.set(date, existing);
        }

        for (const order of refundedOrders) {
            const date = order.created_at.split("T")[0];
            refundsByDate.set(date, (refundsByDate.get(date) || 0) + 1);
        }

        const aggregates: TiendaNubeDailyAggregate[] = [];

        for (const [date, orders] of byDate) {
            const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
            const totalSubtotal = orders.reduce((sum, o) => sum + parseFloat(o.subtotal || "0"), 0);
            const totalDiscount = orders.reduce((sum, o) => sum + parseFloat(o.discount || "0"), 0);
            const totalShipping = orders.reduce((sum, o) => sum + parseFloat(o.shipping_cost_customer || "0"), 0);
            const orderCount = orders.length;
            const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
            const refundCount = refundsByDate.get(date) || 0;

            // Fulfillment
            const fulfilledOrders = orders.filter(o =>
                o.shipping_status === "fulfilled" || o.shipping_status === "delivered"
            ).length;
            const cancelledOrders = orders.filter(o => o.status === "cancelled").length;

            // Items count
            let totalItems = 0;
            const productSales = new Map<number, { name: string; quantity: number; revenue: number; orders: number }>();

            // Customer tracking
            const customerIds = new Set<number>();
            const customerOrderCount = new Map<number, number>();
            const customerRevenue = new Map<number, number>();

            // Attribution by storefront
            const byStorefront: Record<string, { orders: number; revenue: number }> = {};

            for (const order of orders) {
                const sf = order.storefront || "unknown";
                if (!byStorefront[sf]) byStorefront[sf] = { orders: 0, revenue: 0 };
                byStorefront[sf].orders++;
                byStorefront[sf].revenue += parseFloat(order.total || "0");

                // Products
                for (const p of (order.products || [])) {
                    totalItems += p.quantity || 0;
                    const existing = productSales.get(p.product_id);
                    if (existing) {
                        existing.quantity += p.quantity || 0;
                        existing.revenue += parseFloat(p.price || "0") * (p.quantity || 0);
                        existing.orders++;
                    } else {
                        productSales.set(p.product_id, {
                            name: p.name,
                            quantity: p.quantity || 0,
                            revenue: parseFloat(p.price || "0") * (p.quantity || 0),
                            orders: 1,
                        });
                    }
                }

                // Customer
                if (order.customer?.id) {
                    const customerId = order.customer.id;
                    customerIds.add(customerId);
                    customerOrderCount.set(customerId, (customerOrderCount.get(customerId) || 0) + 1);
                    customerRevenue.set(customerId, (customerRevenue.get(customerId) || 0) + parseFloat(order.total || "0"));
                }
            }

            // Customer cohorts
            const customerCohorts = {
                firstTime: { count: 0, revenue: 0 },
                returning: { count: 0, revenue: 0 },
            };
            for (const [customerId, count] of customerOrderCount) {
                const revenue = customerRevenue.get(customerId) || 0;
                if (count === 1) {
                    customerCohorts.firstTime.count++;
                    customerCohorts.firstTime.revenue += revenue;
                } else {
                    customerCohorts.returning.count++;
                    customerCohorts.returning.revenue += revenue;
                }
            }

            // Payment status breakdown
            const byPaymentStatus = { paid: 0, pending: 0, refunded: 0 };
            for (const order of orders) {
                const status = (order.payment_status || "").toLowerCase();
                if (status === "paid" || status === "authorized") {
                    byPaymentStatus.paid++;
                } else if (status === "pending" || status === "voided") {
                    byPaymentStatus.pending++;
                } else if (status === "refunded") {
                    byPaymentStatus.refunded++;
                }
            }

            // Top products
            const topProducts = Array.from(productSales.entries())
                .map(([productId, data]) => ({ productId, title: data.name, unitsSold: data.quantity, revenue: data.revenue, orders: data.orders }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            aggregates.push({
                date,
                metrics: {
                    orders: orderCount,
                    revenue: totalRevenue,
                    avgOrderValue,
                    refunds: refundCount,
                    grossRevenue: totalSubtotal,
                    totalDiscounts: totalDiscount,
                    totalShipping: totalShipping,
                    fulfilledOrders,
                    cancelledOrders,
                    itemsPerOrder: orderCount > 0 ? totalItems / orderCount : 0,
                },
                breakdown: {
                    byStorefront,
                    totalProducts: totalItems,
                    topProducts,
                    uniqueCustomers: customerIds.size,
                    customerCohorts,
                    byPaymentStatus,
                },
            });
        }

        return aggregates.sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Full sync: fetch → aggregate → write to channel_snapshots
     */
    static async syncToChannelSnapshots(
        clientId: string,
        storeId: string,
        accessToken: string,
        startDate: string,
        endDate: string
    ): Promise<{ daysWritten: number; totalOrders: number; totalRevenue: number }> {
        console.log(`[TiendaNube] Syncing ${clientId} (store ${storeId}) for ${startDate} → ${endDate}`);

        const [paidOrders, refundedOrders] = await Promise.all([
            this.fetchOrders(storeId, accessToken, startDate, endDate, "paid"),
            this.fetchRefundedOrders(storeId, accessToken, startDate, endDate),
        ]);

        const dailyAggregates = this.aggregateByDay(paidOrders, refundedOrders);

        if (dailyAggregates.length === 0) {
            console.log(`[TiendaNube] No orders for ${clientId}`);
            return { daysWritten: 0, totalOrders: 0, totalRevenue: 0 };
        }

        const batch = db.batch();
        let totalOrders = 0;
        let totalRevenue = 0;

        for (const agg of dailyAggregates) {
            const docId = buildChannelSnapshotId(clientId, 'ECOMMERCE', agg.date);
            const snapshot: ChannelDailySnapshot = {
                clientId,
                channel: 'ECOMMERCE',
                date: agg.date,
                metrics: agg.metrics,
                rawData: {
                    byStorefront: agg.breakdown.byStorefront,
                    byAttribution: Object.entries(agg.breakdown.byStorefront).map(
                        ([source, data]) => ({ source, orders: data.orders, revenue: data.revenue })
                    ),
                    topProducts: agg.breakdown.topProducts,
                    totalProducts: agg.breakdown.totalProducts,
                    uniqueCustomers: agg.breakdown.uniqueCustomers,
                    customerCohorts: agg.breakdown.customerCohorts,
                    byPaymentStatus: agg.breakdown.byPaymentStatus,
                    source: 'tiendanube',
                },
                syncedAt: new Date().toISOString(),
            };
            batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
            totalOrders += agg.metrics.orders || 0;
            totalRevenue += agg.metrics.revenue || 0;
        }

        await batch.commit();
        console.log(`[TiendaNube] Wrote ${dailyAggregates.length} days for ${clientId}: ${totalOrders} orders, $${totalRevenue.toFixed(2)} revenue`);

        return { daysWritten: dailyAggregates.length, totalOrders, totalRevenue };
    }

}
