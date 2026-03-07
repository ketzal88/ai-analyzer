/**
 * Brain Prompts API — AI Analyst
 *
 * GET  /api/admin/brain-prompts           → List all 5 channel prompts (Firestore + defaults)
 * POST /api/admin/brain-prompts           → Save/update a channel prompt
 * DELETE /api/admin/brain-prompts?id=X    → Delete a channel prompt (reverts to default)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import type { ChannelId } from "@/lib/ai-analyst/types";

const CHANNEL_IDS: ChannelId[] = ["meta_ads", "google_ads", "ga4", "ecommerce", "email", "leads", "cross_channel", "creative_briefs"];

const CHANNEL_LABELS: Record<ChannelId, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
  ecommerce: "Ecommerce",
  email: "Email Marketing",
  leads: "Leads / CRM",
  cross_channel: "Cross-Channel",
  creative_briefs: "Bajadas Creativas",
};

export async function GET() {
  try {
    const docs = await Promise.all(
      CHANNEL_IDS.map((id) => db.collection("brain_prompts").doc(id).get())
    );

    const prompts = CHANNEL_IDS.map((id, i) => {
      const doc = docs[i];
      const hasCustom = doc.exists && doc.data()?.systemPrompt?.trim();
      return {
        channelId: id,
        label: CHANNEL_LABELS[id],
        hasCustomPrompt: !!hasCustom,
        systemPrompt: hasCustom ? doc.data()!.systemPrompt : null,
        updatedAt: hasCustom ? doc.data()!.updatedAt || null : null,
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
    const { channelId, systemPrompt } = body;

    if (!channelId || !CHANNEL_IDS.includes(channelId)) {
      return NextResponse.json({ error: "Invalid channelId" }, { status: 400 });
    }

    if (!systemPrompt || !systemPrompt.trim()) {
      return NextResponse.json({ error: "systemPrompt is required" }, { status: 400 });
    }

    await db.collection("brain_prompts").doc(channelId).set(
      {
        systemPrompt: systemPrompt.trim(),
        channelId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, channelId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("id") as ChannelId;

    if (!channelId || !CHANNEL_IDS.includes(channelId)) {
      return NextResponse.json({ error: "Invalid channelId" }, { status: 400 });
    }

    const ref = db.collection("brain_prompts").doc(channelId);
    const doc = await ref.get();

    if (doc.exists) {
      // Remove systemPrompt field (revert to default) but keep other fields
      await ref.update({ systemPrompt: "" });
    }

    return NextResponse.json({ success: true, channelId, message: "Reverted to default" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
