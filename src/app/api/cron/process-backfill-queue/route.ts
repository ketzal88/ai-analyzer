import { NextRequest, NextResponse } from "next/server";
import { ChannelBackfillService } from "@/lib/channel-backfill-service";
import { EventService } from "@/lib/event-service";
import { SlackService } from "@/lib/slack-service";

export const maxDuration = 300; // 5 min — enough for most channels

/**
 * GET /api/cron/process-backfill-queue
 *
 * Processes up to 3 pending tasks from `channel_backfill_queue`.
 * Tasks are created by enqueueBackfill() when a new client is created
 * or a channel is enabled. Runs daily via GitHub Actions (fill-gaps job).
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Backfill Queue] Processing pending tasks...");

        const result = await ChannelBackfillService.processQueue(3);

        const durationMs = Date.now() - startMs;
        console.log(`[Cron Backfill Queue] Done in ${durationMs}ms — ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);

        // Slack notification only when there were tasks to process
        if (result.processed > 0) {
            const taskLines = result.results
                .map(r => `${r.status === "completed" ? "✅" : "❌"} ${r.clientName} / ${r.channel}${r.error ? ` — ${r.error}` : ""}`)
                .join("\n");

            await SlackService.sendError({
                source: "Cron Backfill Queue",
                message: `Procesados ${result.processed} tasks (${result.succeeded} ok, ${result.failed} fail) en ${(durationMs / 1000).toFixed(1)}s\n\n${taskLines}`,
            });
        }

        await EventService.logCronExecution({
            cronType: "process-backfill-queue",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs,
            summary: {
                total: result.processed,
                success: result.succeeded,
                failed: result.failed,
                skipped: 0,
            },
            results: result.results.map(r => ({
                clientId: r.taskId,
                clientName: r.clientName,
                status: r.status,
                error: r.error,
            })),
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        return NextResponse.json({
            success: true,
            durationMs,
            ...result,
        });
    } catch (error: any) {
        console.error("[Cron Backfill Queue] Error:", error.message);

        await SlackService.sendError({
            source: "Cron Backfill Queue",
            message: error.message,
            stack: error.stack,
        });

        await EventService.logCronExecution({
            cronType: "process-backfill-queue",
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
