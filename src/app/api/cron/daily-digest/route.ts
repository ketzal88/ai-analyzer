import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { AlertEngine } from "@/lib/alert-engine";
import { EngineConfigService } from "@/lib/engine-config-service";
import { EntityRollingMetrics } from "@/types/performance-snapshots";
import { Client, Alert } from "@/types";
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

                // ── 1. DAILY SNAPSHOT ─────────────────────────

                let snapshotSent = false;

                // Try account-level rolling metrics
                let rolling: EntityRollingMetrics | null = null;

                if (client.metaAdAccountId) {
                    const directDoc = await db.collection("entity_rolling_metrics")
                        .doc(`${clientId}__${client.metaAdAccountId}__account`)
                        .get();

                    if (directDoc.exists) {
                        rolling = directDoc.data() as EntityRollingMetrics;
                    }
                }

                if (!rolling) {
                    const altSnap = await db.collection("entity_rolling_metrics")
                        .where("clientId", "==", clientId)
                        .where("level", "==", "account")
                        .limit(1)
                        .get();

                    if (!altSnap.empty) {
                        rolling = altSnap.docs[0].data() as EntityRollingMetrics;
                    }
                }

                if (rolling && (rolling.rolling.spend_7d || 0) > 0) {
                    // Build KPIs from rolling metrics
                    const kpis = SlackService.buildSnapshotFromRolling(rolling);

                    // Try to enrich with daily snapshot aggregation for ATC/Checkout/Leads
                    try {
                        const today = new Date();
                        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

                        const startDate = startOfMonth.toISOString().split("T")[0];
                        const endDate = today.toISOString().split("T")[0];

                        const dailySnaps = await db.collection("daily_entity_snapshots")
                            .where("clientId", "==", clientId)
                            .where("level", "==", "account")
                            .where("date", ">=", startDate)
                            .where("date", "<=", endDate)
                            .get();

                        if (!dailySnaps.empty) {
                            // Calculate total spend for the month to pass to enrichment
                            const totalMonthSpend = dailySnaps.docs.reduce((sum, d) => sum + (d.data().performance?.spend || 0), 0);

                            const enriched = SlackService.buildSnapshotFromDailyAggregation(
                                dailySnaps.docs.map(d => d.data() as any),
                                totalMonthSpend
                            );

                            // Replace kpis with monthly aggregation
                            Object.assign(kpis, enriched);
                        }
                    } catch (enrichError) {
                        console.warn(`[Daily Digest] Could not enrich KPIs for ${clientId}:`, enrichError);
                    }

                    const todayStr = new Date().toISOString().split("T")[0];
                    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

                    const dateRange = {
                        start: startOfMonth,
                        end: todayStr
                    };

                    await SlackService.sendDailySnapshot(clientId, client.name, dateRange, kpis, config.dailySnapshotTitle); // Passed dailySnapshotTitle
                    snapshotSent = true;
                }

                // ── 2. ALERTS ─────────────────────────────────

                let alertDigestSent = false;
                let criticalAlertsSent = 0;

                try {
                    const alerts = await AlertEngine.run(clientId);

                    if (alerts.length > 0) {
                        // Send individual critical alerts
                        const criticalAlerts = alerts.filter((a: Alert) => a.severity === "CRITICAL");
                        for (const alert of criticalAlerts) {
                            await SlackService.sendCriticalAlert(clientId, client.name, alert);
                            criticalAlertsSent++;
                        }

                        // Send grouped digest for all alerts
                        await SlackService.sendDigest(clientId, client.name, alerts);
                        alertDigestSent = true;
                    }
                } catch (alertError: any) {
                    console.warn(`[Daily Digest] Alert generation failed for ${clientId}:`, alertError.message);
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
