"use client";

import React, { useState } from "react";
import type { ChannelId } from "@/lib/ai-analyst/types";

interface ExportMarkdownButtonProps {
  clientId: string;
  channelId: ChannelId;
  startDate: string;
  endDate: string;
}

export default function ExportMarkdownButton({
  clientId,
  channelId,
  startDate,
  endDate,
}: ExportMarkdownButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "copied">("idle");

  async function handleExport() {
    if (state === "loading") return;
    setState("loading");

    try {
      const params = new URLSearchParams({
        clientId,
        channel: channelId,
        startDate,
        endDate,
      });

      const res = await fetch(`/api/export/markdown?${params}`);
      if (!res.ok) throw new Error("Export failed");

      const { markdown } = await res.json();
      await navigator.clipboard.writeText(markdown);

      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error("[ExportMarkdown] Error:", err);
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={state === "loading"}
      className="px-3 py-2 bg-special/80 text-white/70 font-black text-[10px] uppercase tracking-widest hover:bg-special hover:text-white transition-all whitespace-nowrap disabled:opacity-50"
      title="Copiar datos como markdown para pegar en ChatGPT/Claude"
    >
      {state === "loading" ? "Exportando..." : state === "copied" ? "Copiado!" : "Exportar LLM"}
    </button>
  );
}
