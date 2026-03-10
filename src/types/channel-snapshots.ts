/**
 * Channel Snapshots — Unified daily metrics per channel
 *
 * All channels (Meta, Google, Ecommerce, Email) write to the same
 * `channel_snapshots` Firestore collection using this schema.
 * Document ID pattern: `{clientId}__{channelType}__{YYYY-MM-DD}`
 *
 * This is the cross-channel aggregation layer that feeds:
 * - Per-channel dashboards
 * - Unified overview dashboard
 * - Semáforo engine (quarterly pacing)
 */

import { ChannelType } from "@/lib/channel-brain-interface";

/**
 * Unified daily snapshot for any channel
 */
export interface ChannelDailySnapshot {
    clientId: string;
    channel: ChannelType;
    date: string; // YYYY-MM-DD
    metrics: UnifiedChannelMetrics;
    /** Channel-specific extra data (e.g., campaign breakdown, product details) */
    rawData?: Record<string, unknown>;
    syncedAt: string; // ISO 8601
}

/**
 * Unified metrics interface — all channels report into these fields.
 * Not all fields apply to all channels; undefined means "not applicable".
 */
export interface UnifiedChannelMetrics {
    // ── Ads Core (Meta + Google) ──────────────────
    spend?: number;
    revenue?: number;
    conversions?: number;       // Primary conversion (purchases || leads || messages)
    purchases?: number;         // Explicit purchase count (Meta/Google) — use for "compras" display
    leads?: number;             // Lead conversions (Meta/Google)
    roas?: number;
    cpa?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    reach?: number;
    frequency?: number;

    // ── Ads Click Quality (Meta) ──────────────────
    inlineLinkClicks?: number;        // Clicks to destination URL (excludes reactions/profile clicks)
    inlineLinkClickCtr?: number;      // Destination click CTR %
    costPerInlineLinkClick?: number;  // Cost per destination click
    uniqueClicks?: number;            // Deduplicated click count
    outboundClicks?: number;          // All outbound clicks

    // ── Ads Cost Efficiency ───────────────────────
    cpm?: number;                     // Cost per 1000 impressions (Meta + Google)
    cpp?: number;                     // Meta: Cost per 1000 reach

    // ── Ads Mid-Funnel (Meta) ─────────────────────
    addToCart?: number;               // add_to_cart actions
    initiateCheckout?: number;        // initiate_checkout actions
    viewContent?: number;             // view_content actions
    costPerAddToCart?: number;
    costPerInitiateCheckout?: number;

    // ── Ads Quality Signals (Meta) ────────────────
    qualityRanking?: string;          // BELOW_AVERAGE | AVERAGE | ABOVE_AVERAGE
    engagementRateRanking?: string;
    conversionRateRanking?: string;

    // ── Google Search Specific ────────────────────
    searchImpressionShare?: number;   // % of available impressions won
    searchBudgetLostIS?: number;      // % lost to budget cap
    searchRankLostIS?: number;        // % lost to low ad rank
    allConversions?: number;          // Includes cross-device conversions
    allConversionsValue?: number;
    viewThroughConversions?: number;  // Impression-assisted (no click)
    conversionRate?: number;          // conversions / clicks %

    // ── Video Metrics (Meta + Google) ─────────────
    videoPlays?: number;
    videoP25?: number;
    videoP50?: number;
    videoP75?: number;
    videoP100?: number;
    video30sViews?: number;           // Meta: standard video view (30s or full)
    videoAvgWatchTime?: number;       // Meta: avg watch seconds

    // ── Social Engagement (Meta) ──────────────────
    postEngagement?: number;          // Total post interactions
    postReactions?: number;
    postComments?: number;
    postShares?: number;

    // ── Ecommerce (Tienda Nube / Shopify / WooCommerce) ────────
    orders?: number;
    avgOrderValue?: number;
    refunds?: number;
    grossRevenue?: number;         // Before discounts
    netRevenue?: number;           // After discounts & refunds
    totalDiscounts?: number;       // Sum of all discounts
    discountRate?: number;         // discounts / grossRevenue %
    totalTax?: number;
    totalShipping?: number;        // Shipping charged to customer
    itemsPerOrder?: number;        // Avg items per order
    cancelledOrders?: number;
    fulfilledOrders?: number;
    fulfillmentRate?: number;      // fulfilled / total %
    newCustomers?: number;         // First-time buyers
    returningCustomers?: number;   // Repeat buyers
    repeatPurchaseRate?: number;   // returning / total %
    abandonedCheckouts?: number;
    abandonedCheckoutValue?: number;
    cartAbandonmentRate?: number;  // abandoned / (abandoned + orders) %
    totalRefundAmount?: number;    // $ amount refunded
    refundRate?: number;           // refundAmount / revenue %

    // ── Email (Perfit / Klaviyo) ──────────────────
    sent?: number;
    delivered?: number;
    opens?: number;
    openRate?: number;
    emailClicks?: number;
    clickRate?: number;
    bounces?: number;
    unsubscribes?: number;
    emailRevenue?: number;
    clickToOpenRate?: number;      // CTOR: clicks / opens % (content quality)
    revenuePerRecipient?: number;  // revenue / sent
    spamComplaints?: number;       // ISP spam reports (Klaviyo)

    // ── GA4 Web Analytics ────────────────────────
    sessions?: number;
    totalUsers?: number;
    newUsers?: number;
    pageviews?: number;
    bounceRate?: number;           // % (0-100)
    avgSessionDuration?: number;   // seconds
    engagedSessions?: number;
    engagementRate?: number;       // % (0-100)
    sessionsPerUser?: number;
    pageviewsPerSession?: number;
    // GA4 Ecommerce Funnel
    viewItem?: number;             // view_item events
    beginCheckout?: number;        // begin_checkout events
    ecommercePurchases?: number;   // purchase events
    purchaseRevenue?: number;      // GA4-reported revenue
    ecommerceConversionRate?: number; // purchases/sessions %
}

/**
 * Helper to build the composite document ID
 */
export function buildChannelSnapshotId(
    clientId: string,
    channel: ChannelType,
    date: string
): string {
    return `${clientId}__${channel}__${date}`;
}
