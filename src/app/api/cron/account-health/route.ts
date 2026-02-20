import { NextRequest, NextResponse } from "next/server";
import { AccountHealthService } from "@/lib/account-health-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";

/**
 * Account Health Check Cron
 *
 * Checks Meta ad account status and spend cap for all active clients.
 * Detects state transitions (ACTIVE↔DISABLED) and spend cap escalation.
 * Sends alerts to Slack on changes only (no duplicates).
 *
 * Schedule: Every 2 hours (vercel.json)
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
        const results = await AccountHealthService.checkAll();

        const summary = {
            total: results.length,
            success: results.filter(r => r.status === "success").length,
            failed: results.filter(r => r.status === "failed").length,
            skipped: results.filter(r => r.status === "skipped").length,
        };

        await EventService.logCronExecution({
            cronType: "account-health",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary,
            results,
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        return NextResponse.json({ success: true, summary, results });
    } catch (error: any) {
        reportError("Cron Account Health (Fatal)", error);

        await EventService.logCronExecution({
            cronType: "account-health",
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
