"use client";

/**
 * useAnalystChat — Client-side hook for AI Analyst streaming chat
 *
 * Manages multi-turn conversation state, SSE streaming from the API,
 * and abort handling when the panel closes.
 */

import { useState, useCallback, useRef } from "react";
import type { AnalystMessage, AnalystDateRange, ChannelId, SSEEvent } from "@/lib/ai-analyst/types";

interface UseAnalystChatOptions {
  clientId: string | null;
  channelId: ChannelId | null;
  dateRange: AnalystDateRange;
}

interface UseAnalystChatReturn {
  messages: AnalystMessage[];
  isStreaming: boolean;
  sendMessage: (content: string) => void;
  resetChat: () => void;
  error: string | null;
}

export function useAnalystChat({
  clientId,
  channelId,
  dateRange,
}: UseAnalystChatOptions): UseAnalystChatReturn {
  const [messages, setMessages] = useState<AnalystMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!clientId || !channelId || isStreaming || !content.trim()) return;

      setError(null);

      // Add user message
      const userMsg: AnalystMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      // Create assistant placeholder
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: AnalystMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setMessages([...updatedMessages, assistantMsg]);
      setIsStreaming(true);

      // Create abort controller
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const response = await fetch("/api/ai-analyst/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            channelId,
            clientId,
            dateRange,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const event: SSEEvent = JSON.parse(line.slice(6));

              if (event.type === "delta" && event.text) {
                accumulated += event.text;
                // Update the assistant message in place
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated } : m,
                  ),
                );
              } else if (event.type === "error") {
                throw new Error(event.error || "Stream error");
              }
              // type === "done" — stream complete, loop will end naturally
            } catch (parseErr) {
              // Skip malformed events
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // User closed panel — remove empty assistant message
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantId || m.content.length > 0),
          );
        } else {
          setError(err.message || "Failed to get response");
          // Remove empty assistant message on error
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantId || m.content.length > 0),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [clientId, channelId, dateRange, messages, isStreaming],
  );

  const resetChat = useCallback(() => {
    // Abort any in-progress stream
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setIsStreaming(false);
    setError(null);
  }, []);

  return { messages, isStreaming, sendMessage, resetChat, error };
}
