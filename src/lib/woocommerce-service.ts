/**
 * WooCommerce Service — REST API integration
 *
 * Fetches orders from WooCommerce REST API, aggregates daily metrics,
 * and writes to channel_snapshots collection.
 *
 * API Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
 * Base URL: https://{storeDomain}/wp-json/wc/v3
 * Auth: Basic Auth (Consumer Key + Consumer Secret)
 */

import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";
import { EcommerceCustomerService } from "@/lib/ecommerce-customer-service";

// ── Config ───────────────────────────────────────────
const PER_PAGE = 100; // WooCommerce max
const MAX_RETRIES = 3;

// ── Types ────────────────────────────────────────────
export interface WooCommerceOrder {
    id: number;
    number: string;
    status: string; // "processing", "completed", "refunded", "cancelled", "on-hold", "pending", "failed"
    currency: string;
    date_created: string; // ISO 8601
    total: string;
    discount_total: string;
    shipping_total: string;
    total_tax: string;
    customer_id: number;
    billing: {
        email: string;
        first_name: string;
        last_name: string;
        country?: string;
    };
    line_items: Array<{
        id: number;
        product_id: number;
        name: string;
        quantity: number;
        price: number;
        subtotal: string;
        total: string;
        sku: string;
    }>;
    coupon_lines: Array<{
        id: number;
        code: string;
        discount: string;
        discount_tax: string;
    }>;
    refunds: Array<{
        id: number;
        total: string;
        reason: string;
    }>;
    payment_method: string;
    payment_method_title: string;
    meta_data: Array<{ key: string; value: string }>;
}

export interface WooCommerceDailyAggregate {
    date: string;
    metrics: UnifiedChannelMetrics;
    rawData: {
        source: 'woocommerce';
        byPaymentMethod: Record<string, { orders: number; revenue: number }>;
        byAttribution: Array<{ source: string; orders: number; revenue: number }>;
        topProducts: Array<{ productId: number; title: string; unitsSold: number; revenue: number; orders: number }>;
        topDiscountCodes: Array<{ code: string; uses: number; totalDiscount: number }>;
        byCountry: Array<{ country: string; orders: number; revenue: number }>;
        refundDetail: { totalAmount: number; refundedItems: number };
        totalProducts: number;
        uniqueCustomers: number;
        customerCohorts?: {
            firstTime: { count: number; revenue: number };
            returning: { count: number; revenue: number };
        };
    };
}

// ── Service ──────────────────────────────────────────
export class WooCommerceService {

    private static baseUrl(storeDomain: string): string {
        const domain = storeDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        return `https://${domain}/wp-json/wc/v3`;
    }

    private static authParams(consumerKey: string, consumerSecret: string): string {
        return `consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}`;
    }

    private static async fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<any> {
        for (let attempt = 0; attempt < retries; attempt++) {
            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "AI-Analyzer/1.0",
                },
            });

            if (response.ok) {
                return { data: await response.json(), headers: response.headers };
            }

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
                console.warn(`[WooCommerce] Rate limited, waiting ${retryAfter}s...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }

            if (response.status >= 500) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                continue;
            }

            const errorText = await response.text();
            throw new Error(`WooCommerce API error ${response.status}: ${errorText}`);
        }
        throw new Error(`WooCommerce API: max retries (${retries}) exceeded`);
    }

    /**
     * Fetch orders for a date range with page-based pagination
     */
    static async fetchOrders(
        storeDomain: string,
        consumerKey: string,
        consumerSecret: string,
        startDate: string,
        endDate: string,
        statuses: string[] = ["processing", "completed", "refunded", "on-hold"]
    ): Promise<WooCommerceOrder[]> {
        const allOrders: WooCommerceOrder[] = [];
        let page = 1;
        let hasMore = true;
        const base = this.baseUrl(storeDomain);
        const auth = this.authParams(consumerKey, consumerSecret);

        while (hasMore) {
            const statusParam = statuses.map(s => `status=${s}`).join("&");
            const url = `${base}/orders?${auth}&${statusParam}&after=${startDate}T00:00:00&before=${endDate}T23:59:59&per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc`;

            const { data: orders, headers } = await this.fetchWithRetry(url);

            if (!Array.isArray(orders) || orders.length === 0) {
                hasMore = false;
            } else {
                allOrders.push(...orders);
                const totalPages = parseInt(headers.get("X-WP-TotalPages") || "1", 10);
                if (page >= totalPages) {
                    hasMore = false;
                } else {
                    page++;
                }
                if (allOrders.length >= 10000) {
                    console.warn("[WooCommerce] Reached 10,000 order limit");
                    hasMore = false;
                }
            }
        }

        return allOrders;
    }

    /**
     * Aggregate orders into daily metrics
     */
    static aggregateByDay(allOrders: WooCommerceOrder[]): WooCommerceDailyAggregate[] {
        const byDate = new Map<string, WooCommerceOrder[]>();

        for (const order of allOrders) {
            const date = order.date_created.split("T")[0];
            const arr = byDate.get(date) || [];
            arr.push(order);
            byDate.set(date, arr);
        }

        const aggregates: WooCommerceDailyAggregate[] = [];

        for (const [date, orders] of byDate) {
            // Filter by status
            const paidOrders = orders.filter(o =>
                ["processing", "completed", "on-hold"].includes(o.status)
            );
            const refundedOrders = orders.filter(o => o.status === "refunded");
            const cancelledOrders = orders.filter(o => o.status === "cancelled" || o.status === "failed");
            const fulfilledOrders = paidOrders.filter(o => o.status === "completed");

            // Revenue & Financial
            const grossRevenue = paidOrders.reduce((s, o) => {
                return s + o.line_items.reduce((ls, li) => ls + parseFloat(li.subtotal || "0"), 0);
            }, 0);
            const totalRevenue = paidOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0);
            const totalDiscounts = paidOrders.reduce((s, o) => s + parseFloat(o.discount_total || "0"), 0);
            const totalTax = paidOrders.reduce((s, o) => s + parseFloat(o.total_tax || "0"), 0);
            const totalShipping = paidOrders.reduce((s, o) => s + parseFloat(o.shipping_total || "0"), 0);
            const orderCount = paidOrders.length;
            const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
            const discountRate = grossRevenue > 0 ? (totalDiscounts / grossRevenue) * 100 : 0;

            // Items per order
            const totalItems = paidOrders.reduce((s, o) =>
                s + o.line_items.reduce((ls, li) => ls + li.quantity, 0), 0
            );
            const itemsPerOrder = orderCount > 0 ? totalItems / orderCount : 0;

            // Customer tracking with revenue per customer
            const customerIds = new Set<number>();
            const customerOrderCount = new Map<number, number>();
            const customerRevenue = new Map<number, number>();
            for (const order of paidOrders) {
                if (order.customer_id > 0) {
                    customerIds.add(order.customer_id);
                    customerOrderCount.set(order.customer_id, (customerOrderCount.get(order.customer_id) || 0) + 1);
                    customerRevenue.set(order.customer_id, (customerRevenue.get(order.customer_id) || 0) + parseFloat(order.total || "0"));
                }
            }

            // Customer cohorts (based on orders within sync window)
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

            // Fulfillment
            const fulfillmentRate = orderCount > 0
                ? (fulfilledOrders.length / orderCount) * 100
                : 0;

            // Payment method breakdown (WooCommerce equivalent of attribution)
            const paymentMap: Record<string, { orders: number; revenue: number }> = {};
            for (const order of paidOrders) {
                const method = order.payment_method_title || order.payment_method || "unknown";
                if (!paymentMap[method]) paymentMap[method] = { orders: 0, revenue: 0 };
                paymentMap[method].orders++;
                paymentMap[method].revenue += parseFloat(order.total || "0");
            }

            // UTM attribution from meta_data
            const attrMap = new Map<string, { orders: number; revenue: number }>();
            for (const order of paidOrders) {
                const source = this.extractAttribution(order);
                const existing = attrMap.get(source) || { orders: 0, revenue: 0 };
                existing.orders++;
                existing.revenue += parseFloat(order.total || "0");
                attrMap.set(source, existing);
            }
            const byAttribution = Array.from(attrMap.entries())
                .map(([source, data]) => ({ source, ...data }))
                .sort((a, b) => b.revenue - a.revenue);

            // Top products
            const productMap = new Map<number, { title: string; unitsSold: number; revenue: number; orders: number }>();
            for (const order of paidOrders) {
                for (const li of order.line_items) {
                    const existing = productMap.get(li.product_id);
                    const liRevenue = parseFloat(li.total || "0");
                    if (existing) {
                        existing.unitsSold += li.quantity;
                        existing.revenue += liRevenue;
                        existing.orders++;
                    } else {
                        productMap.set(li.product_id, {
                            title: li.name,
                            unitsSold: li.quantity,
                            revenue: liRevenue,
                            orders: 1,
                        });
                    }
                }
            }
            const topProducts = Array.from(productMap.entries())
                .map(([productId, data]) => ({ productId, ...data }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            // Discount codes aggregation
            const discountCodeMap = new Map<string, { uses: number; totalDiscount: number }>();
            for (const order of paidOrders) {
                for (const coupon of order.coupon_lines) {
                    const code = coupon.code.toUpperCase();
                    const existing = discountCodeMap.get(code) || { uses: 0, totalDiscount: 0 };
                    existing.uses++;
                    existing.totalDiscount += parseFloat(coupon.discount || "0");
                    discountCodeMap.set(code, existing);
                }
            }
            const topDiscountCodes = Array.from(discountCodeMap.entries())
                .map(([code, data]) => ({ code, ...data }))
                .sort((a, b) => b.uses - a.uses)
                .slice(0, 5);

            // Country breakdown
            const countryMap = new Map<string, { orders: number; revenue: number }>();
            for (const order of paidOrders) {
                const country = order.billing?.country || "Unknown";
                const existing = countryMap.get(country) || { orders: 0, revenue: 0 };
                existing.orders++;
                existing.revenue += parseFloat(order.total || "0");
                countryMap.set(country, existing);
            }
            const byCountry = Array.from(countryMap.entries())
                .map(([country, data]) => ({ country, ...data }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            // Refund detail aggregation
            let totalRefundAmount = 0;
            let refundedItems = 0;
            for (const order of orders) {
                if (order.refunds && order.refunds.length > 0) {
                    for (const refund of order.refunds) {
                        // Refund totals are negative in WooCommerce, so we take absolute value
                        totalRefundAmount += Math.abs(parseFloat(refund.total || "0"));
                    }
                    refundedItems += order.refunds.length;
                }
            }
            const refundDetail = { totalAmount: totalRefundAmount, refundedItems };
            const refundRate = totalRevenue > 0 ? (totalRefundAmount / totalRevenue) * 100 : 0;

            aggregates.push({
                date,
                metrics: {
                    orders: orderCount,
                    revenue: totalRevenue,
                    avgOrderValue,
                    refunds: refundedOrders.length,
                    grossRevenue,
                    netRevenue: totalRevenue,
                    totalDiscounts,
                    discountRate,
                    totalTax,
                    totalShipping,
                    itemsPerOrder,
                    cancelledOrders: cancelledOrders.length,
                    fulfilledOrders: fulfilledOrders.length,
                    fulfillmentRate,
                    totalRefundAmount,
                    refundRate,
                },
                rawData: {
                    source: 'woocommerce',
                    byPaymentMethod: paymentMap,
                    byAttribution,
                    topProducts,
                    topDiscountCodes,
                    byCountry,
                    refundDetail,
                    totalProducts: totalItems,
                    uniqueCustomers: customerIds.size,
                    customerCohorts,
                },
            });
        }

        return aggregates.sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Extract attribution source from order meta_data (UTM tracking plugins)
     */
    private static extractAttribution(order: WooCommerceOrder): string {
        const meta = order.meta_data || [];
        const utmSource = meta.find(m =>
            m.key === "_wc_order_attribution_utm_source" ||
            m.key === "_utm_source" ||
            m.key === "utm_source"
        )?.value?.toLowerCase();

        if (utmSource) {
            const utmMedium = meta.find(m =>
                m.key === "_wc_order_attribution_utm_medium" ||
                m.key === "_utm_medium" ||
                m.key === "utm_medium"
            )?.value?.toLowerCase() || "";

            if (utmSource.includes("facebook") || utmSource.includes("fb") || utmSource.includes("instagram") || utmSource.includes("ig")) return "meta_ads";
            if (utmSource.includes("google") && utmMedium === "cpc") return "google_ads";
            if (utmSource.includes("klaviyo") || utmMedium === "email") return "email";
            if (utmMedium === "cpc" || utmMedium === "paid") return "paid_other";
            return `utm_${utmSource}`;
        }

        // WooCommerce native attribution (WC 8.5+)
        const sourceType = meta.find(m => m.key === "_wc_order_attribution_source_type")?.value;
        if (sourceType) {
            if (sourceType === "organic") return "google_organic";
            if (sourceType === "referral") return "referral";
            if (sourceType === "direct") return "direct";
            if (sourceType === "typein") return "direct";
        }

        return "direct";
    }

    /**
     * Full sync: fetch orders → aggregate → write to channel_snapshots
     */
    static async syncToChannelSnapshots(
        clientId: string,
        storeDomain: string,
        consumerKey: string,
        consumerSecret: string,
        startDate: string,
        endDate: string
    ): Promise<{ daysWritten: number; totalOrders: number; totalRevenue: number }> {
        console.log(`[WooCommerce] Syncing ${clientId} (${storeDomain}) for ${startDate} → ${endDate}`);

        const allOrders = await this.fetchOrders(storeDomain, consumerKey, consumerSecret, startDate, endDate);

        console.log(`[WooCommerce] Fetched ${allOrders.length} orders for ${clientId}`);

        // Upsert customer records for lifetime tracking (skip guest orders)
        const paidForCustomers = allOrders.filter(o =>
            ["processing", "completed", "on-hold"].includes(o.status) && o.customer_id > 0
        );
        const orderInputs = paidForCustomers.map(o => ({
            customerId: String(o.customer_id),
            email: o.billing?.email || undefined,
            date: o.date_created.split("T")[0],
            totalPrice: parseFloat(o.total || "0"),
        }));
        await EcommerceCustomerService.upsertFromOrders(clientId, 'woocommerce', orderInputs);

        // Compute customer intelligence + LTV:CAC
        const periodRevenue = paidForCustomers.reduce((s, o) => s + parseFloat(o.total || "0"), 0);
        const uniqueIds = new Set(paidForCustomers.map(o => o.customer_id));

        const intelligence = await EcommerceCustomerService.computeCustomerIntelligence(
            clientId, periodRevenue, uniqueIds.size
        );

        const newCustomerCount = intelligence.cohorts.firstTime.count;
        const ltvCac = await EcommerceCustomerService.computeLtvCac(
            clientId, startDate, endDate, intelligence.avgLifetimeLtv, newCustomerCount
        );
        intelligence.ltvCac = ltvCac || undefined;

        const retention = await EcommerceCustomerService.computeRetention(
            clientId, startDate, endDate,
            this.shiftDateBack(startDate, startDate, endDate),
            this.shiftDateBack(endDate, startDate, endDate)
        );
        intelligence.retentionRate = retention;

        const dailyAggregates = this.aggregateByDay(allOrders);

        if (dailyAggregates.length === 0) {
            console.log(`[WooCommerce] No data for ${clientId}`);
            return { daysWritten: 0, totalOrders: 0, totalRevenue: 0 };
        }

        const batch = db.batch();
        let totalOrders = 0;
        let totalRevenue = 0;

        for (const agg of dailyAggregates) {
            const docId = buildChannelSnapshotId(clientId, 'ECOMMERCE', agg.date);
            const rawData = agg.rawData as Record<string, unknown>;
            rawData.customerIntelligence = intelligence;
            const snapshot: ChannelDailySnapshot = {
                clientId,
                channel: 'ECOMMERCE',
                date: agg.date,
                metrics: agg.metrics,
                rawData,
                syncedAt: new Date().toISOString(),
            };
            batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
            totalOrders += agg.metrics.orders || 0;
            totalRevenue += agg.metrics.revenue || 0;
        }

        await batch.commit();
        console.log(`[WooCommerce] Wrote ${dailyAggregates.length} days for ${clientId}: ${totalOrders} orders, $${totalRevenue.toFixed(2)} revenue`);

        return { daysWritten: dailyAggregates.length, totalOrders, totalRevenue };
    }

    /** Shift a date back by the length of a period */
    private static shiftDateBack(date: string, periodStart: string, periodEnd: string): string {
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const d = new Date(date);
        d.setDate(d.getDate() - days);
        return d.toISOString().split("T")[0];
    }
}
