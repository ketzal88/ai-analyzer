/**
 * Google Ads Service — Direct API integration
 *
 * Fetches campaign-level metrics from Google Ads API using GAQL,
 * normalizes the data, and writes to channel_snapshots collection.
 *
 * Uses the `google-ads-api` npm package (Opteo).
 * Dev API key: 15,000 operations/day limit.
 */

import { GoogleAdsApi } from "google-ads-api";
import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";

// ── Config ───────────────────────────────────────────
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const DEFAULT_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

// ── Types ────────────────────────────────────────────
export interface GoogleAdsCampaignRow {
    campaignId: string;
    campaignName: string;
    campaignStatus: string;
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionsValue: number;
    ctr: number;
    cpc: number;
    costPerConversion: number;
    // Expanded fields
    allConversions: number;
    allConversionsValue: number;
    viewThroughConversions: number;
    searchImpressionShare: number;
    searchBudgetLostIS: number;
    searchRankLostIS: number;
    conversionRate: number;
    cpm: number;
    videoViews: number;
    videoViewRate: number;
    videoP25Rate: number;
    videoP50Rate: number;
    videoP75Rate: number;
    videoP100Rate: number;
}

export interface GoogleAdsSearchTermRow {
    searchTerm: string;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionsValue: number;
    spend: number;
    ctr: number;
    cpc: number;
    costPerConversion: number;
}

export interface GoogleAdsDailyAggregate {
    date: string;
    metrics: UnifiedChannelMetrics;
    campaigns: GoogleAdsCampaignRow[];
}

// ── Service ──────────────────────────────────────────
export class GoogleAdsService {

    private static getClient() {
        if (!DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
            throw new Error("Google Ads API credentials not configured (GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET)");
        }
        return new GoogleAdsApi({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            developer_token: DEVELOPER_TOKEN,
        });
    }

    /** Strip dashes from customer ID (e.g. "835-183-5862" → "8351835862") */
    private static normalizeCustomerId(id: string): string {
        return id.replace(/-/g, "");
    }

    private static getCustomer(customerId?: string) {
        const client = this.getClient();
        const rawId = customerId || DEFAULT_CUSTOMER_ID;
        if (!rawId) throw new Error("Google Ads customer ID not configured");
        if (!REFRESH_TOKEN) throw new Error("Google Ads refresh token not configured");

        const id = this.normalizeCustomerId(rawId);
        const loginId = LOGIN_CUSTOMER_ID ? this.normalizeCustomerId(LOGIN_CUSTOMER_ID) : undefined;

        return client.Customer({
            customer_id: id,
            refresh_token: REFRESH_TOKEN,
            login_customer_id: loginId,
        });
    }

    /**
     * Fetch campaign-level metrics for a date range
     */
    static async fetchCampaignMetrics(
        customerId: string,
        startDate: string,
        endDate: string
    ): Promise<GoogleAdsCampaignRow[]> {
        const customer = this.getCustomer(customerId);

        let results: any[];
        try {
            results = await customer.query(`
                SELECT
                    campaign.id,
                    campaign.name,
                    campaign.status,
                    metrics.cost_micros,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.all_conversions,
                    metrics.all_conversions_value,
                    metrics.view_through_conversions,
                    metrics.search_impression_share,
                    metrics.search_budget_lost_impression_share,
                    metrics.search_rank_lost_impression_share,
                    metrics.conversions_from_interactions_rate,
                    metrics.average_cpm,
                    metrics.video_quartile_p25_rate,
                    metrics.video_quartile_p50_rate,
                    metrics.video_quartile_p75_rate,
                    metrics.video_quartile_p100_rate,
                    segments.date
                FROM campaign
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                  AND campaign.status != 'REMOVED'
                ORDER BY segments.date DESC
            `);
        } catch (err: any) {
            const detail = err?.errors?.[0]?.message || err?.message || String(err);
            throw new Error(`Google Ads GAQL query failed: ${detail}`);
        }

        return results.map((row: any) => {
            const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
            const impressions = row.metrics?.impressions || 0;
            const clicks = row.metrics?.clicks || 0;
            const conversions = row.metrics?.conversions || 0;
            const conversionsValue = row.metrics?.conversions_value || 0;

            return {
                campaignId: String(row.campaign?.id || ""),
                campaignName: row.campaign?.name || "",
                campaignStatus: row.campaign?.status || "",
                date: row.segments?.date || "",
                spend,
                impressions,
                clicks,
                conversions,
                conversionsValue,
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                costPerConversion: conversions > 0 ? spend / conversions : 0,
                // Expanded fields
                allConversions: row.metrics?.all_conversions || 0,
                allConversionsValue: row.metrics?.all_conversions_value || 0,
                viewThroughConversions: row.metrics?.view_through_conversions || 0,
                searchImpressionShare: row.metrics?.search_impression_share || 0,
                searchBudgetLostIS: row.metrics?.search_budget_lost_impression_share || 0,
                searchRankLostIS: row.metrics?.search_rank_lost_impression_share || 0,
                conversionRate: row.metrics?.conversions_from_interactions_rate || 0,
                cpm: (row.metrics?.average_cpm || 0) / 1_000_000,
                videoViews: 0,
                videoViewRate: 0,
                videoP25Rate: row.metrics?.video_quartile_p25_rate || 0,
                videoP50Rate: row.metrics?.video_quartile_p50_rate || 0,
                videoP75Rate: row.metrics?.video_quartile_p75_rate || 0,
                videoP100Rate: row.metrics?.video_quartile_p100_rate || 0,
            };
        });
    }

    /**
     * Fetch top search terms for a date range (Search & Shopping campaigns only)
     */
    static async fetchSearchTerms(
        customerId: string,
        startDate: string,
        endDate: string,
        limit = 50
    ): Promise<GoogleAdsSearchTermRow[]> {
        const customer = this.getCustomer(customerId);

        let results: any[];
        try {
            results = await customer.query(`
                SELECT
                    search_term_view.search_term,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.cost_micros
                FROM search_term_view
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY metrics.cost_micros DESC
                LIMIT ${limit}
            `);
        } catch (err: any) {
            // search_term_view not available for all campaign types (Display, Video, PMax)
            console.warn(`[GoogleAds] Search terms query failed: ${err?.errors?.[0]?.message || err?.message}`);
            return [];
        }

        return results.map((row: any) => {
            const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
            const impressions = row.metrics?.impressions || 0;
            const clicks = row.metrics?.clicks || 0;
            const conversions = row.metrics?.conversions || 0;
            const conversionsValue = row.metrics?.conversions_value || 0;
            return {
                searchTerm: row.search_term_view?.search_term || "",
                impressions,
                clicks,
                conversions,
                conversionsValue,
                spend,
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                costPerConversion: conversions > 0 ? spend / conversions : 0,
            };
        });
    }

    /**
     * Aggregate campaign rows into daily totals
     */
    static aggregateByDay(rows: GoogleAdsCampaignRow[]): GoogleAdsDailyAggregate[] {
        const byDate = new Map<string, GoogleAdsCampaignRow[]>();

        for (const row of rows) {
            if (!row.date) continue;
            const existing = byDate.get(row.date) || [];
            existing.push(row);
            byDate.set(row.date, existing);
        }

        const aggregates: GoogleAdsDailyAggregate[] = [];

        for (const [date, campaigns] of byDate) {
            const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
            const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
            const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
            const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
            const totalConversionsValue = campaigns.reduce((s, c) => s + c.conversionsValue, 0);
            const totalAllConversions = campaigns.reduce((s, c) => s + c.allConversions, 0);
            const totalAllConversionsValue = campaigns.reduce((s, c) => s + c.allConversionsValue, 0);
            const totalVTC = campaigns.reduce((s, c) => s + c.viewThroughConversions, 0);
            const totalVideoViews = campaigns.reduce((s, c) => s + c.videoViews, 0);

            // Weighted average video quartile rates (weight by videoViews per campaign)
            const weightedVideoP25 = totalVideoViews > 0
                ? campaigns.reduce((s, c) => s + c.videoP25Rate * c.videoViews, 0) / totalVideoViews : 0;
            const weightedVideoP50 = totalVideoViews > 0
                ? campaigns.reduce((s, c) => s + c.videoP50Rate * c.videoViews, 0) / totalVideoViews : 0;
            const weightedVideoP75 = totalVideoViews > 0
                ? campaigns.reduce((s, c) => s + c.videoP75Rate * c.videoViews, 0) / totalVideoViews : 0;
            const weightedVideoP100 = totalVideoViews > 0
                ? campaigns.reduce((s, c) => s + c.videoP100Rate * c.videoViews, 0) / totalVideoViews : 0;

            // Weighted average for impression share (weight by impressions)
            const weightedIS = totalImpressions > 0
                ? campaigns.reduce((s, c) => s + c.searchImpressionShare * c.impressions, 0) / totalImpressions : 0;
            const weightedBudgetLost = totalImpressions > 0
                ? campaigns.reduce((s, c) => s + c.searchBudgetLostIS * c.impressions, 0) / totalImpressions : 0;
            const weightedRankLost = totalImpressions > 0
                ? campaigns.reduce((s, c) => s + c.searchRankLostIS * c.impressions, 0) / totalImpressions : 0;

            aggregates.push({
                date,
                metrics: {
                    spend: totalSpend,
                    revenue: totalConversionsValue,
                    conversions: totalConversions,
                    roas: totalSpend > 0 ? totalConversionsValue / totalSpend : 0,
                    cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
                    impressions: totalImpressions,
                    clicks: totalClicks,
                    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
                    cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
                    // Expanded
                    allConversions: totalAllConversions || undefined,
                    allConversionsValue: totalAllConversionsValue || undefined,
                    viewThroughConversions: totalVTC || undefined,
                    searchImpressionShare: weightedIS || undefined,
                    searchBudgetLostIS: weightedBudgetLost || undefined,
                    searchRankLostIS: weightedRankLost || undefined,
                    conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
                    videoPlays: totalVideoViews || undefined,
                    videoP25: totalVideoViews > 0 ? weightedVideoP25 : undefined,
                    videoP50: totalVideoViews > 0 ? weightedVideoP50 : undefined,
                    videoP75: totalVideoViews > 0 ? weightedVideoP75 : undefined,
                    videoP100: totalVideoViews > 0 ? weightedVideoP100 : undefined,
                },
                campaigns,
            });
        }

        return aggregates.sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Full sync: fetch → aggregate → write to channel_snapshots
     */
    static async syncToChannelSnapshots(
        clientId: string,
        customerId: string,
        startDate: string,
        endDate: string
    ): Promise<{ daysWritten: number; totalSpend: number }> {
        console.log(`[GoogleAds] Syncing ${clientId} (${customerId}) for ${startDate} → ${endDate}`);

        const [rows, searchTerms] = await Promise.all([
            this.fetchCampaignMetrics(customerId, startDate, endDate),
            this.fetchSearchTerms(customerId, startDate, endDate, 50),
        ]);
        const dailyAggregates = this.aggregateByDay(rows);

        if (dailyAggregates.length === 0) {
            console.log(`[GoogleAds] No data for ${clientId}`);
            return { daysWritten: 0, totalSpend: 0 };
        }

        const batch = db.batch();
        let totalSpend = 0;

        for (const agg of dailyAggregates) {
            const docId = buildChannelSnapshotId(clientId, 'GOOGLE', agg.date);
            const snapshot: ChannelDailySnapshot = {
                clientId,
                channel: 'GOOGLE',
                date: agg.date,
                metrics: agg.metrics,
                rawData: {
                    campaigns: agg.campaigns.map(c => ({
                        id: c.campaignId,
                        name: c.campaignName,
                        status: c.campaignStatus,
                        spend: c.spend,
                        impressions: c.impressions,
                        clicks: c.clicks,
                        conversions: c.conversions,
                        conversionsValue: c.conversionsValue,
                        roas: c.spend > 0 ? c.conversionsValue / c.spend : 0,
                        ctr: c.ctr,
                        cpc: c.cpc,
                        cpa: c.costPerConversion,
                        allConversions: c.allConversions || undefined,
                        viewThroughConversions: c.viewThroughConversions || undefined,
                        searchImpressionShare: c.searchImpressionShare || undefined,
                        searchBudgetLostIS: c.searchBudgetLostIS || undefined,
                        searchRankLostIS: c.searchRankLostIS || undefined,
                        conversionRate: c.conversionRate || undefined,
                    })),
                    ...(searchTerms.length > 0 ? { searchTerms } : {}),
                },
                syncedAt: new Date().toISOString(),
            };
            batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
            totalSpend += agg.metrics.spend || 0;
        }

        await batch.commit();
        console.log(`[GoogleAds] Wrote ${dailyAggregates.length} days for ${clientId}, total spend: $${totalSpend.toFixed(2)}`);

        return { daysWritten: dailyAggregates.length, totalSpend };
    }
}
