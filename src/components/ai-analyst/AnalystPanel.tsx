"use client";

import { useEffect, useRef } from "react";
import { useAnalyst } from "@/contexts/AnalystContext";
import { useClient } from "@/contexts/ClientContext";
import { useAnalystChat } from "@/hooks/useAnalystChat";
import { CHANNEL_LABELS } from "@/lib/ai-analyst/types";
import type { ChannelId, AnalystDateRange } from "@/lib/ai-analyst/types";
import MessageList from "./MessageList";
import AnalystInput from "./AnalystInput";
import SuggestedQuestions from "./SuggestedQuestions";

export default function AnalystPanel() {
  const { isOpen, channelId, initialPrompt, closeAnalyst } = useAnalyst();
  const { selectedClientId } = useClient();

  // Default date range: last 30 days
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const dateRange: AnalystDateRange = { start, end };

  const { messages, isStreaming, sendMessage, resetChat, error } =
    useAnalystChat({
      clientId: selectedClientId,
      channelId,
      dateRange,
    });

  // Track previous channelId to reset on change
  const prevChannelRef = useRef<ChannelId | null>(null);
  useEffect(() => {
    if (channelId && channelId !== prevChannelRef.current) {
      resetChat();
      prevChannelRef.current = channelId;
    }
  }, [channelId, resetChat]);

  // Auto-send initial prompt
  const sentPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      isOpen &&
      initialPrompt &&
      initialPrompt !== sentPromptRef.current &&
      messages.length === 0 &&
      !isStreaming
    ) {
      sentPromptRef.current = initialPrompt;
      sendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt, messages.length, isStreaming, sendMessage]);

  if (!isOpen || !channelId) return null;

  const label = CHANNEL_LABELS[channelId] || channelId;

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] z-[100] flex flex-col bg-second border-l border-argent/30 shadow-[-20px_0_60px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-argent/20 bg-special/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-classic/10 border border-classic/20 flex items-center justify-center">
            <span className="text-classic text-[10px] font-black">AI</span>
          </div>
          <div>
            <p className="text-[11px] font-black text-text-primary uppercase tracking-widest">
              Analyst
            </p>
            <p className="text-[9px] text-text-muted font-mono">{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={resetChat}
              className="px-2 py-1 text-[9px] font-black text-text-muted uppercase tracking-widest
                         hover:text-text-primary hover:bg-argent/10 transition-all"
            >
              Reset
            </button>
          )}
          <button
            onClick={closeAnalyst}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary
                       hover:bg-argent/10 transition-all text-lg"
          >
            &times;
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20">
          <p className="text-[10px] text-red-400 font-mono">{error}</p>
        </div>
      )}

      {/* Messages or Suggested Questions */}
      {messages.length === 0 && !isStreaming ? (
        <SuggestedQuestions channelId={channelId} onSelect={sendMessage} />
      ) : (
        <MessageList messages={messages} isStreaming={isStreaming} />
      )}

      {/* Input */}
      <AnalystInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
