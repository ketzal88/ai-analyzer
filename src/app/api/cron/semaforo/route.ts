import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SemaforoEngine } from "@/lib/semaforo-engine";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";
import { QuarterlyObjective, SemaforoEvaluationInput, getCurrentQuarter } from "@/types/semaforo";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { ChannelType } from "@/lib/channel-brain-interface";

export const maxDuration = 300;

/**
 * GET /api/cron/semaforo
 *
 * Daily cron: For each client with an active quarterly objective,
 * sum channel_snapshots from quarter start to today, then compute semáforo.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Semáforo] Starting semáforo computation...");

        const today = new Date().toISOString().split("T")[0];
        const currentQ = getCurrentQuarter();

        // Find all clients with active objectives
        const objectivesSnap = await db.collection("quarterly_objectives")
            .where("quarter", "==", currentQ.quarter)
            .get();

        if (objectivesSnap.empty) {
            console.log("[Cron Semáforo] No objectives found for", currentQ.quarter);
            return NextResponse.json({ success: true, results: [], message: `No objectives for ${currentQ.quarter}` });
        }

        const results: Array<{ clientId: string; status: string; error?: string }> = [];

        for (const objDoc of objectivesSnap.docs) {
            const objective = objDoc.data() as QuarterlyObjective;
            const clientId = objective.clientId;

            try {
                // Fetch all channel_snapshots for this client from quarter start to today
                const snapshotsSnap = await db.collection("channel_snapshots")
                    .where("clientId", "==", clientId)
                    .where("date", ">=", objective.startDate)
                    .where("date", "<=", today)
                    .get();

                const snapshots = snapshotsSnap.docs.map(d => d.data() as ChannelDailySnapshot);

                // Accumulate actuals per metric across all channels
                // Revenue dedup: ECOMMERCE is source of truth when present (total sales).
                // Ads revenue (META/GOOGLE) is platform-attributed and would double-count.
                const actuals: Record<string, number> = {};
                const channelActuals: Partial<Record<ChannelType, Record<string, number>>> = {};
                const hasEcommerce = snapshots.some(s => s.channel === 'ECOMMERCE');

                for (const snap of snapshots) {
                    const ch = snap.channel;
                    if (!channelActuals[ch]) channelActuals[ch] = {};

                    // Map channel metrics to objective metric names
                    const mappings = getMetricMappings(ch, snap.metrics);
                    for (const [metricName, value] of Object.entries(mappings)) {
                        // Skip ads revenue in combined total when ecommerce exists
                        if (metricName === 'revenue' && hasEcommerce && (ch === 'META' || ch === 'GOOGLE')) {
                            // Still track per-channel for channel breakdown
                            channelActuals[ch]![metricName] = (channelActuals[ch]![metricName] || 0) + value;
                            continue;
                        }
                        actuals[metricName] = (actuals[metricName] || 0) + value;
                        channelActuals[ch]![metricName] = (channelActuals[ch]![metricName] || 0) + value;
                    }
                }

                // For CPA-like metrics, compute average instead of sum
                const cpaMetrics = Object.keys(objective.goals).filter(m => objective.goals[m].isInverse);
                for (const metric of cpaMetrics) {
                    // CPA = total spend / total conversions (re-derive from accumulated data)
                    if (metric === 'cpa' && actuals['spend'] && actuals['conversions']) {
                        actuals['cpa'] = actuals['conversions'] > 0
                            ? actuals['spend'] / actuals['conversions']
                            : 0;
                    }
                }

                const input: SemaforoEvaluationInput = {
                    clientId,
                    objective,
                    currentDate: today,
                    actuals,
                    channelActuals,
                };

                const snapshot = SemaforoEngine.evaluate(input);

                // Write to Firestore
                await db.collection("semaforo_snapshots").doc(clientId).set(snapshot);

                console.log(`[Cron Semáforo] ${clientId}: ${snapshot.general.status.toUpperCase()} (score: ${snapshot.general.score})`);
                results.push({ clientId, status: "success" });

            } catch (e: any) {
                await reportError("Cron Semáforo (Client)", e, { clientId });
                results.push({ clientId, status: "failed", error: e.message });
            }
        }

        await EventService.logCronExecution({
            cronType: "semaforo",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: {
                total: results.length,
                success: results.filter(r => r.status === "success").length,
                failed: results.filter(r => r.status === "failed").length,
                skipped: 0,
            },
            results,
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        await reportError("Cron Semáforo (Fatal)", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Map channel snapshot metrics to objective metric names.
 * This bridges channel-specific field names to the business-level metric names
 * used in QuarterlyObjective.goals.
 */
function getMetricMappings(
    channel: ChannelType,
    metrics: ChannelDailySnapshot['metrics']
): Record<string, number> {
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
