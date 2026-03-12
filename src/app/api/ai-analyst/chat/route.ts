/**
 * AI Analyst Chat API — SSE Streaming
 *
 * POST /api/ai-analyst/chat
 *
 * Receives conversation messages + channel context params,
 * builds structured XML context from Firestore data,
 * streams Claude's response as Server-Sent Events.
 *
 * Uses Anthropic prompt caching: the system prompt (channel prompt + data XML)
 * is cached for 5 minutes, reducing costs ~90% on follow-up messages.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth, db } from "@/lib/firebase-admin";
import { buildAnalystContext } from "@/lib/ai-analyst/context-builder";
import { formatContextAsXml } from "@/lib/ai-analyst/xml-formatter";
import { getChannelPrompt } from "@/lib/ai-analyst/prompts";
import type { ChatRequestBody, ChannelId } from "@/lib/ai-analyst/types";

export const maxDuration = 60; // 60s timeout for streaming responses

const VALID_CHANNELS: ChannelId[] = ['meta_ads', 'google_ads', 'ga4', 'ecommerce', 'email', 'cross_channel', 'creative_briefs'];

/** Channels that produce long-form structured output need more tokens */
const HIGH_TOKEN_CHANNELS: ChannelId[] = ['creative_briefs'];
const DEFAULT_MAX_TOKENS = 1024;
const HIGH_MAX_TOKENS = 4096;
const RATE_LIMIT_MAX = 30;        // requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  // 1. Auth — verify Firebase session cookie
  const sessionCookie = request.cookies.get("session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await auth.verifySessionCookie(sessionCookie);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // 2. Parse and validate body
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, channelId, clientId, dateRange } = body;

  if (!clientId || !channelId || !dateRange?.start || !dateRange?.end || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Missing required fields: clientId, channelId, dateRange, messages" }, { status: 400 });
  }

  if (!VALID_CHANNELS.includes(channelId)) {
    return NextResponse.json({ error: `Invalid channel: ${channelId}` }, { status: 400 });
  }

  // 3. Rate limit check
  try {
    const rateLimitOk = await checkRateLimit(uid);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 30 messages per hour." },
        { status: 429 },
      );
    }
  } catch (err) {
    console.warn("[AI Analyst] Rate limit check failed, allowing request:", err);
  }

  // 4. Build context + load prompt in parallel
  console.log("[AI Analyst] Building context for:", { clientId, channelId, dateRange, messageCount: messages.length });
  let contextXml: string;
  let channelPrompt: string;
  try {
    const [context, prompt] = await Promise.all([
      buildAnalystContext(clientId, channelId, dateRange),
      getChannelPrompt(channelId),
    ]);
    contextXml = formatContextAsXml(context);
    channelPrompt = prompt;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error("[AI Analyst] Context build failed:", errMsg);
    return NextResponse.json(
      { error: `Failed to build context: ${errMsg}` },
      { status: 500 },
    );
  }

  // 5. Stream response from Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const maxTokens = HIGH_TOKEN_CHANNELS.includes(channelId) ? HIGH_MAX_TOKENS : DEFAULT_MAX_TOKENS;
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: maxTokens,
          system: [
            {
              type: "text",
              text: channelPrompt,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: contextXml,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ type: "delta", text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        // Signal completion
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
        );
        controller.close();
      } catch (err: any) {
        console.error("[AI Analyst] Stream error:", err);
        const errorData = JSON.stringify({
          type: "error",
          error: err.message || "Stream failed",
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    },
  });
}

// ── Rate Limiting ───────────────────────────────────────

async function checkRateLimit(uid: string): Promise<boolean> {
  const ref = db.collection("ai_analyst_rate_limits").doc(uid);
  const doc = await ref.get();
  const now = Date.now();

  if (!doc.exists) {
    await ref.set({ count: 1, windowStart: now });
    return true;
  }

  const data = doc.data()!;
  const windowStart = data.windowStart as number;
  const count = data.count as number;

  // Reset window if expired
  if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
    await ref.set({ count: 1, windowStart: now });
    return true;
  }

  // Check limit
  if (count >= RATE_LIMIT_MAX) {
    return false;
  }

  // Increment
  await ref.update({ count: count + 1 });
  return true;
}
