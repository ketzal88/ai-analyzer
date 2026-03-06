"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface AnalystInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function AnalystInput({ onSend, disabled }: AnalystInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-argent/20 p-4 bg-special/40">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Esperando respuesta..." : "Escribí tu pregunta..."}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-special border border-argent/30 px-4 py-3 text-[11px] font-mono
                     text-text-primary placeholder:text-text-muted/50 resize-none
                     focus:outline-none focus:border-classic/40 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="w-10 h-10 flex items-center justify-center bg-classic text-stellar
                     hover:bg-classic/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 12V4M8 4L4 8M8 4L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </svg>
        </button>
      </div>
    </div>
  );
}
