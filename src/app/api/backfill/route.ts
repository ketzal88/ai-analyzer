import { NextRequest, NextResponse } from "next/server";
import { BackfillService } from "@/lib/backfill-service";
import { db } from "@/lib/firebase-admin";

export const maxDuration = 300; // 5 minutes

/**
 * Historical Data Backfill API
 * GET /api/backfill?action=stats
 * GET /api/backfill?action=enqueue&clientId=...&days=30
 * GET /api/backfill?action=process&limit=5
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const clientId = searchParams.get("clientId");
    const days = parseInt(searchParams.get("days") || "30");

    try {
        switch (action) {
            case "enqueue":
                if (!clientId) {
                    // Enqueue ALL active clients
                    const clientsSnap = await db.collection("clients").where("active", "==", true).get();
                    const results = [];
                    for (const clientDoc of clientsSnap.docs) {
                        const count = await BackfillService.enqueueClient(clientDoc.id, days);
                        results.push({ clientId: clientDoc.id, name: clientDoc.data().name, enqueued: count });
                    }
                    return NextResponse.json({ success: true, results });
                } else {
                    const count = await BackfillService.enqueueClient(clientId, days);
                    return NextResponse.json({ success: true, enqueued: count });
                }

            case "process":
                const limit = parseInt(searchParams.get("limit") || "5");
                const results = await BackfillService.processBatch(limit);
                return NextResponse.json({ success: true, processed: results });

            case "stats":
                const stats = await BackfillService.getStats();
                return NextResponse.json({ success: true, stats });

            case "cleanup":
                const deleted = await BackfillService.cleanup();
                return NextResponse.json({ success: true, deleted });

            default:
                return NextResponse.json({
                    error: "Invalid action",
                    usage: ["stats", "enqueue", "process", "cleanup"]
                }, { status: 400 });
        }
    } catch (e: any) {
        console.error("[Backfill API Error]:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
