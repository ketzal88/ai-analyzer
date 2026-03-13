/**
 * Slack Export — Generate AI Summary
 *
 * POST /api/slack-export/generate
 *
 * Builds channel context, sends to Claude with an "esperanzador" prompt,
 * returns the summary text + pre-formatted Slack blocks.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/firebase-admin";
import { buildAnalystContext } from "@/lib/ai-analyst/context-builder";
import { formatContextAsMarkdown } from "@/lib/markdown-formatter";
import { getSlackSummaryPrompt, getSlackCrossChannelPrompt, getSlackUserTemplate } from "@/lib/slack-summary-prompt";
import type { ChannelId } from "@/lib/ai-analyst/types";

export const maxDuration = 30;

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
  const { clientId, channelId, startDate, endDate } = body as {
    clientId: string;
    channelId?: ChannelId;
    startDate: string;
    endDate: string;
  };

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "clientId, startDate, and endDate are required" },
      { status: 400 },
    );
  }

  const channel: ChannelId = channelId || 'cross_channel';

  try {
    // 3. Build context
    const context = await buildAnalystContext(clientId, channel, {
      start: startDate,
      end: endDate,
    });

    // 4. Format as markdown (Claude reads markdown well)
    const markdown = formatContextAsMarkdown(context);

    // 5. Call Claude — load prompts from Firestore (with defaults fallback)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const [systemPrompt, userTemplate] = await Promise.all([
      channel === 'cross_channel' ? getSlackCrossChannelPrompt() : getSlackSummaryPrompt(),
      getSlackUserTemplate(),
    ]);
    const userMessage = userTemplate.replace('{context}', markdown);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: channel === 'cross_channel' ? 2048 : 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const summary = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    // 6. Build Slack blocks
    const clientName = context._meta.clientName;
    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: `📊 Resumen Semanal — ${clientName}`, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summary },
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_Enviado por Worker Brain_ · ${startDate} → ${endDate}`,
          },
        ],
      },
    ];

    return NextResponse.json({ summary, blocks, clientName });
  } catch (error: any) {
    console.error("[API slack-export/generate] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
