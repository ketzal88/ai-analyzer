/**
 * Channel Backfill Service
 *
 * Backfills channel_snapshots for the current quarter when:
 * - A new client is created
 * - A channel integration is enabled on an existing client
 *
 * Each channel dispatches to its respective service's syncToChannelSnapshots().
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { buildChannelSnapshotId, ChannelDailySnapshot } from "@/types/channel-snapshots";

/** Get the start of the current cuatrimestre (Q1=Jan1, Q2=May1, Q3=Sep1) */
function getQuarterStart(): string {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const quarterStartMonth = Math.floor(month / 4) * 4;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    return start.toISOString().split("T")[0];
}

/** Get yesterday's date string */
function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
}

export type BackfillChannel = "META" | "GOOGLE" | "GA4" | "ECOMMERCE" | "EMAIL" | "LEADS";

export interface ChannelBackfillResult {
    channel: BackfillChannel;
    status: "success" | "skipped" | "failed";
    daysWritten?: number;
    error?: string;
}

export class ChannelBackfillService {

    /**
     * Backfill all configured channels for a client from quarter start to yesterday.
     * Called on new client creation.
     */
    static async backfillAllChannels(clientId: string): Promise<ChannelBackfillResult[]> {
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return [{ channel: "META", status: "failed", error: "Client not found" }];

        const client = { id: clientDoc.id, ...clientDoc.data() } as Client;
        const results: ChannelBackfillResult[] = [];

        // Meta
        if (client.integraciones?.meta && client.metaAdAccountId) {
            results.push(await this.backfillMeta(clientId, client.metaAdAccountId));
        }

        // Google
        if (client.integraciones?.google && client.googleAdsId) {
            results.push(await this.backfillGoogle(clientId, client.googleAdsId));
        }

        // GA4
        if (client.integraciones?.ga4 && client.ga4PropertyId) {
            results.push(await this.backfillGA4(clientId, client.ga4PropertyId));
        }

        // Ecommerce
        if (client.integraciones?.ecommerce) {
            results.push(await this.backfillEcommerce(clientId, client));
        }

        // Email
        if (client.integraciones?.email) {
            results.push(await this.backfillEmail(clientId, client));
        }

        // Leads
        if (client.integraciones?.leads) {
            results.push(await this.backfillLeads(clientId));
        }

        return results;
    }

    /**
     * Backfill a specific channel for a client from quarter start to yesterday.
     * Called when a channel integration is enabled on an existing client.
     */
    static async backfillChannel(clientId: string, channel: BackfillChannel): Promise<ChannelBackfillResult> {
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return { channel, status: "failed", error: "Client not found" };

        const client = { id: clientDoc.id, ...clientDoc.data() } as Client;

        switch (channel) {
            case "META":
                if (!client.metaAdAccountId) return { channel, status: "skipped", error: "No metaAdAccountId" };
                return this.backfillMeta(clientId, client.metaAdAccountId);

            case "GOOGLE":
                if (!client.googleAdsId) return { channel, status: "skipped", error: "No googleAdsId" };
                return this.backfillGoogle(clientId, client.googleAdsId);

            case "GA4":
                if (!client.ga4PropertyId) return { channel, status: "skipped", error: "No ga4PropertyId" };
                return this.backfillGA4(clientId, client.ga4PropertyId);

            case "ECOMMERCE":
                if (!client.integraciones?.ecommerce) return { channel, status: "skipped", error: "No ecommerce platform" };
                return this.backfillEcommerce(clientId, client);

            case "EMAIL":
                if (!client.integraciones?.email) return { channel, status: "skipped", error: "No email platform" };
                return this.backfillEmail(clientId, client);

            case "LEADS":
                if (!client.integraciones?.leads) return { channel, status: "skipped", error: "No leads integration" };
                return this.backfillLeads(clientId);

            default:
                return { channel, status: "skipped", error: `Unknown channel: ${channel}` };
        }
    }

    // --- Channel-specific backfill methods ---

    private static async backfillMeta(clientId: string, adAccountId: string): Promise<ChannelBackfillResult> {
        try {
            const startDate = getQuarterStart();
            const endDate = getYesterday();
            const metaToken = process.env.META_ACCESS_TOKEN;
            const metaVersion = process.env.META_API_VERSION || "v24.0";

            if (!metaToken) return { channel: "META", status: "failed", error: "No META_ACCESS_TOKEN" };

            const cleanId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
            const fields = [
                "spend", "impressions", "clicks", "reach", "frequency", "ctr", "cpc", "cpm", "cpp",
                "actions", "action_values", "cost_per_action_type",
                "inline_link_clicks", "inline_link_click_ctr", "outbound_clicks", "cost_per_inline_link_click",
                "unique_clicks", "unique_inline_link_clicks",
                "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
                "video_play_actions", "video_p25_watched_actions", "video_p50_watched_actions",
                "video_p75_watched_actions", "video_p100_watched_actions",
                "video_30_sec_watched_actions", "video_avg_time_watched_actions",
            ].join(",");
            const timeRange = JSON.stringify({ since: startDate, until: endDate });

            let allRows: any[] = [];
            let url: string | null = `https://graph.facebook.com/${metaVersion}/${cleanId}/insights?level=account&time_increment=1&time_range=${encodeURIComponent(timeRange)}&fields=${fields}&limit=500&access_token=${metaToken}`;

            while (url) {
                const res = await fetch(url);
                if (!res.ok) {
                    const err: any = await res.json();
                    return { channel: "META", status: "failed", error: err.error?.message || "API error" };
                }
                const json: any = await res.json();
                allRows = allRows.concat(json.data || []);
                url = json.paging?.next || null;
                if (url) await new Promise(r => setTimeout(r, 1000));
            }

            // Write real data
            const datesWithData = new Set<string>();
            for (let i = 0; i < allRows.length; i += 400) {
                const chunk = allRows.slice(i, i + 400);
                const batch = db.batch();
                for (const row of chunk) {
                    datesWithData.add(row.date_start);
                    const spend = Number(row.spend || 0);
                    const impressions = Number(row.impressions || 0);
                    const clicks = Number(row.clicks || 0);
                    const getAct = (type: string) => Number(row.actions?.find((a: any) => a.action_type === type)?.value || 0);
                    const getActVal = (type: string) => Number(row.action_values?.find((a: any) => a.action_type === type)?.value || 0);
                    const getCostPerAct = (type: string) => Number(row.cost_per_action_type?.find((a: any) => a.action_type === type)?.value || 0);
                    const getVideoAct = (field: string) => Number(row[field]?.[0]?.value || 0);
                    const purchases = getAct("purchase") || getAct("offsite_conversion.fb_pixel_purchase");
                    const revenue = getActVal("purchase") || getActVal("offsite_conversion.fb_pixel_purchase");
                    const leads = getAct("lead") || getAct("offsite_conversion.fb_pixel_lead");
                    const messages = getAct("onsite_conversion.messaging_first_reply");
                    const conversions = purchases || leads || messages || 0;

                    const addToCart = getAct("offsite_conversion.fb_pixel_add_to_cart") || getAct("add_to_cart");
                    const initiateCheckout = getAct("offsite_conversion.fb_pixel_initiate_checkout") || getAct("initiate_checkout");
                    const viewContent = getAct("offsite_conversion.fb_pixel_view_content") || getAct("view_content");

                    const snapshot: ChannelDailySnapshot = {
                        clientId, channel: "META", date: row.date_start,
                        metrics: {
                            spend, revenue, conversions, impressions, clicks,
                            ctr: Number(row.ctr || 0), cpc: Number(row.cpc || 0),
                            cpm: Number(row.cpm || 0), cpp: Number(row.cpp || 0),
                            roas: spend > 0 ? revenue / spend : 0,
                            cpa: conversions > 0 ? spend / conversions : 0,
                            reach: Number(row.reach || 0), frequency: Number(row.frequency || 0),
                            inlineLinkClicks: Number(row.inline_link_clicks || 0),
                            inlineLinkClickCtr: Number(row.inline_link_click_ctr || 0),
                            costPerInlineLinkClick: Number(row.cost_per_inline_link_click || 0),
                            uniqueClicks: Number(row.unique_clicks || 0),
                            outboundClicks: Number(row.outbound_clicks?.[0]?.value || row.outbound_clicks || 0),
                            addToCart: addToCart || undefined,
                            initiateCheckout: initiateCheckout || undefined,
                            viewContent: viewContent || undefined,
                            costPerAddToCart: addToCart > 0 ? getCostPerAct("offsite_conversion.fb_pixel_add_to_cart") || getCostPerAct("add_to_cart") : undefined,
                            costPerInitiateCheckout: initiateCheckout > 0 ? getCostPerAct("offsite_conversion.fb_pixel_initiate_checkout") || getCostPerAct("initiate_checkout") : undefined,
                            qualityRanking: row.quality_ranking || undefined,
                            engagementRateRanking: row.engagement_rate_ranking || undefined,
                            conversionRateRanking: row.conversion_rate_ranking || undefined,
                            videoPlays: getVideoAct("video_play_actions") || undefined,
                            videoP25: getVideoAct("video_p25_watched_actions") || undefined,
                            videoP50: getVideoAct("video_p50_watched_actions") || undefined,
                            videoP75: getVideoAct("video_p75_watched_actions") || undefined,
                            videoP100: getVideoAct("video_p100_watched_actions") || undefined,
                            video30sViews: getVideoAct("video_30_sec_watched_actions") || undefined,
                            videoAvgWatchTime: getVideoAct("video_avg_time_watched_actions") || undefined,
                        },
                        syncedAt: new Date().toISOString(),
                    };
                    batch.set(db.collection("channel_snapshots").doc(buildChannelSnapshotId(clientId, "META", row.date_start)), snapshot, { merge: true });
                }
                await batch.commit();
            }

            // Fill zero-spend days
            const allDates = generateDateRange(startDate, endDate);
            const missingDates = allDates.filter(d => !datesWithData.has(d));
            for (let i = 0; i < missingDates.length; i += 400) {
                const batch = db.batch();
                for (const date of missingDates.slice(i, i + 400)) {
                    const snapshot: ChannelDailySnapshot = {
                        clientId, channel: "META", date,
                        metrics: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0, reach: 0, frequency: 0 },
                        rawData: { filled: true, reason: "no_spend" },
                        syncedAt: new Date().toISOString(),
                    };
                    batch.set(db.collection("channel_snapshots").doc(buildChannelSnapshotId(clientId, "META", date)), snapshot);
                }
                await batch.commit();
            }

            return { channel: "META", status: "success", daysWritten: allDates.length };
        } catch (e: any) {
            return { channel: "META", status: "failed", error: e.message };
        }
    }

    private static async backfillGoogle(clientId: string, customerId: string): Promise<ChannelBackfillResult> {
        try {
            const { GoogleAdsService } = await import("@/lib/google-ads-service");
            const startDate = getQuarterStart();
            const endDate = getYesterday();
            const { daysWritten } = await GoogleAdsService.syncToChannelSnapshots(clientId, customerId, startDate, endDate);
            return { channel: "GOOGLE", status: "success", daysWritten };
        } catch (e: any) {
            return { channel: "GOOGLE", status: "failed", error: e.message };
        }
    }

    private static async backfillGA4(clientId: string, propertyId: string): Promise<ChannelBackfillResult> {
        try {
            const { GA4Service } = await import("@/lib/ga4-service");
            const startDate = getQuarterStart();
            const endDate = getYesterday();
            const { daysWritten } = await GA4Service.syncToChannelSnapshots(clientId, propertyId, startDate, endDate);
            return { channel: "GA4", status: "success", daysWritten };
        } catch (e: any) {
            return { channel: "GA4", status: "failed", error: e.message };
        }
    }

    private static async backfillEcommerce(clientId: string, client: Client): Promise<ChannelBackfillResult> {
        try {
            const startDate = getQuarterStart();
            const endDate = getYesterday();

            if (client.integraciones?.ecommerce === "tiendanube") {
                if (!client.tiendanubeStoreId || !client.tiendanubeAccessToken) {
                    return { channel: "ECOMMERCE", status: "skipped", error: "Missing TiendaNube credentials" };
                }
                const { TiendaNubeService } = await import("@/lib/tiendanube-service");
                const { daysWritten } = await TiendaNubeService.syncToChannelSnapshots(clientId, client.tiendanubeStoreId, client.tiendanubeAccessToken, startDate, endDate);
                return { channel: "ECOMMERCE", status: "success", daysWritten };
            }

            if (client.integraciones?.ecommerce === "shopify") {
                if (!client.shopifyStoreDomain || !client.shopifyAccessToken) {
                    return { channel: "ECOMMERCE", status: "skipped", error: "Missing Shopify credentials" };
                }
                const { ShopifyService } = await import("@/lib/shopify-service");
                const { daysWritten } = await ShopifyService.syncToChannelSnapshots(clientId, client.shopifyStoreDomain, client.shopifyAccessToken, startDate, endDate);
                return { channel: "ECOMMERCE", status: "success", daysWritten };
            }

            if (client.integraciones?.ecommerce === "woocommerce") {
                if (!client.woocommerceStoreDomain || !client.woocommerceConsumerKey || !client.woocommerceConsumerSecret) {
                    return { channel: "ECOMMERCE", status: "skipped", error: "Missing WooCommerce credentials" };
                }
                const { WooCommerceService } = await import("@/lib/woocommerce-service");
                const { daysWritten } = await WooCommerceService.syncToChannelSnapshots(clientId, client.woocommerceStoreDomain, client.woocommerceConsumerKey, client.woocommerceConsumerSecret, startDate, endDate);
                return { channel: "ECOMMERCE", status: "success", daysWritten };
            }

            return { channel: "ECOMMERCE", status: "skipped", error: `Unknown platform: ${client.integraciones?.ecommerce}` };
        } catch (e: any) {
            return { channel: "ECOMMERCE", status: "failed", error: e.message };
        }
    }

    private static async backfillEmail(clientId: string, client: Client): Promise<ChannelBackfillResult> {
        try {
            const startDate = getQuarterStart();
            const endDate = getYesterday();

            if (client.integraciones?.email === "perfit") {
                if (!client.perfitApiKey) return { channel: "EMAIL", status: "skipped", error: "No perfitApiKey" };
                const { PerfitService } = await import("@/lib/perfit-service");
                const { daysWritten } = await PerfitService.syncToChannelSnapshots(clientId, client.perfitApiKey, startDate, endDate);
                return { channel: "EMAIL", status: "success", daysWritten };
            }

            if (client.integraciones?.email === "klaviyo") {
                if (!client.klaviyoApiKey) return { channel: "EMAIL", status: "skipped", error: "No klaviyoApiKey" };
                const { KlaviyoService } = await import("@/lib/klaviyo-service");
                const { daysWritten } = await KlaviyoService.syncToChannelSnapshots(clientId, client.klaviyoApiKey, startDate, endDate);
                return { channel: "EMAIL", status: "success", daysWritten };
            }

            return { channel: "EMAIL", status: "skipped", error: `Unknown provider: ${client.integraciones?.email}` };
        } catch (e: any) {
            return { channel: "EMAIL", status: "failed", error: e.message };
        }
    }
    private static async backfillLeads(clientId: string): Promise<ChannelBackfillResult> {
        try {
            const { LeadsService } = await import("@/lib/leads-service");
            const startDate = getQuarterStart();
            const endDate = getYesterday();
            const { daysWritten } = await LeadsService.syncToChannelSnapshots(clientId, startDate, endDate);
            return { channel: "LEADS", status: "success", daysWritten };
        } catch (e: any) {
            return { channel: "LEADS", status: "failed", error: e.message };
        }
    }
}

// Helper
function generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start + "T12:00:00Z");
    const last = new Date(end + "T12:00:00Z");
    while (current <= last) {
        dates.push(current.toISOString().split("T")[0]);
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
}
