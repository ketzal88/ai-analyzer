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

    private static getCustomer(customerId?: string) {
        const client = this.getClient();
        const id = customerId || DEFAULT_CUSTOMER_ID;
        if (!id) throw new Error("Google Ads customer ID not configured");
        if (!REFRESH_TOKEN) throw new Error("Google Ads refresh token not configured");

        return client.Customer({
            customer_id: id,
            refresh_token: REFRESH_TOKEN,
            login_customer_id: LOGIN_CUSTOMER_ID || undefined,
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

        const results = await customer.query(`
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value,
                segments.date
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
              AND campaign.status != 'REMOVED'
            ORDER BY segments.date DESC
        `);

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

        const rows = await this.fetchCampaignMetrics(customerId, startDate, endDate);
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
                        conversions: c.conversions,
                        roas: c.spend > 0 ? c.conversionsValue / c.spend : 0,
                    })),
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
