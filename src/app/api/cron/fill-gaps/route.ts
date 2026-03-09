import { NextRequest, NextResponse } from "next/server";
import { GapDetectionService, GapInfo } from "@/lib/gap-detection-service";
import { ChannelBackfillService, BackfillChannel } from "@/lib/channel-backfill-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";

export const maxDuration = 300;

const MAX_FILLS_PER_RUN = 20;
const PAUSE_BETWEEN_FILLS_MS = 2000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Fill Gaps] Detecting missing snapshots (last 7 days)...");

        const gaps = await GapDetectionService.detectGaps(7);

        if (gaps.length === 0) {
            console.log("[Cron Fill Gaps] No gaps found. All data complete.");

            await EventService.logCronExecution({
                cronType: "fill-gaps",
                startedAt,
                completedAt: new Date().toISOString(),
                durationMs: Date.now() - startMs,
                summary: { total: 0, success: 0, failed: 0, skipped: 0 },
                results: [],
                triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
            });

            return NextResponse.json({ success: true, gaps: 0, filled: 0, results: [] });
        }

        // Flatten gaps into individual fill tasks, sorted by date (oldest first)
        const fillTasks: Array<{ clientId: string; clientName: string; channel: BackfillChannel; date: string; age: number }> = [];
        const today = new Date();

        for (const gap of gaps) {
            for (const date of gap.missingDates) {
                const dateObj = new Date(date + "T12:00:00Z");
                const age = Math.floor((today.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
                fillTasks.push({
                    clientId: gap.clientId,
                    clientName: gap.clientName,
                    channel: gap.channel,
                    date,
                    age,
                });
            }
        }

        // Sort oldest first (higher priority)
        fillTasks.sort((a, b) => b.age - a.age);

        // Cap to avoid timeout
        const tasksToRun = fillTasks.slice(0, MAX_FILLS_PER_RUN);
        const totalGapDays = fillTasks.length;

        console.log(`[Cron Fill Gaps] Found ${totalGapDays} missing days across ${gaps.length} client+channel combos. Processing ${tasksToRun.length}...`);

        const results: Array<{ clientId: string; clientName: string; channel: string; date: string; status: string; error?: string }> = [];

        for (let i = 0; i < tasksToRun.length; i++) {
            const task = tasksToRun[i];
            console.log(`  [${i + 1}/${tasksToRun.length}] ${task.clientName} / ${task.channel} / ${task.date} (${task.age}d old)...`);

            try {
                const result = await ChannelBackfillService.backfillChannel(task.clientId, task.channel, task.date, task.date);

                if (result.status === "success") {
                    results.push({ clientId: task.clientId, clientName: task.clientName, channel: task.channel, date: task.date, status: "success" });
                    console.log(`    OK`);
                } else {
                    results.push({ clientId: task.clientId, clientName: task.clientName, channel: task.channel, date: task.date, status: "failed", error: result.error });
                    console.log(`    FAILED: ${result.error}`);
                }
            } catch (e: any) {
                results.push({ clientId: task.clientId, clientName: task.clientName, channel: task.channel, date: task.date, status: "failed", error: e.message });
                console.log(`    ERROR: ${e.message}`);
            }

            if (i < tasksToRun.length - 1) await sleep(PAUSE_BETWEEN_FILLS_MS);
        }

        // Alert on persistent gaps (3+ days old and still failing)
        const persistentGaps = fillTasks.filter(t => t.age >= 3);
        const failedPersistent = persistentGaps.filter(pg =>
            results.some(r => r.clientId === pg.clientId && r.channel === pg.channel && r.date === pg.date && r.status === "failed")
        );

        if (failedPersistent.length > 0) {
            const summary = failedPersistent
                .slice(0, 10) // cap alert detail
                .map(g => `${g.clientName} / ${g.channel} / ${g.date} (${g.age}d)`)
                .join("\n");

            await reportError("Cron Fill Gaps", new Error(`${failedPersistent.length} persistent gaps (3+ days) could not be filled`), {
                metadata: {
                    gaps: summary,
                    totalGapDays,
                    processed: tasksToRun.length,
                },
            });
        }

        const successCount = results.filter(r => r.status === "success").length;
        const failedCount = results.filter(r => r.status === "failed").length;

        await EventService.logCronExecution({
            cronType: "fill-gaps",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: {
                total: tasksToRun.length,
                success: successCount,
                failed: failedCount,
                skipped: totalGapDays - tasksToRun.length,
            },
            results,
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        console.log(`[Cron Fill Gaps] Done. ${successCount} filled, ${failedCount} failed, ${totalGapDays - tasksToRun.length} deferred.`);

        return NextResponse.json({
            success: true,
            totalGapDays,
            processed: tasksToRun.length,
            filled: successCount,
            failed: failedCount,
            results,
        });

    } catch (error: any) {
        await reportError("Cron Fill Gaps (Fatal)", error);

        await EventService.logCronExecution({
            cronType: "fill-gaps",
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
