/**
 * Public Channel Snapshots API
 *
 * GET /api/public/:token/channel-snapshots?channel=META&startDate=X&endDate=Y
 *
 * Returns channel_snapshots data for a public token.
 * No auth required — token validation only.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PublicToken } from "@/types";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { ChannelType } from "@/lib/channel-brain-interface";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    // 1. Validate token
    const tokenDoc = await db.collection("public_tokens").doc(token).get();
    if (!tokenDoc.exists) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    const tokenData = tokenDoc.data() as PublicToken;

    if (!tokenData.active) {
      return NextResponse.json({ error: "Token revoked" }, { status: 403 });
    }

    if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 403 });
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel") as ChannelType | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const days = parseInt(searchParams.get("days") || "30", 10);

    const clientId = tokenData.clientId;

    // 3. Query channel_snapshots (same logic as authenticated route)
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
    console.error("[API public/token/channel-snapshots] Error:", error.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
