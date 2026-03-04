import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { ChannelType } from "@/lib/channel-brain-interface";

/**
 * GET /api/channel-snapshots?clientId=xxx&channel=GOOGLE&days=30
 * GET /api/channel-snapshots?clientId=xxx&channel=EMAIL&startDate=2026-01-01&endDate=2026-01-31
 *
 * Returns daily channel snapshots for the given client and channel.
 * Supports either `days` (rolling) or `startDate`+`endDate` (fixed range).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const channel = searchParams.get("channel") as ChannelType | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const days = parseInt(searchParams.get("days") || "30", 10);

    if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    try {
        let query: FirebaseFirestore.Query = db.collection("channel_snapshots")
            .where("clientId", "==", clientId);

        if (channel) {
            query = query.where("channel", "==", channel);
        }

        if (startDate && endDate) {
            query = query
                .where("date", ">=", startDate)
                .where("date", "<=", endDate)
                .orderBy("date", "desc");
        } else {
            const limit = channel ? days : days * 5;
            query = query.orderBy("date", "desc").limit(limit);
        }

        const snap = await query.get();
        const snapshots: ChannelDailySnapshot[] = snap.docs.map(doc => doc.data() as ChannelDailySnapshot);

        return NextResponse.json({ snapshots });
    } catch (error: any) {
        console.error("[API channel-snapshots] Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
