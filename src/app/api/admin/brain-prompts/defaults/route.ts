/**
 * Brain Prompts Defaults API
 *
 * GET /api/admin/brain-prompts/defaults → Returns built-in default prompts for all prompt types
 */

import { NextResponse } from "next/server";
import { DEFAULT_PROMPTS, DEFAULT_COMMON_RULES } from "@/lib/ai-analyst/prompts";
import { DEFAULT_SUGGESTED_QUESTIONS } from "@/lib/ai-analyst/types";
import type { ChannelId } from "@/lib/ai-analyst/types";
import { DEFAULT_SLACK_SUMMARY_PROMPT, DEFAULT_SLACK_CROSS_CHANNEL_PROMPT, DEFAULT_SLACK_USER_TEMPLATE } from "@/lib/slack-summary-prompt";
import { DEFAULT_VISION_PROMPT } from "@/lib/creative-dna-service";

const CHANNEL_IDS: ChannelId[] = ["meta_ads", "google_ads", "ga4", "ecommerce", "email", "leads", "cross_channel", "creative_briefs"];

export async function GET() {
  const defaults: Record<string, any> = {};

  // Channel prompts
  for (const id of CHANNEL_IDS) {
    defaults[id] = {
      systemPrompt: DEFAULT_PROMPTS[id],
      suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS[id] || [],
    };
  }

  // General (COMMON_RULES)
  defaults['general'] = {
    commonRules: DEFAULT_COMMON_RULES,
  };

  // Slack prompts
  defaults['slack_summary'] = { systemPrompt: DEFAULT_SLACK_SUMMARY_PROMPT };
  defaults['slack_cross_channel'] = { systemPrompt: DEFAULT_SLACK_CROSS_CHANNEL_PROMPT };
  defaults['slack_user_template'] = { systemPrompt: DEFAULT_SLACK_USER_TEMPLATE };

  // Creative DNA Vision
  defaults['creative_dna_vision'] = { systemPrompt: DEFAULT_VISION_PROMPT };

  return NextResponse.json(defaults);
}
