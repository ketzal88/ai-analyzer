import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { ClientSnapshotService } from "@/lib/client-snapshot-service";
import { BackfillService } from "@/lib/backfill-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";

export const maxDuration = 300; // Allow 5 minutes

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Data Sync] Starting daily sync job...");
        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{ clientId: string; clientName?: string; status: string; error?: string }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            if (!client.metaAdAccountId) {
                results.push({ clientId, clientName: client.name, status: "skipped" });
                continue;
            }

            try {
                // CRITICAL: Using "today" instead of "this_month" to stay within Firebase free tier (20k writes/day).
                await PerformanceService.syncAllLevels(clientId, client.metaAdAccountId, "today");
                const { main } = await ClientSnapshotService.computeAndStore(clientId);
                await ClientSnapshotService.cleanupOldSnapshots(clientId);

                // Send Daily Digest & Alerts
                const { SlackService } = await import("@/lib/slack-service");
                const { EngineConfigService } = await import("@/lib/engine-config-service");

                try {
                    const config = await EngineConfigService.getEngineConfig(clientId);

                    // 1. Send Daily KPI Snapshot (Month-to-Date)
                    if ((main.accountSummary.rolling.spend_7d || 0) > 0) {
                        const kpis = SlackService.buildSnapshotFromClientSnapshot(main.accountSummary);
                        const todayStr = new Date().toISOString().split("T")[0];
                        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
                        const dateRange = { start: startOfMonth, end: todayStr };

                        await SlackService.sendDailySnapshot(clientId, client.name, dateRange, kpis, config.dailySnapshotTitle);
                    }

                    // 2. Send Alert Digest (Grouped recommendations)
                    if (main.alerts.length > 0) {
                        await SlackService.sendDigest(clientId, client.name, main.alerts);
                    }
                } catch (slackErr) {
                    console.error(`[Slack] Failed to send digest/snapshot for ${client.name}:`, slackErr);
                }

                results.push({ clientId, clientName: client.name, status: "success" });
            } catch (e: any) {
                console.error(`Sync failed for ${clientId}:`, e);
                reportError("Cron Data Sync (Client)", e, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: e.message });
            }
        }

        // --- Historical Backfill Integration ---
        try {
            console.log("[Cron Data Sync] Processing historical backfill batch...");
            const backfillResults = await BackfillService.processBatch(3); // Conservative 3 tasks per run
            if (backfillResults.length > 0) {
                console.log(`[Cron Data Sync] Processed ${backfillResults.length} backfill tasks.`);
            }
        } catch (be) {
            console.error("Backfill processing failed (non-fatal):", be);
        }

        const completedAt = new Date().toISOString();

        // Log cron execution
        await EventService.logCronExecution({
            cronType: "data-sync",
            startedAt,
            completedAt,
            durationMs: Date.now() - startMs,
            summary: {
                total: results.length,
                success: results.filter(r => r.status === "success").length,
                failed: results.filter(r => r.status === "failed").length,
                skipped: results.filter(r => r.status === "skipped").length,
            },
            results,
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        console.log("[Cron Data Sync] Completed.", results);

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        reportError("Cron Data Sync (Fatal)", error);

        // Log failed cron execution
        await EventService.logCronExecution({
            cronType: "data-sync",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: { total: 0, success: 0, failed: 1, skipped: 0 },
            results: [{ clientId: "FATAL", status: "failed", error: error.message }],
            triggeredBy: "schedule",
        }).catch(() => { });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
