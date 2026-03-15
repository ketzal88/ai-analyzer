/**
 * Brain Prompts API — AI Analyst + Slack + Creative DNA
 *
 * GET  /api/admin/brain-prompts           → List all prompt entries (channels + special prompts)
 * POST /api/admin/brain-prompts           → Save/update a prompt (systemPrompt, commonRules, suggestedQuestions)
 * DELETE /api/admin/brain-prompts?id=X    → Delete/revert a prompt to default
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import type { ChannelId } from "@/lib/ai-analyst/types";

/** All prompt document IDs managed by this API */
type PromptId = ChannelId | 'general' | 'slack_summary' | 'slack_cross_channel' | 'slack_user_template' | 'creative_dna_vision';

const CHANNEL_IDS: ChannelId[] = ["meta_ads", "google_ads", "ga4", "ecommerce", "email", "leads", "cross_channel", "creative_briefs"];

const ALL_PROMPT_IDS: PromptId[] = [
  ...CHANNEL_IDS,
  'general',
  'slack_summary',
  'slack_cross_channel',
  'slack_user_template',
  'creative_dna_vision',
];

const PROMPT_LABELS: Record<PromptId, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
  ecommerce: "Ecommerce",
  email: "Email Marketing",
  leads: "Leads / CRM",
  cross_channel: "Cross-Channel",
  creative_briefs: "Bajadas Creativas",
  general: "Reglas Generales (COMMON_RULES)",
  slack_summary: "Slack — Resumen por Canal",
  slack_cross_channel: "Slack — Resumen Cross-Channel",
  slack_user_template: "Slack — Template de Usuario",
  creative_dna_vision: "Creative DNA — Vision Prompt",
};

export async function GET() {
  try {
    const docs = await Promise.all(
      ALL_PROMPT_IDS.map((id) => db.collection("brain_prompts").doc(id).get())
    );

    const prompts = ALL_PROMPT_IDS.map((id, i) => {
      const doc = docs[i];
      const data = doc.exists ? doc.data()! : {};
      const hasCustomPrompt = !!(data.systemPrompt?.trim());
      const hasCustomRules = !!(data.commonRules?.trim());

      return {
        channelId: id,
        label: PROMPT_LABELS[id],
        hasCustomPrompt: id === 'general' ? hasCustomRules : hasCustomPrompt,
        systemPrompt: hasCustomPrompt ? data.systemPrompt : null,
        commonRules: hasCustomRules ? data.commonRules : null,
        suggestedQuestions: Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : null,
        updatedAt: data.updatedAt || null,
      };
    });

    return NextResponse.json(prompts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, systemPrompt, commonRules, suggestedQuestions } = body;

    if (!channelId || !ALL_PROMPT_IDS.includes(channelId)) {
      return NextResponse.json({ error: "Invalid channelId" }, { status: 400 });
    }

    // Build update payload
    const updateData: Record<string, any> = {
      channelId,
      updatedAt: new Date().toISOString(),
    };

    // For 'general' tab, save commonRules; for everything else, save systemPrompt
    if (channelId === 'general') {
      if (commonRules !== undefined) {
        updateData.commonRules = (commonRules || '').trim();
      }
    } else {
      if (systemPrompt !== undefined) {
        updateData.systemPrompt = (systemPrompt || '').trim();
      }
    }

    // Suggested questions (only for channel IDs)
    if (Array.isArray(suggestedQuestions)) {
      updateData.suggestedQuestions = suggestedQuestions.filter((q: string) => q?.trim());
    }

    await db.collection("brain_prompts").doc(channelId).set(updateData, { merge: true });

    return NextResponse.json({ success: true, channelId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("id") as PromptId;

    if (!channelId || !ALL_PROMPT_IDS.includes(channelId)) {
      return NextResponse.json({ error: "Invalid channelId" }, { status: 400 });
    }

    const ref = db.collection("brain_prompts").doc(channelId);
    const doc = await ref.get();

    if (doc.exists) {
      if (channelId === 'general') {
        await ref.update({ commonRules: "" });
      } else {
        await ref.update({ systemPrompt: "" });
      }
    }

    return NextResponse.json({ success: true, channelId, message: "Reverted to default" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
