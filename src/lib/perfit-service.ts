/**
 * Perfit Service — Direct API integration
 *
 * Fetches email campaign + automation metrics from Perfit API,
 * normalizes the data, and writes to channel_snapshots collection.
 *
 * API Docs: https://github.com/perfitdev/apiblueprint
 * Base URL: https://api.myperfit.com/v2
 * Auth: Authorization: Bearer {API_KEY}
 *
 * API key format: "{accountId}-{secret}" — account ID is the prefix before the first dash.
 * Each client stores their own perfitApiKey in Firestore.
 */

import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";

// ── Config ───────────────────────────────────────────
const BASE_URL = "https://api.myperfit.com/v2";
const MAX_RETRIES = 3;

// ── Types ────────────────────────────────────────────
export interface PerfitCampaignWithMetrics {
    id: number;
    name: string;
    description?: string;
    state: "DRAFT" | "PENDING_APPROVAL" | "SCHEDULED" | "SENT" | "CANCELLED";
    type: string;
    launchDate?: string;
    tags?: string[];
    recipients?: number;
    thumbnail?: string;
    metrics?: {
        sent?: number;
        sentP?: number;
        bounced?: number;
        bouncedP?: number;
        opened?: number;
        openedP?: number;
        clicked?: number;
        clickedP?: number;
        conversions?: number;
        conversionsAmount?: number;
    };
}

export interface PerfitAutomation {
    id: string;
    name: string;
    comments?: string;
    trigger: string;
    enabled: boolean;
    tags?: string[];
    options?: {
        types?: string[]; // "abandoned_cart", "welcome", "visit_recovery", etc.
    };
    stats: {
        triggered: number;
        exited: number;
        failed: number;
        active: number;
        aborted: number;
        completed: number;
        converted: number;
        converted_amount: number;
    };
}

export interface PerfitAccountInfo {
    code: string;
    name: string;
    plan?: {
        state: string;
        contacts?: { limit: number; active: number };
        emails?: { available: number };
        subscription?: {
            price?: { currency: string; total: number; totalUSD: number };
        };
    };
}

export interface PerfitCampaignDetail {
    id: number;
    name: string;
    subject?: string;
    sent: number;
    opens: number;
    openRate: number;
    clicks: number;
    clickRate: number;
    bounces: number;
    bounceRate: number;
    conversions: number;
    conversionsAmount: number;
    launchDate: string;
    thumbnail?: string;
}

export interface PerfitAutomationSummary {
    id: string;
    name: string;
    type: string; // "abandoned_cart", "welcome", "visit_recovery", etc.
    trigger: string;
    enabled: boolean;
    triggered: number;
    completed: number;
    converted: number;
    convertedAmount: number;
}

export interface PerfitDailyAggregate {
    date: string;
    metrics: UnifiedChannelMetrics;
    campaigns: PerfitCampaignDetail[];
}

// ── Service ──────────────────────────────────────────
export class PerfitService {

    /**
     * Extract account ID from API key (prefix before first dash)
     */
    static extractAccountId(apiKey: string): string {
        const dashIdx = apiKey.indexOf('-');
        if (dashIdx <= 0) throw new Error("Invalid Perfit API key format — expected '{accountId}-{secret}'");
        return apiKey.substring(0, dashIdx);
    }

    private static async fetchWithRetry(url: string, apiKey: string, retries = MAX_RETRIES): Promise<any> {
        for (let attempt = 0; attempt < retries; attempt++) {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
            });

            if (response.ok) {
                return response.json();
            }

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
                console.warn(`[Perfit] Rate limited, waiting ${retryAfter}s...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }

            if (response.status >= 500) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                continue;
            }

            const errorText = await response.text();
            throw new Error(`Perfit API error ${response.status}: ${errorText}`);
        }
        throw new Error(`Perfit API: max retries (${retries}) exceeded`);
    }

    // ── Account ─────────────────────────────────────

    /**
     * Fetch account info (plan, contacts, subscription)
     */
    static async fetchAccountInfo(accountId: string, apiKey: string): Promise<PerfitAccountInfo> {
        const result = await this.fetchWithRetry(`${BASE_URL}/${accountId}`, apiKey);
        return result.data;
    }

    // ── Campaigns ───────────────────────────────────

    /**
     * Fetch all sent campaigns with inline metrics
     */
    static async fetchCampaigns(accountId: string, apiKey: string): Promise<PerfitCampaignWithMetrics[]> {
        const allCampaigns: PerfitCampaignWithMetrics[] = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
            const url = `${BASE_URL}/${accountId}/campaigns?offset=${offset}&limit=${limit}&sortby=launchDate&sortdir=desc`;
            const result = await this.fetchWithRetry(url, apiKey);
            const campaigns: PerfitCampaignWithMetrics[] = result.data || [];

            if (campaigns.length === 0) {
                hasMore = false;
            } else {
                allCampaigns.push(...campaigns);
                if (campaigns.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            }
        }

        return allCampaigns.filter(c => c.state === "SENT");
    }

    // ── Automations ─────────────────────────────────

    /**
     * Fetch all automations with their stats
     */
    static async fetchAutomations(accountId: string, apiKey: string): Promise<PerfitAutomation[]> {
        const url = `${BASE_URL}/${accountId}/automations`;
        const result = await this.fetchWithRetry(url, apiKey);
        return result.data || [];
    }

    /**
     * Build automation summaries for storage
     */
    static buildAutomationSummaries(automations: PerfitAutomation[]): PerfitAutomationSummary[] {
        return automations.map(a => ({
            id: a.id,
            name: a.name,
            type: a.options?.types?.[0] || 'other',
            trigger: a.trigger,
            enabled: a.enabled,
            triggered: a.stats.triggered,
            completed: a.stats.completed,
            converted: a.stats.converted,
            convertedAmount: a.stats.converted_amount,
        }));
    }

    // ── Aggregation ─────────────────────────────────

    /**
     * Fetch campaigns for a date range, aggregate by day with full detail.
     */
    static async fetchAndAggregate(
        accountId: string,
        apiKey: string,
        startDate: string,
        endDate: string
    ): Promise<PerfitDailyAggregate[]> {
        const campaigns = await this.fetchCampaigns(accountId, apiKey);

        const inRange = campaigns.filter(c => {
            const launch = c.launchDate?.split("T")[0];
            return launch && launch >= startDate && launch <= endDate;
        });

        if (inRange.length === 0) return [];

        // Group by launch date
        const byDate = new Map<string, PerfitCampaignWithMetrics[]>();
        for (const c of inRange) {
            const date = (c.launchDate || "").split("T")[0];
            if (!date) continue;
            const existing = byDate.get(date) || [];
            existing.push(c);
            byDate.set(date, existing);
        }

        const aggregates: PerfitDailyAggregate[] = [];

        for (const [date, dayCampaigns] of byDate) {
            const totalSent = dayCampaigns.reduce((s, c) => s + (c.metrics?.sent || 0), 0);
            const totalBounced = dayCampaigns.reduce((s, c) => s + (c.metrics?.bounced || 0), 0);
            const totalDelivered = totalSent - totalBounced;
            const totalOpens = dayCampaigns.reduce((s, c) => s + (c.metrics?.opened || 0), 0);
            const totalClicks = dayCampaigns.reduce((s, c) => s + (c.metrics?.clicked || 0), 0);
            const totalConversions = dayCampaigns.reduce((s, c) => s + (c.metrics?.conversions || 0), 0);
            const totalConversionsAmount = dayCampaigns.reduce((s, c) => s + (c.metrics?.conversionsAmount || 0), 0);

            aggregates.push({
                date,
                metrics: {
                    sent: totalSent,
                    delivered: totalDelivered,
                    opens: totalOpens,
                    openRate: totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0,
                    emailClicks: totalClicks,
                    clickRate: totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0,
                    bounces: totalBounced,
                    emailRevenue: totalConversionsAmount,
                    conversions: totalConversions,
                    clickToOpenRate: totalOpens > 0 ? (totalClicks / totalOpens) * 100 : 0,
                    revenuePerRecipient: totalSent > 0 ? totalConversionsAmount / totalSent : 0,
                },
                campaigns: dayCampaigns.map(c => {
                    const sent = c.metrics?.sent || 0;
                    const bounced = c.metrics?.bounced || 0;
                    const delivered = sent - bounced;
                    const opens = c.metrics?.opened || 0;
                    const clicks = c.metrics?.clicked || 0;
                    return {
                        id: c.id,
                        name: c.name,
                        subject: c.description?.replace(/^Asunto:\s*/i, '') || c.name,
                        sent,
                        opens,
                        openRate: delivered > 0 ? (opens / delivered) * 100 : 0,
                        clicks,
                        clickRate: delivered > 0 ? (clicks / delivered) * 100 : 0,
                        bounces: bounced,
                        bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
                        conversions: c.metrics?.conversions || 0,
                        conversionsAmount: c.metrics?.conversionsAmount || 0,
                        launchDate: c.launchDate || '',
                        thumbnail: c.thumbnail,
                        tags: c.tags || [],
                    };
                }),
            });
        }

        return aggregates.sort((a, b) => b.date.localeCompare(a.date));
    }

    // ── Full sync ───────────────────────────────────

    /**
     * Full sync: fetch campaigns + automations → aggregate → write to channel_snapshots
     */
    static async syncToChannelSnapshots(
        clientId: string,
        apiKey: string,
        startDate: string,
        endDate: string
    ): Promise<{ daysWritten: number; totalSent: number }> {
        const accountId = this.extractAccountId(apiKey);
        console.log(`[Perfit] Syncing ${clientId} (account ${accountId}) for ${startDate} → ${endDate}`);

        // Fetch campaigns and automations in parallel
        const [dailyAggregates, automations, accountInfo] = await Promise.all([
            this.fetchAndAggregate(accountId, apiKey, startDate, endDate),
            this.fetchAutomations(accountId, apiKey),
            this.fetchAccountInfo(accountId, apiKey).catch(() => null),
        ]);

        const automationSummaries = this.buildAutomationSummaries(automations);
        const enabledAutomations = automationSummaries.filter(a => a.enabled);

        // Compute automation totals (lifetime — API doesn't give daily breakdown)
        const automationTotals = {
            totalConverted: enabledAutomations.reduce((s, a) => s + a.converted, 0),
            totalConvertedAmount: enabledAutomations.reduce((s, a) => s + a.convertedAmount, 0),
            totalTriggered: enabledAutomations.reduce((s, a) => s + a.triggered, 0),
            totalCompleted: enabledAutomations.reduce((s, a) => s + a.completed, 0),
        };

        if (dailyAggregates.length === 0) {
            console.log(`[Perfit] No campaigns for ${clientId} in range`);
            return { daysWritten: 0, totalSent: 0 };
        }

        const batch = db.batch();
        let totalSent = 0;

        for (const agg of dailyAggregates) {
            const docId = buildChannelSnapshotId(clientId, 'EMAIL', agg.date);
            const snapshot: ChannelDailySnapshot = {
                clientId,
                channel: 'EMAIL',
                date: agg.date,
                metrics: agg.metrics,
                rawData: {
                    campaigns: agg.campaigns,
                    automations: automationSummaries,
                    automationTotals,
                    account: accountInfo ? {
                        name: accountInfo.name,
                        activeContacts: accountInfo.plan?.contacts?.active,
                        contactLimit: accountInfo.plan?.contacts?.limit,
                        planState: accountInfo.plan?.state,
                        monthlyCost: accountInfo.plan?.subscription?.price?.total,
                        currency: accountInfo.plan?.subscription?.price?.currency,
                    } : undefined,
                    source: 'perfit',
                },
                syncedAt: new Date().toISOString(),
            };
            batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
            totalSent += agg.metrics.sent || 0;
        }

        await batch.commit();

        const totalConversions = dailyAggregates.reduce((s, a) => s + (a.metrics.conversions || 0), 0);
        const totalRevenue = dailyAggregates.reduce((s, a) => s + (a.metrics.emailRevenue || 0), 0);
        console.log(`[Perfit] Wrote ${dailyAggregates.length} days for ${clientId}: ${totalSent} sent, ${totalConversions} conversions, $${totalRevenue.toFixed(0)} revenue`);
        console.log(`[Perfit] Automations: ${enabledAutomations.length} active, ${automationTotals.totalConverted} lifetime conversions, $${automationTotals.totalConvertedAmount.toFixed(0)} lifetime revenue`);

        return { daysWritten: dailyAggregates.length, totalSent };
    }

}
