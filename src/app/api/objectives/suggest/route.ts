import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { ChannelType } from "@/lib/channel-brain-interface";

/**
 * GET /api/objectives/suggest?clientId=xxx&quarter=Q1_2026
 *
 * Reads channel_snapshots from the previous quarter (or current quarter for retroactive)
 * and suggests baseline + target values for each metric.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const quarter = searchParams.get("quarter"); // e.g. "Q1_2026"

    if (!clientId || !quarter) {
        return NextResponse.json({ error: "clientId and quarter are required" }, { status: 400 });
    }

    try {
        // Parse quarter to get date range for reference data
        const { referenceStart, referenceEnd } = getReferenceRange(quarter);

        // Fetch channel_snapshots for the reference period
        const snap = await db.collection("channel_snapshots")
            .where("clientId", "==", clientId)
            .where("date", ">=", referenceStart)
            .where("date", "<=", referenceEnd)
            .get();

        const snapshots = snap.docs.map(d => d.data() as ChannelDailySnapshot);

        // Aggregate metrics by channel
        const channelTotals: Partial<Record<ChannelType, Record<string, number>>> = {};
        const daysByChannel: Partial<Record<ChannelType, number>> = {};

        for (const s of snapshots) {
            const ch = s.channel;
            if (!channelTotals[ch]) channelTotals[ch] = {};
            if (!daysByChannel[ch]) daysByChannel[ch] = 0;
            daysByChannel[ch]!++;

            const mappings = mapMetrics(ch, s.metrics);
            for (const [key, val] of Object.entries(mappings)) {
                channelTotals[ch]![key] = (channelTotals[ch]![key] || 0) + val;
            }
        }

        // Calculate total days in reference period
        const refDays = Math.max(
            1,
            (new Date(referenceEnd).getTime() - new Date(referenceStart).getTime()) / (1000 * 60 * 60 * 24) + 1
        );

        // Aggregate all channels into combined metrics
        const combined: Record<string, number> = {};
        for (const chMetrics of Object.values(channelTotals)) {
            for (const [key, val] of Object.entries(chMetrics!)) {
                combined[key] = (combined[key] || 0) + val;
            }
        }

        // Project to quarterly (90 days)
        const projectionFactor = 90 / refDays;
        const suggestions: Record<string, { baseline: number; suggestedTarget: number; isInverse: boolean; refDays: number; refTotal: number }> = {};

        for (const [metric, total] of Object.entries(combined)) {
            const isInverse = metric === 'cpa';

            if (isInverse) {
                // CPA: compute as spend/conversions, target = 10% lower
                const cpa = combined['conversions'] > 0
                    ? combined['spend'] / combined['conversions']
                    : 0;
                suggestions[metric] = {
                    baseline: Math.round(cpa * 100) / 100,
                    suggestedTarget: Math.round(cpa * 0.90 * 100) / 100,
                    isInverse: true,
                    refDays,
                    refTotal: cpa,
                };
            } else {
                const projected = total * projectionFactor;
                suggestions[metric] = {
                    baseline: Math.round(projected),
                    suggestedTarget: Math.round(projected * 1.15),
                    isInverse: false,
                    refDays,
                    refTotal: total,
                };
            }
        }

        // Also provide per-channel breakdowns for channel goals
        const channelSuggestions: Partial<Record<ChannelType, Record<string, { baseline: number; suggestedTarget: number }>>> = {};
        for (const [ch, metrics] of Object.entries(channelTotals)) {
            channelSuggestions[ch as ChannelType] = {};
            for (const [metric, total] of Object.entries(metrics!)) {
                if (metric === 'cpa') continue; // skip derived metric at channel level
                const projected = total * projectionFactor;
                channelSuggestions[ch as ChannelType]![metric] = {
                    baseline: Math.round(projected),
                    suggestedTarget: Math.round(projected * 1.15),
                };
            }
        }

        return NextResponse.json({
            suggestions,
            channelSuggestions,
            referenceRange: { start: referenceStart, end: referenceEnd },
            snapshotCount: snapshots.length,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Get the reference date range to use for baseline calculation.
 * Uses the same quarter's data if it has started, otherwise previous quarter.
 */
function getReferenceRange(quarter: string): { referenceStart: string; referenceEnd: string } {
    const match = quarter.match(/Q(\d)_(\d{4})/);
    if (!match) throw new Error(`Invalid quarter format: ${quarter}`);

    const qNum = parseInt(match[1]);
    const year = parseInt(match[2]);
    const today = new Date().toISOString().split("T")[0];

    // Target quarter dates
    const startMonth = (qNum - 1) * 3;
    const qStart = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;

    // If we're inside or past this quarter, use its own data up to today
    if (today >= qStart) {
        return { referenceStart: qStart, referenceEnd: today };
    }

    // Otherwise use previous quarter
    let prevQ = qNum - 1;
    let prevYear = year;
    if (prevQ === 0) { prevQ = 4; prevYear--; }
    const prevStartMonth = (prevQ - 1) * 3;
    const prevEndMonth = prevStartMonth + 2;
    const lastDay = new Date(prevYear, prevEndMonth + 1, 0).getDate();

    return {
        referenceStart: `${prevYear}-${String(prevStartMonth + 1).padStart(2, '0')}-01`,
        referenceEnd: `${prevYear}-${String(prevEndMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
}

/**
 * Map channel metrics to objective metric names (same as cron semáforo)
 */
function mapMetrics(channel: ChannelType, metrics: ChannelDailySnapshot['metrics']): Record<string, number> {
    const result: Record<string, number> = {};
    switch (channel) {
        case 'META':
        case 'GOOGLE':
            if (metrics.spend) result['spend'] = metrics.spend;
            if (metrics.revenue) result['revenue'] = metrics.revenue;
            if (metrics.conversions) result['conversions'] = metrics.conversions;
            if (metrics.clicks) result['clicks'] = metrics.clicks;
            if (metrics.impressions) result['impressions'] = metrics.impressions;
            break;
        case 'ECOMMERCE':
            if (metrics.orders) result['orders'] = metrics.orders;
            if (metrics.revenue) result['revenue'] = metrics.revenue;
            break;
        case 'EMAIL':
            if (metrics.sent) result['email_sent'] = metrics.sent;
            if (metrics.opens) result['email_opens'] = metrics.opens;
            if (metrics.emailClicks) result['email_clicks'] = metrics.emailClicks;
            if (metrics.emailRevenue) result['email_revenue'] = metrics.emailRevenue;
            break;
    }
    return result;
}
