import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { PerformanceService } from "@/lib/performance-service";
import { ClientSnapshotService } from "@/lib/client-snapshot-service";
import { Client } from "@/types";

export const maxDuration = 300; // 5 minutes for bulk operations

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const range = searchParams.get("range") || "last_30d";

        if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

        console.log(`[Backfill] Starting 30-day backfill for ${clientId}...`);

        // 1. Get client info
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const client = clientDoc.data() as Client;

        if (!client.metaAdAccountId) return NextResponse.json({ error: "No Ad Account configured" }, { status: 400 });

        // 2. Sync history (last_30d)
        const syncResults = await PerformanceService.syncAllLevels(clientId, client.metaAdAccountId, range as any);

        // 3. Re-aggregate
        const snapshot = await ClientSnapshotService.computeAndStore(clientId);

        return NextResponse.json({
            success: true,
            clientId,
            range,
            syncResults,
            snapshotMeta: snapshot.main.meta
        });

    } catch (error: any) {
        console.error("[Backfill] Fatal error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
