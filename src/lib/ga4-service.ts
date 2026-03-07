/**
 * GA4 Service — Google Analytics 4 Data API integration
 *
 * Fetches web analytics metrics from GA4 properties using the Google Analytics
 * Data API v1beta (REST via googleapis), normalizes the data, and writes to
 * channel_snapshots collection.
 *
 * Auth: OAuth2 using the same Google credentials as Google Ads
 *       (GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN).
 *       Requires analytics.readonly scope on the refresh token.
 */

import { google } from "googleapis";
import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";

// ── Types ────────────────────────────────────────────

interface GA4CoreRow {
    date: string;
    sessions: number;
    totalUsers: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;        // % (0-100)
    avgSessionDuration: number; // seconds
    engagedSessions: number;
    engagementRate: number;    // % (0-100)
    sessionsPerUser: number;
    pageviewsPerSession: number;
}

interface GA4FunnelRow {
    date: string;
    viewItem: number;
    addToCart: number;
    beginCheckout: number;
    ecommercePurchases: number;
    purchaseRevenue: number;
}

export interface GA4TrafficSource {
    source: string;
    medium: string;
    sessions: number;
    conversions: number;
    revenue: number;
    bounceRate: number;
}

export interface GA4LandingPage {
    pagePath: string;
    sessions: number;
    bounceRate: number;
    conversions: number;
    revenue: number;
}

export interface GA4DeviceBreakdown {
    category: string;
    sessions: number;
    bounceRate: number;
    avgDuration: number;
    conversions: number;
}

interface GA4DailyAggregate {
    date: string;
    metrics: UnifiedChannelMetrics;
    trafficSources: GA4TrafficSource[];
    topLandingPages: GA4LandingPage[];
    deviceBreakdown: GA4DeviceBreakdown[];
}

// ── OAuth2 ──────────────────────────────────────────

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            "GA4 requires Google OAuth credentials. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_REFRESH_TOKEN."
        );
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
}

// ── Service ──────────────────────────────────────────

export class GA4Service {

    private static getDataApi() {
        return google.analyticsdata({ version: "v1beta", auth: getOAuth2Client() });
    }

    /** Normalize property ID to "properties/XXXXXXX" format */
    private static normalizePropertyId(propertyId: string): string {
        if (propertyId.startsWith("properties/")) return propertyId;
        return `properties/${propertyId}`;
    }

    /**
     * Fetch core web analytics metrics by day
     */
    static async fetchCoreMetrics(
        propertyId: string,
        startDate: string,
        endDate: string
    ): Promise<GA4CoreRow[]> {
        const api = this.getDataApi();
        const property = this.normalizePropertyId(propertyId);

        const res = await api.properties.runReport({
            property,
            requestBody: {
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: "date" }],
                metrics: [
                    { name: "sessions" },
                    { name: "totalUsers" },
                    { name: "newUsers" },
                    { name: "screenPageViews" },
                    { name: "bounceRate" },
                    { name: "averageSessionDuration" },
                    { name: "engagedSessions" },
                    { name: "engagementRate" },
                    { name: "sessionsPerUser" },
                    { name: "screenPageViewsPerSession" },
                ],
            },
        });

        const rows = res.data.rows || [];
        return rows.map((row) => {
            const dims = row.dimensionValues || [];
            const mets = row.metricValues || [];
            const raw = dims[0]?.value || "";
            const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;

            return {
                date,
                sessions: parseInt(mets[0]?.value || "0", 10),
                totalUsers: parseInt(mets[1]?.value || "0", 10),
                newUsers: parseInt(mets[2]?.value || "0", 10),
                pageviews: parseInt(mets[3]?.value || "0", 10),
                bounceRate: parseFloat(mets[4]?.value || "0") * 100,
                avgSessionDuration: parseFloat(mets[5]?.value || "0"),
                engagedSessions: parseInt(mets[6]?.value || "0", 10),
                engagementRate: parseFloat(mets[7]?.value || "0") * 100,
                sessionsPerUser: parseFloat(mets[8]?.value || "0"),
                pageviewsPerSession: parseFloat(mets[9]?.value || "0"),
            };
        });
    }

    /**
     * Fetch ecommerce funnel events by day
     */
    static async fetchEcommerceFunnel(
        propertyId: string,
        startDate: string,
        endDate: string
    ): Promise<GA4FunnelRow[]> {
        const api = this.getDataApi();
        const property = this.normalizePropertyId(propertyId);

        const res = await api.properties.runReport({
            property,
            requestBody: {
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: "date" }],
                metrics: [
                    { name: "itemsViewed" },
                    { name: "itemsAddedToCart" },
                    { name: "itemsCheckedOut" },
                    { name: "ecommercePurchases" },
                    { name: "purchaseRevenue" },
                ],
            },
        });

        const rows = res.data.rows || [];
        return rows.map((row) => {
            const dims = row.dimensionValues || [];
            const mets = row.metricValues || [];
            const raw = dims[0]?.value || "";
            const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;

            return {
                date,
                viewItem: parseInt(mets[0]?.value || "0", 10),
                addToCart: parseInt(mets[1]?.value || "0", 10),
                beginCheckout: parseInt(mets[2]?.value || "0", 10),
                ecommercePurchases: parseInt(mets[3]?.value || "0", 10),
                purchaseRevenue: parseFloat(mets[4]?.value || "0"),
            };
        });
    }

    /**
     * Fetch traffic sources (top 20 by sessions)
     */
    static async fetchTrafficSources(
        propertyId: string,
        startDate: string,
        endDate: string
    ): Promise<GA4TrafficSource[]> {
        const api = this.getDataApi();
        const property = this.normalizePropertyId(propertyId);

        const res = await api.properties.runReport({
            property,
            requestBody: {
                dateRanges: [{ startDate, endDate }],
                dimensions: [
                    { name: "sessionSource" },
                    { name: "sessionMedium" },
                ],
                metrics: [
                    { name: "sessions" },
                    { name: "conversions" },
                    { name: "purchaseRevenue" },
                    { name: "bounceRate" },
                ],
                orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
                limit: "20",
            },
        });

        const rows = res.data.rows || [];
        return rows.map((row) => {
            const dims = row.dimensionValues || [];
            const mets = row.metricValues || [];

            return {
                source: dims[0]?.value || "(direct)",
                medium: dims[1]?.value || "(none)",
                sessions: parseInt(mets[0]?.value || "0", 10),
                conversions: parseInt(mets[1]?.value || "0", 10),
                revenue: parseFloat(mets[2]?.value || "0"),
                bounceRate: parseFloat(mets[3]?.value || "0") * 100,
            };
        });
    }

    /**
     * Fetch top landing pages (top 15 by sessions)
     */
    static async fetchLandingPages(
        propertyId: string,
        startDate: string,
        endDate: string
    ): Promise<GA4LandingPage[]> {
        const api = this.getDataApi();
        const property = this.normalizePropertyId(propertyId);

        const res = await api.properties.runReport({
            property,
            requestBody: {
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: "landingPage" }],
                metrics: [
                    { name: "sessions" },
                    { name: "bounceRate" },
                    { name: "conversions" },
                    { name: "purchaseRevenue" },
                ],
                orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
                limit: "15",
            },
        });

        const rows = res.data.rows || [];
        return rows.map((row) => {
            const dims = row.dimensionValues || [];
            const mets = row.metricValues || [];

            return {
                pagePath: dims[0]?.value || "/",
                sessions: parseInt(mets[0]?.value || "0", 10),
                bounceRate: parseFloat(mets[1]?.value || "0") * 100,
                conversions: parseInt(mets[2]?.value || "0", 10),
                revenue: parseFloat(mets[3]?.value || "0"),
            };
        });
    }

    /**
     * Fetch device breakdown
     */
    static async fetchDeviceBreakdown(
        propertyId: string,
        startDate: string,
        endDate: string
    ): Promise<GA4DeviceBreakdown[]> {
        const api = this.getDataApi();
        const property = this.normalizePropertyId(propertyId);

        const res = await api.properties.runReport({
            property,
            requestBody: {
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: "deviceCategory" }],
                metrics: [
                    { name: "sessions" },
                    { name: "bounceRate" },
                    { name: "averageSessionDuration" },
                    { name: "conversions" },
                ],
            },
        });

        const rows = res.data.rows || [];
        return rows.map((row) => {
            const dims = row.dimensionValues || [];
            const mets = row.metricValues || [];

            return {
                category: dims[0]?.value || "unknown",
                sessions: parseInt(mets[0]?.value || "0", 10),
                bounceRate: parseFloat(mets[1]?.value || "0") * 100,
                avgDuration: parseFloat(mets[2]?.value || "0"),
                conversions: parseInt(mets[3]?.value || "0", 10),
            };
        });
    }

    /**
     * Aggregate core + funnel data into daily totals with raw breakdowns
     */
    static aggregateByDay(
        coreRows: GA4CoreRow[],
        funnelRows: GA4FunnelRow[],
        trafficSources: GA4TrafficSource[],
        landingPages: GA4LandingPage[],
        deviceBreakdown: GA4DeviceBreakdown[]
    ): GA4DailyAggregate[] {
        const funnelByDate = new Map<string, GA4FunnelRow>();
        for (const f of funnelRows) {
            funnelByDate.set(f.date, f);
        }

        return coreRows.map((core) => {
            const funnel = funnelByDate.get(core.date);
            const purchases = funnel?.ecommercePurchases || 0;

            const metrics: UnifiedChannelMetrics = {
                sessions: core.sessions,
                totalUsers: core.totalUsers,
                newUsers: core.newUsers,
                pageviews: core.pageviews,
                bounceRate: round2(core.bounceRate),
                avgSessionDuration: round2(core.avgSessionDuration),
                engagedSessions: core.engagedSessions,
                engagementRate: round2(core.engagementRate),
                sessionsPerUser: round2(core.sessionsPerUser),
                pageviewsPerSession: round2(core.pageviewsPerSession),
                viewItem: funnel?.viewItem || undefined,
                addToCart: funnel?.addToCart || undefined,
                beginCheckout: funnel?.beginCheckout || undefined,
                ecommercePurchases: purchases || undefined,
                purchaseRevenue: funnel?.purchaseRevenue ? round2(funnel.purchaseRevenue) : undefined,
                conversions: purchases || undefined,
                revenue: funnel?.purchaseRevenue ? round2(funnel.purchaseRevenue) : undefined,
                ecommerceConversionRate: core.sessions > 0 && purchases > 0
                    ? round2((purchases / core.sessions) * 100)
                    : undefined,
            };

            return {
                date: core.date,
                metrics,
                trafficSources,
                topLandingPages: landingPages,
                deviceBreakdown,
            };
        }).sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Full sync: fetch → aggregate → write to channel_snapshots
     */
    static async syncToChannelSnapshots(
        clientId: string,
        propertyId: string,
        startDate: string,
        endDate: string
    ): Promise<{ daysWritten: number; totalSessions: number }> {
        console.log(`[GA4] Syncing ${clientId} (${propertyId}) for ${startDate} → ${endDate}`);

        const [coreRows, funnelRows, trafficSources, landingPages, deviceBreakdown] = await Promise.all([
            this.fetchCoreMetrics(propertyId, startDate, endDate),
            this.fetchEcommerceFunnel(propertyId, startDate, endDate).catch(() => [] as GA4FunnelRow[]),
            this.fetchTrafficSources(propertyId, startDate, endDate).catch(() => [] as GA4TrafficSource[]),
            this.fetchLandingPages(propertyId, startDate, endDate).catch(() => [] as GA4LandingPage[]),
            this.fetchDeviceBreakdown(propertyId, startDate, endDate).catch(() => [] as GA4DeviceBreakdown[]),
        ]);

        const dailyAggregates = this.aggregateByDay(coreRows, funnelRows, trafficSources, landingPages, deviceBreakdown);

        if (dailyAggregates.length === 0) {
            console.log(`[GA4] No data for ${clientId}`);
            return { daysWritten: 0, totalSessions: 0 };
        }

        const batch = db.batch();
        let totalSessions = 0;

        for (const agg of dailyAggregates) {
            const docId = buildChannelSnapshotId(clientId, 'GA4', agg.date);
            const snapshot: ChannelDailySnapshot = {
                clientId,
                channel: 'GA4',
                date: agg.date,
                metrics: agg.metrics,
                rawData: {
                    source: 'ga4',
                    trafficSources: agg.trafficSources,
                    topLandingPages: agg.topLandingPages,
                    deviceBreakdown: agg.deviceBreakdown,
                },
                syncedAt: new Date().toISOString(),
            };
            batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
            totalSessions += agg.metrics.sessions || 0;
        }

        await batch.commit();
        console.log(`[GA4] Wrote ${dailyAggregates.length} days for ${clientId}, total sessions: ${totalSessions}`);

        return { daysWritten: dailyAggregates.length, totalSessions };
    }
}

// ── Helpers ──────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
