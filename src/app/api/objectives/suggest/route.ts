import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { ChannelType } from "@/lib/channel-brain-interface";

/**
 * GET /api/objectives/suggest?clientId=xxx&quarter=Q1_2026
 *
 * Baseline logic:
 * 1. Take last 60 days of data → compute daily average per metric
 * 2. Multiply by days in the target quarter → projected quarter total = baseline
 * 3. Target = baseline * 1.15
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const quarter = searchParams.get("quarter");

    if (!clientId || !quarter) {
        return NextResponse.json({ error: "clientId and quarter are required" }, { status: 400 });
    }

    try {
        // Parse target quarter to know how many days it has
        const { quarterStart, quarterEnd, quarterDays } = getQuarterDates(quarter);

        // Reference window: last 60 days from today
        const today = new Date();
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const refStart = sixtyDaysAgo.toISOString().split("T")[0];
        const refEnd = today.toISOString().split("T")[0];

        // Fetch snapshots for the 60-day window
        const snap = await db.collection("channel_snapshots")
            .where("clientId", "==", clientId)
            .where("date", ">=", refStart)
            .where("date", "<=", refEnd)
            .get();

        const snapshots = snap.docs.map(d => d.data() as ChannelDailySnapshot);

        if (snapshots.length === 0) {
            return NextResponse.json({ error: "No hay data en los últimos 60 días" }, { status: 404 });
        }

        // Count actual unique days with data (not calendar days)
        const uniqueDates = new Set(snapshots.map(s => s.date));
        const daysWithData = uniqueDates.size;

        // Aggregate metrics by channel
        const channelTotals: Partial<Record<ChannelType, Record<string, number>>> = {};

        for (const s of snapshots) {
            const ch = s.channel;
            if (!channelTotals[ch]) channelTotals[ch] = {};

            const mappings = mapMetrics(ch, s.metrics);
            for (const [key, val] of Object.entries(mappings)) {
                channelTotals[ch]![key] = (channelTotals[ch]![key] || 0) + val;
            }
        }

        // Combined metrics with revenue dedup
        const combined: Record<string, number> = {};
        const hasEcommerce = !!channelTotals['ECOMMERCE'];

        for (const [ch, chMetrics] of Object.entries(channelTotals)) {
            for (const [key, val] of Object.entries(chMetrics!)) {
                if (key === 'revenue' && hasEcommerce && (ch === 'META' || ch === 'GOOGLE')) {
                    continue;
                }
                combined[key] = (combined[key] || 0) + val;
            }
        }

        // Baseline = (total in 60d / days with data) * days in quarter
        const suggestions: Record<string, {
            baseline: number;
            suggestedTarget: number;
            isInverse: boolean;
            dailyAvg: number;
            daysWithData: number;
            quarterDays: number;
        }> = {};

        for (const [metric, total] of Object.entries(combined)) {
            const isInverse = metric === 'cpa';

            if (isInverse) {
                const cpa = combined['conversions'] > 0
                    ? combined['spend'] / combined['conversions']
                    : 0;
                suggestions[metric] = {
                    baseline: Math.round(cpa * 100) / 100,
                    suggestedTarget: Math.round(cpa * 0.90 * 100) / 100,
                    isInverse: true,
                    dailyAvg: cpa,
                    daysWithData,
                    quarterDays,
                };
            } else {
                const dailyAvg = total / daysWithData;
                const baseline = dailyAvg * quarterDays;
                suggestions[metric] = {
                    baseline: Math.round(baseline),
                    suggestedTarget: Math.round(baseline * 1.15),
                    isInverse: false,
                    dailyAvg: Math.round(dailyAvg),
                    daysWithData,
                    quarterDays,
                };
            }
        }

        // Per-channel breakdowns
        const channelSuggestions: Partial<Record<ChannelType, Record<string, { baseline: number; suggestedTarget: number }>>> = {};
        for (const [ch, metrics] of Object.entries(channelTotals)) {
            channelSuggestions[ch as ChannelType] = {};
            for (const [metric, total] of Object.entries(metrics!)) {
                if (metric === 'cpa') continue;
                const dailyAvg = total / daysWithData;
                const baseline = dailyAvg * quarterDays;
                channelSuggestions[ch as ChannelType]![metric] = {
                    baseline: Math.round(baseline),
                    suggestedTarget: Math.round(baseline * 1.15),
                };
            }
        }

        return NextResponse.json({
            suggestions,
            channelSuggestions,
            referenceRange: { start: refStart, end: refEnd },
            daysWithData,
            quarterDays,
            snapshotCount: snapshots.length,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Get target quarter date range and number of days.
 * Cuatrimestres: Q1=Ene-Abr, Q2=May-Ago, Q3=Sep-Dic (4 months each)
 */
function getQuarterDates(quarter: string): { quarterStart: string; quarterEnd: string; quarterDays: number } {
    const match = quarter.match(/Q(\d)_(\d{4})/);
    if (!match) throw new Error(`Invalid quarter format: ${quarter}`);

    const qNum = parseInt(match[1]);
    const year = parseInt(match[2]);
    const startMonth = (qNum - 1) * 4;     // 0, 4, 8 (0-indexed)
    const endMonth = startMonth + 3;        // 3, 7, 11 (0-indexed)
    const lastDay = new Date(year, endMonth + 1, 0).getDate();

    const quarterStart = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
    const quarterEnd = `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const days = (new Date(quarterEnd).getTime() - new Date(quarterStart).getTime()) / (1000 * 60 * 60 * 24) + 1;

    return { quarterStart, quarterEnd, quarterDays: days };
}

/**
 * Map channel metrics to objective metric names
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
