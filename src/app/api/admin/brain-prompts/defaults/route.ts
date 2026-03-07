/**
 * Brain Prompts Defaults API
 *
 * GET /api/admin/brain-prompts/defaults → Returns built-in default prompts for all channels
 */

import { NextResponse } from "next/server";
import { DEFAULT_PROMPTS } from "@/lib/ai-analyst/prompts";
import type { ChannelId } from "@/lib/ai-analyst/types";

const CHANNEL_IDS: ChannelId[] = ["meta_ads", "google_ads", "ga4", "ecommerce", "email", "cross_channel", "creative_briefs"];

export async function GET() {
  const defaults: Record<string, string> = {};
  for (const id of CHANNEL_IDS) {
    defaults[id] = DEFAULT_PROMPTS[id];
  }
  return NextResponse.json(defaults);
}
