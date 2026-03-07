/**
 * Cron: Sync Leads → channel_snapshots
 *
 * Runs daily at 10:00 UTC (after META sync at 09:00 so spend data is available).
 * Aggregates individual lead records into daily LEADS channel snapshots.
 *
 * GET /api/cron/sync-leads
 * Auth: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { LeadsService } from "@/lib/leads-service";
import { EventService } from "@/lib/event-service";
import { Client } from "@/types";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Sync Leads] Starting leads sync...");

        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const cronResults: Array<{ clientId: string; clientName?: string; status: string; error?: string }> = [];
        let successCount = 0;
        let failedCount = 0;

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            // Skip clients without leads integration
            if (!client.integraciones?.leads) continue;

            try {
                // Sync last 7 days to catch qualification updates
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const startDate = weekAgo.toISOString().slice(0, 10);

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const endDate = yesterday.toISOString().slice(0, 10);

                const result = await LeadsService.syncToChannelSnapshots(clientId, startDate, endDate);

                cronResults.push({
                    clientId,
                    clientName: client.name,
                    status: "success",
                });
                successCount++;

                console.log(`[Cron Sync Leads] ${client.name}: ${result.daysWritten} days, ${result.totalLeads} leads`);
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                cronResults.push({
                    clientId,
                    clientName: client.name,
                    status: "error",
                    error: errorMsg,
                });
                failedCount++;
                console.error(`[Cron Sync Leads] Error for ${client.name}:`, errorMsg);
            }
        }

        const duration = Date.now() - startMs;

        // Log cron execution
        await EventService.logCronExecution({
            cronType: "sync-leads",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: duration,
            summary: {
                total: cronResults.length,
                success: successCount,
                failed: failedCount,
                skipped: 0,
            },
            results: cronResults,
            triggeredBy: "schedule",
        });

        console.log(`[Cron Sync Leads] Complete in ${duration}ms. ${cronResults.length} clients processed.`);

        return NextResponse.json({
            ok: true,
            duration: `${duration}ms`,
            results: cronResults,
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[Cron Sync Leads] Fatal error:", errorMsg);

        await EventService.logCronExecution({
            cronType: "sync-leads",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: { total: 0, success: 0, failed: 1, skipped: 0 },
            results: [{ clientId: "system", status: "error", error: errorMsg }],
            triggeredBy: "schedule",
        });

        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
