import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { GA4Service } from "@/lib/ga4-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
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
        console.log("[Cron Sync GA4] Starting GA4 sync...");

        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{ clientId: string; clientName?: string; status: string; daysWritten?: number; totalSessions?: number; error?: string }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            // Skip clients without GA4 integration
            if (!client.integraciones?.ga4 || !client.ga4PropertyId) {
                results.push({ clientId, clientName: client.name, status: "skipped" });
                continue;
            }

            try {
                // Sync only yesterday (complete closed day)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const startDate = yesterday.toISOString().split("T")[0];
                const endDate = startDate;

                const { daysWritten, totalSessions } = await GA4Service.syncToChannelSnapshots(
                    clientId,
                    client.ga4PropertyId,
                    startDate,
                    endDate
                );

                results.push({ clientId, clientName: client.name, status: "success", daysWritten, totalSessions });
            } catch (e: any) {
                await reportError("Cron Sync GA4 (Client)", e, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: e.message });
            }
        }

        await EventService.logCronExecution({
            cronType: "sync-ga4",
            startedAt,
            completedAt: new Date().toISOString(),
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

        console.log("[Cron Sync GA4] Completed.", results);
        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        await reportError("Cron Sync GA4 (Fatal)", error);

        await EventService.logCronExecution({
            cronType: "sync-ga4",
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
