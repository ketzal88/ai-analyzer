import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { ClientSnapshotService } from "@/lib/client-snapshot-service";
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
                console.log(`[Cron Data Sync] Syncing ${clientId}...`);
                await PerformanceService.syncAllLevels(clientId, client.metaAdAccountId, "this_month");
                await ClientSnapshotService.computeAndStore(clientId);
                await ClientSnapshotService.cleanupOldSnapshots(clientId);

                results.push({ clientId, clientName: client.name, status: "success" });
            } catch (e: any) {
                console.error(`Sync failed for ${clientId}:`, e);
                reportError("Cron Data Sync (Client)", e, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: e.message });
            }
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
        }).catch(() => {});

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
