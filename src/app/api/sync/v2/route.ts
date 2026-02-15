import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { PerformanceService } from "@/lib/performance-service";

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const range = searchParams.get("range") || "last_30d";

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        // 1. Auth check
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await auth.verifySessionCookie(sessionCookie);

        // 2. Load client info
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const clientData = clientDoc.data();

        if (!clientData?.active) {
            return NextResponse.json({ error: "Client is inactive." }, { status: 403 });
        }

        const metaAdAccountId = clientData.metaAdAccountId;
        if (!metaAdAccountId) {
            return NextResponse.json({ error: "Client has no Meta Ad Account ID configured." }, { status: 400 });
        }

        console.log(`[Sync v2] Starting extended snapshot sync for ${clientId}. Range: ${range}`);

        // 1. Sync Raw Metrics & Save Snapshots
        const syncResults = await PerformanceService.syncAllLevels(clientId, metaAdAccountId, range);

        // 2. Calculate Rolling Metrics
        await PerformanceService.updateRollingMetrics(clientId);

        // 3. Run Classification Engine (GEM-Aware)
        const { ClassificationService } = await import("@/lib/classification-service");
        const today = new Date().toISOString().split("T")[0];
        const classifiedCount = await ClassificationService.classifyEntitiesForClient(clientId, today);

        // 4. Execute Alert Engine
        const { AlertEngine } = await import("@/lib/alert-engine");
        const alerts = await AlertEngine.run(clientId);

        // 5. Send Slack Digest
        const { SlackService } = await import("@/lib/slack-service");
        await SlackService.sendDigest(clientId, clientData.name, alerts);

        return NextResponse.json({
            success: true,
            results: syncResults,
            classifiedCount,
            alertsCount: alerts.length
        });

    } catch (error: any) {
        console.error("[Sync v2] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
