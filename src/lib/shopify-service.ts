/**
 * Shopify Service — REST Admin API integration (Expanded)
 *
 * Fetches orders, customers, and abandoned checkouts from Shopify REST Admin API.
 * Aggregates daily metrics with UTM attribution, top products, and customer segmentation.
 * Writes to channel_snapshots collection.
 *
 * API Docs: https://shopify.dev/docs/api/admin-rest/2024-01
 * Auth: X-Shopify-Access-Token header
 *
 * Scopes required: read_orders, read_products, read_analytics, read_customers, read_checkouts
 */

import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";

// ── Config ───────────────────────────────────────────
const API_VERSION = "2024-01";
const PER_PAGE = 250; // Shopify max
const MAX_RETRIES = 3;

// ── Types ────────────────────────────────────────────
export interface ShopifyOrder {
    id: number;
    name: string;
    financial_status: string;
    fulfillment_status: string | null;
    total_price: string;
    subtotal_price: string;
    total_line_items_price: string;
    total_discounts: string;
    total_tax: string;
    total_shipping_price_set?: { shop_money: { amount: string } };
    currency: string;
    created_at: string;
    cancelled_at: string | null;
    cancel_reason: string | null;
    source_name: string;
    referring_site: string | null;
    landing_site: string | null;
    discount_codes: Array<{ code: string; amount: string; type: string }>;
    line_items: Array<{
        id: number;
        product_id: number;
        title: string;
        name: string;
        price: string;
        quantity: number;
        total_discount: string;
        sku: string;
        variant_title: string;
    }>;
    customer?: {
        id: number;
        email: string;
        orders_count: number;
        total_spent: string;
        created_at: string;
    };
    refunds: Array<{
        id: number;
        created_at: string;
        refund_line_items: Array<{ quantity: number; subtotal: number }>;
    }>;
    fulfillments: Array<{
        id: number;
        status: string;
        created_at: string;
    }>;
}

export interface ShopifyCheckout {
    id: number;
    token: string;
    email: string | null;
    created_at: string;
    completed_at: string | null;
    total_price: string;
    total_line_items_price: string;
    landing_site: string | null;
    referring_site: string | null;
    line_items: Array<{
        product_id: number;
        title: string;
        quantity: number;
        price: string;
    }>;
}

export interface UTMData {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    term: string;
}

export interface ProductPerformance {
    productId: number;
    title: string;
    unitsSold: number;
    revenue: number;
    orders: number;
    avgPrice: number;
}

export interface AttributionBreakdown {
    source: string;
    orders: number;
    revenue: number;
}

export interface ShopifyDailyAggregate {
    date: string;
    metrics: UnifiedChannelMetrics;
    rawData: {
        source: 'shopify';
        bySource: Record<string, { orders: number; revenue: number }>;
        byAttribution: AttributionBreakdown[];
        topProducts: ProductPerformance[];
        topDiscountCodes: Array<{ code: string; uses: number; totalDiscount: number }>;
        totalProducts: number;
    };
}

// ── UTM Parser ──────────────────────────────────────
function parseUTM(landingSite: string | null): UTMData | null {
    if (!landingSite) return null;
    try {
        const url = new URL(landingSite, "https://placeholder.com");
        const source = url.searchParams.get("utm_source");
        if (!source) return null;
        return {
            source: source.toLowerCase(),
            medium: (url.searchParams.get("utm_medium") || "").toLowerCase(),
            campaign: url.searchParams.get("utm_campaign") || "",
            content: url.searchParams.get("utm_content") || "",
            term: url.searchParams.get("utm_term") || "",
        };
    } catch {
        return null;
    }
}

function classifyReferrer(referringSite: string | null, landingSite: string | null): string {
    const utm = parseUTM(landingSite);
    if (utm) {
        if (utm.source.includes("facebook") || utm.source.includes("fb") || utm.source.includes("instagram") || utm.source.includes("ig")) return "meta_ads";
        if (utm.source.includes("google") && utm.medium === "cpc") return "google_ads";
        if (utm.source.includes("klaviyo") || utm.medium === "email") return "email";
        if (utm.medium === "cpc" || utm.medium === "paid") return "paid_other";
        return `utm_${utm.source}`;
    }
    if (!referringSite) return "direct";
    const ref = referringSite.toLowerCase();
    if (ref.includes("facebook.com") || ref.includes("instagram.com") || ref.includes("fb.com")) return "meta_organic";
    if (ref.includes("google.com") || ref.includes("google.com.ar")) return "google_organic";
    if (ref.includes("tiktok.com")) return "tiktok";
    if (ref.includes("pinterest.com")) return "pinterest";
    if (ref.includes("youtube.com")) return "youtube";
    return "referral";
}

// ── Service ──────────────────────────────────────────
export class ShopifyService {

    private static baseUrl(storeDomain: string): string {
        const domain = storeDomain.replace(/^https?:\/\//, "");
        return `https://${domain}/admin/api/${API_VERSION}`;
    }

    /**
     * Generic paginated fetch using Shopify Link header cursor pagination
     */
    private static async fetchAllPaginated<T>(
        initialUrl: string,
        accessToken: string,
        dataKey: string,
        maxResults = 10000
    ): Promise<T[]> {
        const allResults: T[] = [];
        let url: string | null = initialUrl;

        while (url) {
            let response: Response | null = null;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                response = await fetch(url, {
                    headers: {
                        "X-Shopify-Access-Token": accessToken,
                        "Content-Type": "application/json",
                    },
                });

                if (response.ok) break;

                if (response.status === 429) {
                    const retryAfter = parseFloat(response.headers.get("Retry-After") || "2");
                    console.warn(`[Shopify] Rate limited, waiting ${retryAfter}s...`);
                    await new Promise(r => setTimeout(r, retryAfter * 1000));
                    continue;
                }

                if (response.status >= 500) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    continue;
                }

                const errorText = await response.text();
                throw new Error(`Shopify API error ${response.status}: ${errorText}`);
            }

            if (!response || !response.ok) {
                throw new Error(`Shopify API: max retries exceeded`);
            }

            const data = await response.json();
            const items: T[] = data[dataKey] || [];
            allResults.push(...items);

            // Cursor pagination via Link header
            const linkHeader = response.headers.get("Link");
            url = this.parseNextPageUrl(linkHeader);

            if (allResults.length >= maxResults) {
                console.warn(`[Shopify] Reached ${maxResults} result limit for ${dataKey}`);
                break;
            }
        }

        return allResults;
    }

    private static parseNextPageUrl(linkHeader: string | null): string | null {
        if (!linkHeader) return null;
        const parts = linkHeader.split(",");
        for (const part of parts) {
            const match = part.match(/<([^>]+)>;\s*rel="next"/);
            if (match) return match[1];
        }
        return null;
    }

    // ── Fetch Orders (all statuses for comprehensive analysis) ──

    static async fetchOrders(
        storeDomain: string,
        accessToken: string,
        startDate: string,
        endDate: string
    ): Promise<ShopifyOrder[]> {
        const base = this.baseUrl(storeDomain);
        const url = `${base}/orders.json?status=any&created_at_min=${startDate}T00:00:00Z&created_at_max=${endDate}T23:59:59Z&limit=${PER_PAGE}`;
        return this.fetchAllPaginated<ShopifyOrder>(url, accessToken, "orders");
    }

    // ── Fetch Abandoned Checkouts ──

    static async fetchAbandonedCheckouts(
        storeDomain: string,
        accessToken: string,
        startDate: string,
        endDate: string
    ): Promise<ShopifyCheckout[]> {
        try {
            const base = this.baseUrl(storeDomain);
            const url = `${base}/checkouts.json?created_at_min=${startDate}T00:00:00Z&created_at_max=${endDate}T23:59:59Z&limit=${PER_PAGE}`;
            const checkouts = await this.fetchAllPaginated<ShopifyCheckout>(url, accessToken, "checkouts");
            // Only return abandoned (completed_at is null)
            return checkouts.filter(c => !c.completed_at);
        } catch (e: any) {
            // Graceful degradation if scope not yet granted
            console.warn(`[Shopify] Could not fetch checkouts: ${e.message}`);
            return [];
        }
    }

    // ── Aggregate Orders Into Daily Metrics ──

    static aggregateByDay(
        allOrders: ShopifyOrder[],
        abandonedCheckouts: ShopifyCheckout[] = []
    ): ShopifyDailyAggregate[] {
        const byDate = new Map<string, ShopifyOrder[]>();
        const abandonedByDate = new Map<string, ShopifyCheckout[]>();

        for (const order of allOrders) {
            const date = order.created_at.split("T")[0];
            const arr = byDate.get(date) || [];
            arr.push(order);
            byDate.set(date, arr);
        }

        for (const checkout of abandonedCheckouts) {
            const date = checkout.created_at.split("T")[0];
            const arr = abandonedByDate.get(date) || [];
            arr.push(checkout);
            abandonedByDate.set(date, arr);
        }

        // Combine all dates
        const allDates = new Set([...byDate.keys(), ...abandonedByDate.keys()]);
        const aggregates: ShopifyDailyAggregate[] = [];

        for (const date of allDates) {
            const orders = byDate.get(date) || [];
            const abandoned = abandonedByDate.get(date) || [];

            // Filter by financial status
            const paidOrders = orders.filter(o =>
                ["paid", "partially_paid", "partially_refunded"].includes(o.financial_status)
            );
            const refundedOrders = orders.filter(o => o.financial_status === "refunded");
            const cancelledOrders = orders.filter(o => o.cancelled_at !== null);
            const fulfilledOrders = paidOrders.filter(o => o.fulfillment_status === "fulfilled");

            // Revenue & Financial
            const grossRevenue = paidOrders.reduce((s, o) => s + parseFloat(o.total_line_items_price || "0"), 0);
            const totalRevenue = paidOrders.reduce((s, o) => s + parseFloat(o.total_price || "0"), 0);
            const totalDiscounts = paidOrders.reduce((s, o) => s + parseFloat(o.total_discounts || "0"), 0);
            const totalTax = paidOrders.reduce((s, o) => s + parseFloat(o.total_tax || "0"), 0);
            const totalShipping = paidOrders.reduce((s, o) => {
                return s + parseFloat(o.total_shipping_price_set?.shop_money?.amount || "0");
            }, 0);
            const orderCount = paidOrders.length;
            const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
            const discountRate = grossRevenue > 0 ? (totalDiscounts / grossRevenue) * 100 : 0;

            // Items per order
            const totalItems = paidOrders.reduce((s, o) =>
                s + o.line_items.reduce((ls, li) => ls + li.quantity, 0), 0
            );
            const itemsPerOrder = orderCount > 0 ? totalItems / orderCount : 0;

            // Customer segmentation (new vs returning)
            let newCustomers = 0;
            let returningCustomers = 0;
            for (const order of paidOrders) {
                if (order.customer) {
                    if (order.customer.orders_count <= 1) {
                        newCustomers++;
                    } else {
                        returningCustomers++;
                    }
                }
            }
            const totalCustomerOrders = newCustomers + returningCustomers;
            const repeatPurchaseRate = totalCustomerOrders > 0
                ? (returningCustomers / totalCustomerOrders) * 100
                : 0;

            // Abandoned checkouts
            const abandonedCount = abandoned.length;
            const abandonedValue = abandoned.reduce((s, c) => s + parseFloat(c.total_price || "0"), 0);
            const cartAbandonmentRate = (abandonedCount + orderCount) > 0
                ? (abandonedCount / (abandonedCount + orderCount)) * 100
                : 0;

            // Fulfillment
            const fulfillmentRate = orderCount > 0
                ? (fulfilledOrders.length / orderCount) * 100
                : 0;

            // Attribution breakdown
            const attrMap = new Map<string, { orders: number; revenue: number }>();
            for (const order of paidOrders) {
                const channel = classifyReferrer(order.referring_site, order.landing_site);
                const existing = attrMap.get(channel) || { orders: 0, revenue: 0 };
                existing.orders++;
                existing.revenue += parseFloat(order.total_price || "0");
                attrMap.set(channel, existing);
            }
            const byAttribution: AttributionBreakdown[] = Array.from(attrMap.entries())
                .map(([source, data]) => ({ source, ...data }))
                .sort((a, b) => b.revenue - a.revenue);

            // Source breakdown (Shopify source_name)
            const bySource: Record<string, { orders: number; revenue: number }> = {};
            for (const order of paidOrders) {
                const src = order.source_name || "unknown";
                if (!bySource[src]) bySource[src] = { orders: 0, revenue: 0 };
                bySource[src].orders++;
                bySource[src].revenue += parseFloat(order.total_price || "0");
            }

            // Top products
            const productMap = new Map<number, ProductPerformance>();
            for (const order of paidOrders) {
                for (const li of order.line_items) {
                    const existing = productMap.get(li.product_id);
                    const liRevenue = parseFloat(li.price) * li.quantity;
                    if (existing) {
                        existing.unitsSold += li.quantity;
                        existing.revenue += liRevenue;
                        existing.orders++;
                    } else {
                        productMap.set(li.product_id, {
                            productId: li.product_id,
                            title: li.title || li.name,
                            unitsSold: li.quantity,
                            revenue: liRevenue,
                            orders: 1,
                            avgPrice: parseFloat(li.price),
                        });
                    }
                }
            }
            const topProducts = Array.from(productMap.values())
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            // Discount codes aggregation
            const discountMap = new Map<string, { uses: number; totalDiscount: number }>();
            for (const order of paidOrders) {
                for (const dc of order.discount_codes) {
                    const code = dc.code.toUpperCase();
                    const existing = discountMap.get(code) || { uses: 0, totalDiscount: 0 };
                    existing.uses++;
                    existing.totalDiscount += parseFloat(dc.amount || "0");
                    discountMap.set(code, existing);
                }
            }
            const topDiscountCodes = Array.from(discountMap.entries())
                .map(([code, data]) => ({ code, ...data }))
                .sort((a, b) => b.uses - a.uses)
                .slice(0, 5);

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
                    newCustomers,
                    returningCustomers,
                    repeatPurchaseRate,
                    abandonedCheckouts: abandonedCount,
                    abandonedCheckoutValue: abandonedValue,
                    cartAbandonmentRate,
                },
                rawData: {
                    source: 'shopify',
                    bySource,
                    byAttribution,
                    topProducts,
                    topDiscountCodes,
                    totalProducts: totalItems,
                },
            });
        }

        return aggregates.sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Full sync: fetch orders + checkouts → aggregate → write to channel_snapshots
     */
    static async syncToChannelSnapshots(
        clientId: string,
        storeDomain: string,
        accessToken: string,
        startDate: string,
        endDate: string
    ): Promise<{ daysWritten: number; totalOrders: number; totalRevenue: number }> {
        console.log(`[Shopify] Syncing ${clientId} (${storeDomain}) for ${startDate} → ${endDate}`);

        const [allOrders, abandonedCheckouts] = await Promise.all([
            this.fetchOrders(storeDomain, accessToken, startDate, endDate),
            this.fetchAbandonedCheckouts(storeDomain, accessToken, startDate, endDate),
        ]);

        console.log(`[Shopify] Fetched ${allOrders.length} orders, ${abandonedCheckouts.length} abandoned checkouts for ${clientId}`);

        const dailyAggregates = this.aggregateByDay(allOrders, abandonedCheckouts);

        if (dailyAggregates.length === 0) {
            console.log(`[Shopify] No data for ${clientId}`);
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
                rawData: agg.rawData as unknown as Record<string, unknown>,
                syncedAt: new Date().toISOString(),
            };
            batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
            totalOrders += agg.metrics.orders || 0;
            totalRevenue += agg.metrics.revenue || 0;
        }

        await batch.commit();
        console.log(`[Shopify] Wrote ${dailyAggregates.length} days for ${clientId}: ${totalOrders} orders, $${totalRevenue.toFixed(2)} revenue`);

        return { daysWritten: dailyAggregates.length, totalOrders, totalRevenue };
    }
}
