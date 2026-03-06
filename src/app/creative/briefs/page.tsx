"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { useAnalystChat } from "@/hooks/useAnalystChat";
import { SUGGESTED_QUESTIONS } from "@/lib/ai-analyst/types";
import type { AnalystDateRange } from "@/lib/ai-analyst/types";
import BriefConfigPanel, { BriefConfig } from "@/components/ai-analyst/BriefConfigPanel";
import MessageList from "@/components/ai-analyst/MessageList";
import AnalystInput from "@/components/ai-analyst/AnalystInput";

function buildBriefConfigPrefix(config: BriefConfig): string {
  const sources: string[] = [];
  if (config.useClientCreatives) sources.push("creativos ganadores del cliente");
  if (config.useSharedLibrary) sources.push("biblioteca compartida de Worker");
  if (config.useCreativeDNA) sources.push("Creative DNA (análisis visual)");
  if (config.includeMetrics) sources.push("métricas de rendimiento");

  const parts: string[] = [];
  if (config.staticCount > 0) parts.push(`${config.staticCount} anuncios estáticos`);
  if (config.carouselCount > 0) parts.push(`${config.carouselCount} carruseles`);
  if (config.reelCount > 0) parts.push(`${config.reelCount} guiones de reels`);

  return `[CONFIGURACIÓN DE BAJADA]
Fuentes: ${sources.join(", ")}
Output: ${parts.join(" + ")}
[/CONFIGURACIÓN]

`;
}

export default function CreativeBriefsPage() {
  const router = useRouter();
  const { selectedClientId } = useClient();
  const [briefConfig, setBriefConfig] = useState<BriefConfig | null>(null);

  // Date range: last 30 days
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const dateRange: AnalystDateRange = { start, end };

  const { messages, isStreaming, sendMessage, resetChat, error } =
    useAnalystChat({
      clientId: selectedClientId,
      channelId: "creative_briefs",
      dateRange,
    });

  const sendWithConfig = useCallback(
    (content: string) => {
      if (briefConfig && messages.length === 0) {
        const prefix = buildBriefConfigPrefix(briefConfig);
        sendMessage(prefix + content);
      } else {
        sendMessage(content);
      }
    },
    [briefConfig, messages.length, sendMessage],
  );

  const handleReset = useCallback(() => {
    resetChat();
    setBriefConfig(null);
  }, [resetChat]);

  const questions = SUGGESTED_QUESTIONS["creative_briefs"] || [];
  const showConfig = !briefConfig && messages.length === 0;
  const showSuggestions = briefConfig && messages.length === 0 && !isStreaming;

  // Auto-scroll ref for message area
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-argent/20 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/creative")}
              className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary
                         hover:bg-argent/10 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
              </svg>
            </button>
            <div>
              <h1 className="text-[14px] font-black text-text-primary uppercase tracking-widest">
                Bajadas Creativas
              </h1>
              <p className="text-[10px] text-text-muted font-mono">
                Generador de briefs para diseñadores basado en patrones ganadores
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(messages.length > 0 || briefConfig) && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-[9px] font-black text-text-muted uppercase tracking-widest
                           border border-argent/20 hover:text-text-primary hover:border-argent/40 transition-all"
              >
                Nueva bajada
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 shrink-0">
            <p className="text-[10px] text-red-400 font-mono">{error}</p>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {showConfig ? (
            /* Step 1: Config panel — centered in the page */
            <div className="h-full flex items-center justify-center overflow-y-auto">
              <div className="w-full max-w-md">
                <BriefConfigPanel onConfigReady={setBriefConfig} />
              </div>
            </div>
          ) : showSuggestions ? (
            /* Step 2: Suggested questions */
            <div className="h-full flex flex-col items-center justify-center px-6">
              <div className="w-10 h-10 bg-classic/10 border border-classic/20 flex items-center justify-center mb-4">
                <span className="text-classic text-lg font-black">AI</span>
              </div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">
                Bajadas Creativas
              </p>
              <p className="text-[11px] text-text-secondary font-mono mb-8 text-center">
                Describí el producto o promo para generar las bajadas
              </p>
              <div className="space-y-2 w-full max-w-lg">
                {questions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendWithConfig(q)}
                    className="w-full text-left px-4 py-3 bg-special border border-argent/20
                               hover:border-classic/30 transition-all text-[11px] font-mono
                               text-text-secondary hover:text-text-primary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Step 3: Chat messages */
            <MessageList messages={messages} isStreaming={isStreaming} />
          )}
        </div>

        {/* Input — hidden during config step */}
        {!showConfig && (
          <div className="shrink-0">
            <AnalystInput
              onSend={sendWithConfig}
              disabled={isStreaming}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
