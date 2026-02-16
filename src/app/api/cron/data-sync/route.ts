import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";

export const maxDuration = 300; // Allow 5 minutes

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[Cron Data Sync] Starting daily sync job...");
        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            if (!client.metaAdAccountId) {
                results.push({ clientId, status: "skipped_no_ad_account" });
                continue;
            }

            try {
                console.log(`[Cron Data Sync] Syncing ${clientId}...`);
                // 1. Sync the current month to ensure completeness and capture attributions
                await PerformanceService.syncAllLevels(clientId, client.metaAdAccountId, "this_month");

                // 2. Update rolling metrics
                await PerformanceService.updateRollingMetrics(clientId);

                results.push({ clientId: clientId, status: "success" });
            } catch (e: any) {
                console.error(`Sync failed for ${clientId}:`, e);
                reportError("Cron Data Sync (Client)", e, { clientId: clientId });
                results.push({ clientId: clientId, status: "failed", error: e.message });
            }
        }

        console.log("[Cron Data Sync] Completed.", results);

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        reportError("Cron Data Sync (Fatal)", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
