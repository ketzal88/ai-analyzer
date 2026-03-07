/**
 * Export Markdown API
 *
 * GET /api/export/markdown?clientId=X&startDate=Y&endDate=Z&channel=meta_ads
 *
 * Builds AnalystContext and converts it to structured markdown
 * for pasting into LLMs (ChatGPT, Claude, etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";
import { buildAnalystContext } from "@/lib/ai-analyst/context-builder";
import { formatContextAsMarkdown } from "@/lib/markdown-formatter";
import type { ChannelId } from "@/lib/ai-analyst/types";

const VALID_CHANNELS: ChannelId[] = ['meta_ads', 'google_ads', 'ga4', 'ecommerce', 'email', 'cross_channel'];

export async function GET(request: NextRequest) {
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

  // 2. Parse params
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const channel = searchParams.get("channel") as ChannelId | null;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "clientId, startDate, and endDate are required" },
      { status: 400 },
    );
  }

  const channelId: ChannelId = (channel && VALID_CHANNELS.includes(channel))
    ? channel
    : 'cross_channel';

  try {
    // 3. Build context (reuses AI Analyst infrastructure)
    const context = await buildAnalystContext(clientId, channelId, {
      start: startDate,
      end: endDate,
    });

    // 4. Format as markdown
    const markdown = formatContextAsMarkdown(context);

    return NextResponse.json({ markdown });
  } catch (error: any) {
    console.error("[API export/markdown] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
