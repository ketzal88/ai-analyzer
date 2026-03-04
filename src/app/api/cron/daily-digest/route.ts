import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { EngineConfigService } from "@/lib/engine-config-service";
import { EventService } from "@/lib/event-service";
import { Client, Alert } from "@/types";
import { ClientSnapshot } from "@/types/client-snapshot";
import { SemaforoSnapshot } from "@/types/semaforo";
import { reportError } from "@/lib/error-reporter";
import { getAlertChannel } from "@/lib/alert-engine";

/**
 * Daily Digest Cron
 *
 * Sends TWO Slack messages per active client:
 * 1. Daily Snapshot — KPI report for the month
 * 2. Alert Digest — Grouped alert recommendations
 *
 * Also sends individual CRITICAL alerts immediately.
 *
 * Reads from pre-computed client_snapshots (1 read per client).
 *
 * Triggered by: Vercel Cron or manual GET request
 * Auth: Bearer token via CRON_SECRET
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{
            clientId: string;
            clientName: string;
            snapshotSent: boolean;
            alertDigestSent: boolean;
            criticalAlertsSent: number;
            semaforoSent: boolean;
            error?: string;
        }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            try {
                const config = await EngineConfigService.getEngineConfig(clientId);

                const snapshotDoc = await db.collection("client_snapshots").doc(clientId).get();

                let snapshotSent = false;
                let alertDigestSent = false;
                let criticalAlertsSent = 0;
                let semaforoSent = false;

                if (!snapshotDoc.exists) {
                    console.warn(`[Daily Digest] No snapshot found for ${clientId}, skipping.`);
                    results.push({ clientId, clientName: client.name, snapshotSent: false, alertDigestSent: false, criticalAlertsSent: 0, semaforoSent: false });
                    continue;
                }

                const snapshot = snapshotDoc.data() as ClientSnapshot;

                // 1. DAILY SNAPSHOT
                if ((snapshot.accountSummary.rolling.spend_7d || 0) > 0) {
                    const kpis = SlackService.buildSnapshotFromClientSnapshot(snapshot.accountSummary);

                    const todayStr = new Date().toISOString().split("T")[0];
                    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

                    const dateRange = { start: startOfMonth, end: todayStr };

                    await SlackService.sendDailySnapshot(clientId, client.name, dateRange, kpis, config.dailySnapshotTitle);
                    snapshotSent = true;
                }

                // 2. ALERTS — Only send alerts routed to slack_immediate (CRITICAL + SCALING_OPPORTUNITY)
                const alerts = snapshot.alerts;

                if (alerts.length > 0) {
                    const immediateAlerts = alerts.filter((a: Alert) => getAlertChannel(a) === 'slack_immediate');
                    for (const alert of immediateAlerts) {
                        if (alert.severity === "CRITICAL") {
                            await SlackService.sendCriticalAlert(clientId, client.name, alert);
                        }
                        criticalAlertsSent++;
                    }

                    if (immediateAlerts.length > 0) {
                        await SlackService.sendDigest(clientId, client.name, immediateAlerts);
                        alertDigestSent = true;
                    }
                }

                // 3. SEMÁFORO — Send traffic light summary if available
                try {
                    const semaforoDoc = await db.collection("semaforo_snapshots").doc(clientId).get();
                    if (semaforoDoc.exists) {
                        const semaforoSnapshot = semaforoDoc.data() as SemaforoSnapshot;
                        if (Object.keys(semaforoSnapshot.metrics).length > 0) {
                            await SlackService.sendSemaforoDigest(clientId, client.name, semaforoSnapshot);
                            semaforoSent = true;
                        }
                    }
                } catch (semaforoError: any) {
                    console.warn(`[Daily Digest] Semáforo digest failed for ${clientId}:`, semaforoError.message);
                }

                results.push({
                    clientId,
                    clientName: client.name,
                    snapshotSent,
                    alertDigestSent,
                    criticalAlertsSent,
                    semaforoSent,
                });

            } catch (clientError: any) {
                reportError("Cron Daily Digest", clientError, { clientId, clientName: client.name });
                results.push({
                    clientId,
                    clientName: client.name,
                    snapshotSent: false,
                    alertDigestSent: false,
                    criticalAlertsSent: 0,
                    semaforoSent: false,
                    error: clientError.message
                });
            }
        }

        // Log cron execution
        await EventService.logCronExecution({
            cronType: "daily-digest",
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
        reportError("Cron Daily Digest (Fatal)", error);

        await EventService.logCronExecution({
            cronType: "daily-digest",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: { total: 0, success: 0, failed: 1, skipped: 0 },
            results: [{ clientId: "FATAL", status: "failed", error: error.message }],
            triggeredBy: "schedule",
        }).catch(() => {});

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
