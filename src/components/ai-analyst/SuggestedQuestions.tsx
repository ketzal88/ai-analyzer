"use client";

import type { ChannelId } from "@/lib/ai-analyst/types";
import { SUGGESTED_QUESTIONS, CHANNEL_LABELS } from "@/lib/ai-analyst/types";

interface SuggestedQuestionsProps {
  channelId: ChannelId;
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({ channelId, onSelect }: SuggestedQuestionsProps) {
  const questions = SUGGESTED_QUESTIONS[channelId] || [];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-10 h-10 bg-classic/10 border border-classic/20 flex items-center justify-center mb-4">
        <span className="text-classic text-lg font-black">AI</span>
      </div>
      <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">
        {CHANNEL_LABELS[channelId]}
      </p>
      <p className="text-[11px] text-text-secondary font-mono mb-8 text-center">
        Preguntale algo sobre los datos que estás viendo
      </p>
      <div className="space-y-2 w-full max-w-[340px]">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="w-full text-left px-4 py-3 bg-special border border-argent/20
                       hover:border-classic/30 transition-all text-[11px] font-mono
                       text-text-secondary hover:text-text-primary"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
