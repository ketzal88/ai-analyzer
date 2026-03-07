/**
 * Public Token Validation API
 *
 * GET /api/public/:token
 *
 * Validates a public token and returns client info + enabled channels.
 * No auth required — this is the public entry point.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PublicToken, Client } from "@/types";

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

    // 2. Load client (only safe fields)
    const clientDoc = await db.collection("clients").doc(tokenData.clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = clientDoc.data() as Client;

    // Determine enabled channels
    const channels: string[] = [];
    if (client.metaAdAccountId) channels.push("META");
    if (client.integraciones?.google) channels.push("GOOGLE");
    if (client.integraciones?.ecommerce) channels.push("ECOMMERCE");
    if (client.integraciones?.email) channels.push("EMAIL");
    if (client.integraciones?.ga4) channels.push("GA4");

    // 3. Update access stats (fire and forget)
    db.collection("public_tokens").doc(token).update({
      accessCount: (tokenData.accessCount || 0) + 1,
      lastAccessedAt: new Date().toISOString(),
    }).catch(() => {});

    // 4. Return safe client info (no API keys, no Slack channels)
    return NextResponse.json({
      client: {
        id: clientDoc.id,
        name: client.name,
        businessType: client.businessType,
        currency: client.currency || "USD",
        targetCpa: client.targetCpa,
        targetRoas: client.targetRoas,
      },
      channels,
    });
  } catch (error: any) {
    console.error("[API public/token] Error:", error.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
