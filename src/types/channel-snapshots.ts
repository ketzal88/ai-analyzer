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
    // ── Ads (Meta + Google) ──────────────────────
    spend?: number;
    revenue?: number;
    conversions?: number;
    roas?: number;
    cpa?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;

    // ── Ecommerce (Tienda Nube / Shopify) ────────
    orders?: number;
    avgOrderValue?: number;
    refunds?: number;

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
