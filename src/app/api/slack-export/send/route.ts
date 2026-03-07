/**
 * Slack Export — Send Message
 *
 * POST /api/slack-export/send
 *
 * Sends pre-formatted Slack blocks to the client's public channel.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { Client } from "@/types";

export async function POST(request: NextRequest) {
  // 1. Auth
  const sessionCookie = request.cookies.get("session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await auth.verifySessionCookie(sessionCookie, true);
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // 2. Parse body
  const body = await request.json();
  const { clientId, blocks, fallbackText, targetChannel } = body as {
    clientId: string;
    blocks: any[];
    fallbackText: string;
    targetChannel?: string;
  };

  if (!clientId || !blocks || !fallbackText) {
    return NextResponse.json(
      { error: "clientId, blocks, and fallbackText are required" },
      { status: 400 },
    );
  }

  try {
    // 3. Load client to get slackPublicChannel
    const clientDoc = await db.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const client = clientDoc.data() as Client;
    const channel = targetChannel || client.slackPublicChannel || client.slackInternalChannel;

    if (!channel) {
      return NextResponse.json(
        { error: "No Slack channel configured for this client" },
        { status: 400 },
      );
    }

    const botToken = process.env.SLACK_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 });
    }

    // 4. Send to Slack
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({ channel, blocks, text: fallbackText }),
    });
    const data = await res.json();

    if (!data.ok) {
      console.error("[slack-export/send] Slack API Error:", data.error);
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, channel });
  } catch (error: any) {
    console.error("[API slack-export/send] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
