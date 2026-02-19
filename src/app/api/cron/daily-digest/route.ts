import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { EngineConfigService } from "@/lib/engine-config-service";
import { Client, Alert } from "@/types";
import { ClientSnapshot } from "@/types/client-snapshot";
import { reportError } from "@/lib/error-reporter";

/**
 * Daily Digest Cron
 *
 * Sends TWO Slack messages per active client:
 * 1. 📊 Daily Snapshot — KPI report for the last 7 days
 * 2. 🚀 Alert Digest — Grouped alert recommendations
 *
 * Also sends individual 🚨 CRITICAL alerts immediately.
 *
 * Now reads from pre-computed client_snapshots (1 read per client).
 *
 * Triggered by: Vercel Cron or manual GET request
 * Auth: Bearer token via CRON_SECRET
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
            error?: string;
        }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            try {
                const config = await EngineConfigService.getEngineConfig(clientId);

                // ── Read pre-computed snapshot (1 read instead of ~800) ──
                const snapshotDoc = await db.collection("client_snapshots").doc(clientId).get();

                let snapshotSent = false;
                let alertDigestSent = false;
                let criticalAlertsSent = 0;

                if (!snapshotDoc.exists) {
                    console.warn(`[Daily Digest] No snapshot found for ${clientId}, skipping.`);
                    results.push({ clientId, clientName: client.name, snapshotSent: false, alertDigestSent: false, criticalAlertsSent: 0 });
                    continue;
                }

                const snapshot = snapshotDoc.data() as ClientSnapshot;

                // ── 1. DAILY SNAPSHOT ─────────────────────────────

                if ((snapshot.accountSummary.rolling.spend_7d || 0) > 0) {
                    const kpis = SlackService.buildSnapshotFromClientSnapshot(snapshot.accountSummary);

                    const todayStr = new Date().toISOString().split("T")[0];
                    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

                    const dateRange = { start: startOfMonth, end: todayStr };

                    await SlackService.sendDailySnapshot(clientId, client.name, dateRange, kpis, config.dailySnapshotTitle);
                    snapshotSent = true;
                }

                // ── 2. ALERTS (already computed in snapshot) ─────

                const alerts = snapshot.alerts;

                if (alerts.length > 0) {
                    const criticalAlerts = alerts.filter((a: Alert) => a.severity === "CRITICAL");
                    for (const alert of criticalAlerts) {
                        await SlackService.sendCriticalAlert(clientId, client.name, alert);
                        criticalAlertsSent++;
                    }

                    await SlackService.sendDigest(clientId, client.name, alerts);
                    alertDigestSent = true;
                }

                results.push({
                    clientId,
                    clientName: client.name,
                    snapshotSent,
                    alertDigestSent,
                    criticalAlertsSent
                });

            } catch (clientError: any) {
                reportError("Cron Daily Digest", clientError, { clientId, clientName: client.name });
                results.push({
                    clientId,
                    clientName: client.name,
                    snapshotSent: false,
                    alertDigestSent: false,
                    criticalAlertsSent: 0,
                    error: clientError.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        reportError("Cron Daily Digest (Fatal)", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
