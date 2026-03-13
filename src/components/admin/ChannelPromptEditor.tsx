'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ChannelPromptEditorProps {
  channelId: string;
  channelLabel: string;
  defaultPrompt: string;
  customPrompt: string | null;
  suggestedQuestions: string[] | null;
  defaultQuestions: string[];
  isLoading: boolean;
  onSave: (channelId: string, systemPrompt: string, suggestedQuestions: string[]) => Promise<void>;
  onReset: (channelId: string) => Promise<void>;
}

export default function ChannelPromptEditor({
  channelId,
  channelLabel,
  defaultPrompt,
  customPrompt,
  suggestedQuestions,
  defaultQuestions,
  isLoading,
  onSave,
  onReset,
}: ChannelPromptEditorProps) {
  const hasCustom = !!(customPrompt && customPrompt.trim());

  const [editValue, setEditValue] = useState(customPrompt || defaultPrompt);
  const [editQuestions, setEditQuestions] = useState<string[]>(
    suggestedQuestions && suggestedQuestions.length === 3
      ? suggestedQuestions
      : [...defaultQuestions]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Sync when external props change (e.g. after loading from Firestore)
  useEffect(() => {
    setEditValue(customPrompt || defaultPrompt);
  }, [customPrompt, defaultPrompt]);

  useEffect(() => {
    setEditQuestions(
      suggestedQuestions && suggestedQuestions.length === 3
        ? suggestedQuestions
        : [...defaultQuestions]
    );
  }, [suggestedQuestions, defaultQuestions]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(channelId, editValue, editQuestions);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [channelId, editValue, editQuestions, onSave]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await onReset(channelId);
      setEditValue(defaultPrompt);
      setEditQuestions([...defaultQuestions]);
    } finally {
      setIsResetting(false);
    }
  }, [channelId, defaultPrompt, defaultQuestions, onReset]);

  const updateQuestion = (index: number, value: string) => {
    setEditQuestions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  return (
    <div className="card p-0 overflow-hidden border-argent">
      {/* Header */}
      <div className="bg-special px-5 py-3 flex items-center justify-between border-b border-argent">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-black text-text-primary uppercase tracking-widest">
            {channelLabel}
          </h3>
          {hasCustom ? (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full px-2.5 py-0.5">
              Custom en Firestore
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-synced/10 text-synced border border-synced/30 rounded-full px-2.5 py-0.5">
              Usando default del codigo
            </span>
          )}
          {showSaved && (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-synced/20 text-synced rounded-full px-2.5 py-0.5 animate-pulse">
              Guardado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasCustom && (
            <button
              onClick={handleReset}
              disabled={isResetting || isLoading}
              className="bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {isResetting ? 'Revirtiendo...' : 'Revertir a Default'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="btn-classic px-6 py-2 text-[10px] disabled:opacity-50"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </span>
            ) : (
              'Guardar'
            )}
          </button>
        </div>
      </div>

      {/* Textarea */}
      <div className="p-5 space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-2">
            System Prompt
          </label>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            disabled={isLoading}
            className="w-full h-[500px] bg-stellar border border-argent rounded-lg px-4 py-3 text-[12px] font-mono leading-relaxed text-text-primary focus:border-classic outline-none transition-colors resize-y disabled:opacity-50"
            spellCheck={false}
          />
          <div className="mt-1 text-right">
            <span className="text-[10px] font-mono text-text-muted">
              {editValue.length} chars
            </span>
          </div>
        </div>

        {/* Suggested Questions */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-3">
            Preguntas sugeridas para el chat
          </label>
          <div className="space-y-2">
            {editQuestions.map((q, i) => (
              <input
                key={i}
                type="text"
                value={q}
                onChange={(e) => updateQuestion(i, e.target.value)}
                disabled={isLoading}
                className="w-full bg-stellar border border-argent rounded-lg px-4 py-2.5 text-small font-mono text-text-primary focus:border-classic outline-none transition-colors disabled:opacity-50"
                placeholder={`Pregunta ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
