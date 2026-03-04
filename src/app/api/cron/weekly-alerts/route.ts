import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { EntityRollingMetrics } from "@/types/performance-snapshots";
import { Client, Alert } from "@/types";
import { ClientSnapshot } from "@/types/client-snapshot";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
import { getAlertChannel } from "@/lib/alert-engine";

/**
 * Weekly Digest Cron
 *
 * Sends TWO Slack messages per active client:
 * 1. Weekly KPI Summary — spend, CPA, ROAS, purchases delta WoW
 * 2. Weekly Alert Digest — WARNING + INFO alerts grouped by type
 *
 * Only WARNING/INFO alerts are included (CRITICAL are sent daily).
 * This includes: video diagnostics (BODY_WEAK, CTA_WEAK, VIDEO_DROPOFF),
 * structural suggestions (CONSOLIDATE), and other non-urgent signals.
 *
 * Triggered by: Vercel Cron (weekly) or manual GET request
 * Auth: Bearer token via CRON_SECRET
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        const clientsSnap = await db.collection("clients").where("active", "==", true).get();
        const results: Array<{
            clientId: string;
            clientName: string;
            summarySent: boolean;
            weeklyAlertsSent: number;
            error?: string;
        }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            try {
                // 1. Get account-level rolling metrics for KPI summary
                let rolling: EntityRollingMetrics | null = null;
                const rollingQuery = await db.collection("entity_rolling_metrics")
                    .where("clientId", "==", clientId)
                    .where("level", "==", "account")
                    .limit(1)
                    .get();

                if (!rollingQuery.empty) {
                    rolling = rollingQuery.docs[0].data() as EntityRollingMetrics;
                }

                let summarySent = false;

                // Send KPI summary if there's spend
                if (rolling && (rolling.rolling.spend_7d || 0) > 0) {
                    const r = rolling.rolling;
                    const kpis = {
                        spend: r.spend_7d || 0,
                        spendDelta: r.budget_change_3d_pct || 0,
                        cpa: r.cpa_7d || 0,
                        cpaDelta: r.cpa_delta_pct || 0,
                        roas: r.roas_7d || 0,
                        roasDelta: r.roas_delta_pct || 0,
                        purchases: r.purchases_7d || 0,
                        purchasesDelta: 0
                    };

                    await SlackService.sendWeeklySummary(clientId, client.name, kpis);
                    summarySent = true;
                }

                // 2. Get alerts from snapshot and filter for weekly channel
                let weeklyAlertsSent = 0;
                const snapshotDoc = await db.collection("client_snapshots").doc(clientId).get();

                if (snapshotDoc.exists) {
                    const snapshot = snapshotDoc.data() as ClientSnapshot;
                    const weeklyAlerts = (snapshot.alerts || []).filter(
                        (a: Alert) => getAlertChannel(a) === 'slack_weekly'
                    );

                    if (weeklyAlerts.length > 0) {
                        await SlackService.sendDigest(clientId, client.name, weeklyAlerts);
                        weeklyAlertsSent = weeklyAlerts.length;
                    }
                }

                results.push({ clientId, clientName: client.name, summarySent, weeklyAlertsSent });
            } catch (clientError: any) {
                reportError("Cron Weekly Alerts", clientError, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, summarySent: false, weeklyAlertsSent: 0, error: clientError.message });
            }
        }

        await EventService.logCronExecution({
            cronType: "weekly-alerts",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: {
                total: results.length,
                success: results.filter(r => !r.error).length,
                failed: results.filter(r => r.error).length,
                skipped: 0,
            },
            results: results.map(r => ({
                clientId: r.clientId,
                clientName: r.clientName,
                status: r.error ? "failed" : "success",
                error: r.error,
            })),
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });
    } catch (error: any) {
        reportError("Cron Weekly Alerts (Fatal)", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
