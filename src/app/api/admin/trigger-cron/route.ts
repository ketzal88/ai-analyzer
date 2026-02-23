import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { ClientSnapshotService } from "@/lib/client-snapshot-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";

export const maxDuration = 300;

/**
 * POST /api/admin/trigger-cron
 *
 * Manually triggers the full data-sync pipeline for all active clients.
 * Body: { cronType: "data-sync" }
 * Auth: Session cookie (admin only)
 */
export async function POST(request: NextRequest) {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await auth.verifySessionCookie(sessionCookie);
    } catch {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const cronType = body.cronType || "data-sync";

        if (cronType !== "data-sync") {
            return NextResponse.json({ error: "Only data-sync is supported" }, { status: 400 });
        }

        console.log("[Admin Trigger] Starting manual data-sync for all clients...");

        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{
            clientId: string;
            clientName: string;
            status: "success" | "skipped" | "failed";
            error?: string;
        }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            if (!client.metaAdAccountId) {
                results.push({ clientId, clientName: client.name, status: "skipped" });
                continue;
            }

            try {
                console.log(`[Admin Trigger] Syncing ${clientId} (${client.name})...`);

                // CRITICAL: Changed to "today" to avoid exceeding Firebase free tier (20k writes limit).
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
                console.error(`[Admin Trigger] Failed for ${clientId}:`, e);
                reportError("Admin Trigger Cron", e, { clientId });
                results.push({ clientId, clientName: client.name, status: "failed", error: e.message });
            }
        }

        const summary = {
            total: results.length,
            success: results.filter(r => r.status === "success").length,
            skipped: results.filter(r => r.status === "skipped").length,
            failed: results.filter(r => r.status === "failed").length,
        };

        console.log("[Admin Trigger] Completed.", summary);

        return NextResponse.json({ success: true, summary, results });

    } catch (error: any) {
        reportError("Admin Trigger Cron (Fatal)", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
