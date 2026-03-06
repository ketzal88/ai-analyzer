/**
 * Klaviyo Service — Direct API integration
 *
 * Fetches email campaign + flow metrics from Klaviyo API,
 * normalizes the data, and writes to channel_snapshots collection.
 *
 * API Docs: https://developers.klaviyo.com/en/reference/api_overview
 * Base URL: https://a.klaviyo.com/api
 * Auth: Authorization: Klaviyo-API-Key {PRIVATE_API_KEY}
 * Revision header required for all requests.
 *
 * Rate limits (Reporting): 1/s burst, 2/min steady, 225/day
 * Rate limits (Campaigns): 10/s burst, 150/min steady
 */

import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";

// ── Config ───────────────────────────────────────────
const BASE_URL = "https://a.klaviyo.com/api";
const API_REVISION = "2025-04-15";
const MAX_RETRIES = 3;

// ── Types ────────────────────────────────────────────
export interface KlaviyoCampaign {
    id: string;
    name: string;
    status: string;
    sendTime?: string;
    channel: string;
}

export interface KlaviyoCampaignStats {
    campaignId: string;
    campaignName: string;
    sendTime?: string;
    recipients: number;
    opens: number;
    openRate: number;
    clicks: number;
    clickRate: number;
    bounces: number;
    bounceRate: number;
    unsubscribes: number;
    revenue: number;
    conversions: number;
}

export interface KlaviyoFlow {
    id: string;
    name: string;
    status: string;
    trigger?: string;
}

export interface KlaviyoFlowStats {
    flowId: string;
    flowName: string;
    status: string;
    recipients: number;
    opens: number;
    clicks: number;
    revenue: number;
    conversions: number;
}

export interface KlaviyoDailyAggregate {
    date: string;
    metrics: UnifiedChannelMetrics;
    campaigns: KlaviyoCampaignStats[];
}

// ── Service ──────────────────────────────────────────
export class KlaviyoService {

    private static async fetchWithRetry(
        url: string,
        apiKey: string,
        options: { method?: string; body?: any } = {},
        retries = MAX_RETRIES
    ): Promise<any> {
        for (let attempt = 0; attempt < retries; attempt++) {
            const response = await fetch(url, {
                method: options.method || "GET",
                headers: {
                    "Authorization": `Klaviyo-API-Key ${apiKey}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "revision": API_REVISION,
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            if (response.ok) {
                return response.json();
            }

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "30", 10);
                console.warn(`[Klaviyo] Rate limited, waiting ${retryAfter}s...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }

            if (response.status >= 500) {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                continue;
            }

            const errorText = await response.text();
            throw new Error(`Klaviyo API error ${response.status}: ${errorText}`);
        }
        throw new Error(`Klaviyo API: max retries (${retries}) exceeded`);
    }

    // ── Campaigns ───────────────────────────────────

    /**
     * Fetch all sent email campaigns
     */
    static async fetchCampaigns(apiKey: string): Promise<KlaviyoCampaign[]> {
        const allCampaigns: KlaviyoCampaign[] = [];
        let url: string | null = `${BASE_URL}/campaigns?filter=equals(messages.channel,'email')&sort=-scheduled_at`;

        while (url) {
            const result = await this.fetchWithRetry(url, apiKey);
            const campaigns = result.data || [];

            for (const c of campaigns) {
                allCampaigns.push({
                    id: c.id,
                    name: c.attributes?.name || "",
                    status: c.attributes?.status || "",
                    sendTime: c.attributes?.send_time || undefined,
                    channel: "email",
                });
            }

            url = result.links?.next || null;
        }

        return allCampaigns;
    }

    // ── Metrics discovery ────────────────────────────

    /**
     * Find the "Placed Order" metric ID (needed for conversion stats).
     * Caches per API key since it doesn't change.
     */
    private static conversionMetricIdCache = new Map<string, string>();

    static async findConversionMetricId(apiKey: string): Promise<string> {
        const cached = this.conversionMetricIdCache.get(apiKey);
        if (cached) return cached;

        const result = await this.fetchWithRetry(`${BASE_URL}/metrics`, apiKey);
        const metrics = result?.data || [];

        // Prefer "Placed Order" from Shopify, then any "Placed Order"
        const placedOrder = metrics.find((m: any) =>
            m.attributes?.name === "Placed Order" && m.attributes?.integration?.name === "Shopify"
        ) || metrics.find((m: any) =>
            m.attributes?.name?.toLowerCase().includes("placed order")
        );

        if (!placedOrder) {
            throw new Error("Klaviyo: Could not find 'Placed Order' metric. Needed for conversion_metric_id.");
        }

        const id = placedOrder.id;
        this.conversionMetricIdCache.set(apiKey, id);
        console.log(`[Klaviyo] Found conversion metric: ${placedOrder.attributes?.name} (${id}) from ${placedOrder.attributes?.integration?.name || "unknown"}`);
        return id;
    }

    // ── Reporting ────────────────────────────────────

    /**
     * Query campaign values (aggregated stats) for a date range.
     * Uses the Reporting API which returns stats grouped by campaign.
     *
     * IMPORTANT: Rate limited to 2/min, 225/day. Use sparingly.
     */
    static async queryCampaignValues(
        apiKey: string,
        startDate: string,
        endDate: string,
        conversionMetricId: string
    ): Promise<any> {
        return this.fetchWithRetry(`${BASE_URL}/campaign-values-reports/`, apiKey, {
            method: "POST",
            body: {
                data: {
                    type: "campaign-values-report",
                    attributes: {
                        timeframe: {
                            start: `${startDate}T00:00:00+00:00`,
                            end: `${endDate}T23:59:59+00:00`,
                        },
                        conversion_metric_id: conversionMetricId,
                        group_by: ["campaign_id", "campaign_message_id"],
                        statistics: [
                            "recipients",
                            "delivered",
                            "opens",
                            "open_rate",
                            "clicks",
                            "click_rate",
                            "bounced",
                            "bounce_rate",
                            "unsubscribes",
                            "unsubscribe_rate",
                            "conversion_value",
                            "conversions",
                            "revenue_per_recipient",
                        ],
                    },
                },
            },
        });
    }

    // ── Flows ────────────────────────────────────────

    /**
     * Fetch all flows (automations)
     */
    static async fetchFlows(apiKey: string): Promise<KlaviyoFlow[]> {
        const allFlows: KlaviyoFlow[] = [];
        let url: string | null = `${BASE_URL}/flows`;

        while (url) {
            const result = await this.fetchWithRetry(url, apiKey);
            const flows = result.data || [];

            for (const f of flows) {
                allFlows.push({
                    id: f.id,
                    name: f.attributes?.name || "",
                    status: f.attributes?.status || "",
                    trigger: f.attributes?.trigger_type || undefined,
                });
            }

            url = result.links?.next || null;
        }

        return allFlows;
    }

    /**
     * Query flow values (aggregated stats) for a date range.
     */
    static async queryFlowValues(
        apiKey: string,
        startDate: string,
        endDate: string,
        conversionMetricId: string
    ): Promise<any> {
        return this.fetchWithRetry(`${BASE_URL}/flow-values-reports/`, apiKey, {
            method: "POST",
            body: {
                data: {
                    type: "flow-values-report",
                    attributes: {
                        timeframe: {
                            start: `${startDate}T00:00:00+00:00`,
                            end: `${endDate}T23:59:59+00:00`,
                        },
                        conversion_metric_id: conversionMetricId,
                        group_by: ["flow_id", "flow_message_id"],
                        statistics: [
                            "recipients",
                            "delivered",
                            "opens",
                            "clicks",
                            "click_rate",
                            "bounced",
                            "conversion_value",
                            "conversions",
                        ],
                    },
                },
            },
        });
    }

    // ── Aggregation ─────────────────────────────────

    /**
     * Parse campaign values report response into structured stats.
     */
    static parseCampaignValues(report: any): KlaviyoCampaignStats[] {
        const results = report?.data?.attributes?.results || [];
        return results.map((r: any) => {
            const stats = r.statistics || {};
            const recipients = stats.recipients || 0;
            const delivered = stats.delivered || 0;
            const bounced = stats.bounced || 0;
            const opens = stats.opens || 0;
            const clicks = stats.clicks || 0;
            return {
                campaignId: r.groupings?.campaign_id || "",
                campaignName: r.groupings?.campaign_name || "",
                sendTime: r.groupings?.send_time || undefined,
                recipients,
                opens,
                openRate: (stats.open_rate || 0) * 100,
                clicks,
                clickRate: (stats.click_rate || 0) * 100,
                bounces: bounced,
                bounceRate: (stats.bounce_rate || 0) * 100,
                unsubscribes: stats.unsubscribes || 0,
                revenue: stats.conversion_value || 0,
                conversions: stats.conversions || 0,
            };
        });
    }

    /**
     * Parse flow values report response into structured stats.
     */
    static parseFlowValues(report: any): KlaviyoFlowStats[] {
        const results = report?.data?.attributes?.results || [];
        return results.map((r: any) => {
            const stats = r.statistics || {};
            return {
                flowId: r.groupings?.flow_id || "",
                flowName: r.groupings?.flow_name || "",
                status: r.groupings?.status || "",
                recipients: stats.recipients || 0,
                opens: stats.opens || 0,
                clicks: stats.clicks || 0,
                revenue: stats.conversion_value || 0,
                conversions: stats.conversions || 0,
            };
        });
    }

    // ── Full sync ───────────────────────────────────

    /**
     * Full sync: fetch campaign + flow stats → write to channel_snapshots.
     *
     * Unlike Perfit (which has per-campaign send dates), Klaviyo's Reporting API
     * returns aggregated stats for the period, not per-day. So we write ONE
     * snapshot per day in the range with the aggregated totals, tagged with
     * the campaign/flow breakdown.
     *
     * For the MTD/monthly use case this works well — the dashboard reads the
     * snapshot and shows period totals.
     */
    static async syncToChannelSnapshots(
        clientId: string,
        apiKey: string,
        startDate: string,
        endDate: string,
        conversionMetricId?: string
    ): Promise<{ daysWritten: number; totalSent: number }> {
        console.log(`[Klaviyo] Syncing ${clientId} for ${startDate} → ${endDate}`);

        // Auto-discover conversion metric ID if not provided
        const metricId = conversionMetricId || await this.findConversionMetricId(apiKey);

        // Fetch campaign & flow names (not rate-limited like reporting)
        const [allCampaigns, allFlows] = await Promise.all([
            this.fetchCampaigns(apiKey),
            this.fetchFlows(apiKey),
        ]);
        const campaignNameMap = new Map(allCampaigns.map(c => [c.id, { name: c.name, sendTime: c.sendTime }]));
        const flowNameMap = new Map(allFlows.map(f => [f.id, { name: f.name, status: f.status }]));

        // Fetch reports sequentially — rate limited (2/min)
        const campaignReport = await this.queryCampaignValues(apiKey, startDate, endDate, metricId);
        await new Promise(r => setTimeout(r, 31_000)); // 31s to respect 2/min
        const flowReport = await this.queryFlowValues(apiKey, startDate, endDate, metricId);

        const campaignStats = this.parseCampaignValues(campaignReport);
        const flowStats = this.parseFlowValues(flowReport);

        // Enrich with names from the Campaigns/Flows APIs
        for (const c of campaignStats) {
            const info = campaignNameMap.get(c.campaignId);
            if (info) {
                c.campaignName = info.name;
                if (!c.sendTime && info.sendTime) c.sendTime = info.sendTime;
            }
        }
        for (const f of flowStats) {
            const info = flowNameMap.get(f.flowId);
            if (info) {
                f.flowName = info.name;
                f.status = info.status;
            }
        }

        // Aggregate totals across all campaigns
        const totalRecipients = campaignStats.reduce((s, c) => s + c.recipients, 0);
        const totalOpens = campaignStats.reduce((s, c) => s + c.opens, 0);
        const totalClicks = campaignStats.reduce((s, c) => s + c.clicks, 0);
        const totalBounces = campaignStats.reduce((s, c) => s + c.bounces, 0);
        const totalUnsubscribes = campaignStats.reduce((s, c) => s + c.unsubscribes, 0);
        const totalCampaignRevenue = campaignStats.reduce((s, c) => s + c.revenue, 0);
        const totalCampaignConversions = campaignStats.reduce((s, c) => s + c.conversions, 0);
        const totalDelivered = totalRecipients - totalBounces;

        // Flow totals
        const totalFlowRecipients = flowStats.reduce((s, f) => s + f.recipients, 0);
        const totalFlowRevenue = flowStats.reduce((s, f) => s + f.revenue, 0);
        const totalFlowConversions = flowStats.reduce((s, f) => s + f.conversions, 0);

        const metrics: UnifiedChannelMetrics = {
            sent: totalRecipients,
            delivered: totalDelivered,
            opens: totalOpens,
            openRate: totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0,
            emailClicks: totalClicks,
            clickRate: totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0,
            bounces: totalBounces,
            unsubscribes: totalUnsubscribes,
            emailRevenue: totalCampaignRevenue + totalFlowRevenue,
            conversions: totalCampaignConversions + totalFlowConversions,
            clickToOpenRate: totalOpens > 0 ? (totalClicks / totalOpens) * 100 : 0,
            revenuePerRecipient: totalRecipients > 0 ? (totalCampaignRevenue + totalFlowRevenue) / totalRecipients : 0,
        };

        // Write a single snapshot for the period (using endDate as the key)
        const docId = buildChannelSnapshotId(clientId, 'EMAIL', endDate);
        const snapshot: ChannelDailySnapshot = {
            clientId,
            channel: 'EMAIL',
            date: endDate,
            metrics,
            rawData: {
                campaigns: campaignStats,
                flows: flowStats,
                flowTotals: {
                    totalRecipients: totalFlowRecipients,
                    totalRevenue: totalFlowRevenue,
                    totalConversions: totalFlowConversions,
                },
                periodStart: startDate,
                periodEnd: endDate,
                source: 'klaviyo',
            },
            syncedAt: new Date().toISOString(),
        };

        await db.collection('channel_snapshots').doc(docId).set(snapshot, { merge: true });

        console.log(`[Klaviyo] Wrote snapshot for ${clientId}: ${totalRecipients} sent, ${totalCampaignConversions + totalFlowConversions} conversions, $${(totalCampaignRevenue + totalFlowRevenue).toFixed(2)} revenue`);
        console.log(`[Klaviyo] Campaigns: ${campaignStats.length} campaigns, Flows: ${flowStats.length} flows`);

        return { daysWritten: 1, totalSent: totalRecipients };
    }
}
