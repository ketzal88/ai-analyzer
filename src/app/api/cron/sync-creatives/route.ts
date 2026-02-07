import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { syncMetaCreatives } from "@/lib/meta-creative-service";

/**
 * AG-41: Cron endpoint for syncing Meta creatives
 * POST /api/cron/sync-creatives?clientId=xxx
 * Protected by CRON_SECRET header
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Verify cron secret (bypass in development)
        const isDev = process.env.NODE_ENV === "development";
        const cronSecret = request.headers.get("x-cron-secret");

        if (!isDev && cronSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Get clientId from query params
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        // 3. Load client
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const clientData = clientDoc.data()!;
        if (!clientData.active) {
            return NextResponse.json({ error: "Client is inactive" }, { status: 403 });
        }

        if (!clientData.metaAdAccountId) {
            return NextResponse.json({ error: "Client has no Meta Ad Account ID" }, { status: 400 });
        }

        // 4. Run sync
        console.log(`[CRON] Starting creative sync for client ${clientId}`);
        const metrics = await syncMetaCreatives(clientId, clientData.metaAdAccountId);

        // 5. Log sync run
        await db.collection("creative_sync_runs").add({
            clientId,
            ...metrics,
            triggeredBy: "cron"
        });

        return NextResponse.json(metrics, { status: metrics.ok ? 200 : 500 });

    } catch (error: any) {
        console.error("[CRON] Creative sync error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
