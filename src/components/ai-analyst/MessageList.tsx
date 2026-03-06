"use client";

import { useEffect, useRef } from "react";
import type { AnalystMessage } from "@/lib/ai-analyst/types";

interface MessageListProps {
  messages: AnalystMessage[];
  isStreaming: boolean;
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] px-4 py-3 text-[11px] font-mono leading-relaxed ${
              msg.role === "user"
                ? "bg-classic/10 border border-classic/20 text-text-primary"
                : "bg-special border border-argent/20 text-text-secondary"
            }`}
          >
            {msg.role === "assistant" ? (
              <MarkdownContent content={msg.content} />
            ) : (
              <span>{msg.content}</span>
            )}
            {/* Streaming cursor */}
            {msg.role === "assistant" && isStreaming && msg === messages[messages.length - 1] && (
              <span className="inline-block w-1.5 h-3.5 bg-classic/80 ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      ))}

      {/* Streaming dots when assistant message is empty */}
      {isStreaming && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
        <div className="flex justify-start">
          <div className="px-4 py-3 bg-special border border-argent/20">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-classic/60 animate-pulse" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 bg-classic/60 animate-pulse" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 bg-classic/60 animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

/** Simple markdown renderer for assistant messages */
function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="text-[10px] font-black text-classic uppercase tracking-widest mt-3 mb-1">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="text-[11px] font-black text-classic uppercase tracking-widest mt-3 mb-1">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h2 key={i} className="text-[12px] font-black text-classic uppercase tracking-widest mt-3 mb-1">
              {line.slice(2)}
            </h2>
          );
        }

        // List items
        if (line.match(/^[-*•]\s/)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-classic shrink-0">›</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        if (line.match(/^\d+\.\s/)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 pl-1">
                <span className="text-text-muted shrink-0">{match[1]}.</span>
                <span>{renderInline(match[2])}</span>
              </div>
            );
          }
        }

        // Empty line
        if (!line.trim()) {
          return <div key={i} className="h-1" />;
        }

        // Regular paragraph
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

/** Render inline markdown (bold) */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-black text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
