"use client";

import React, { useState, useEffect, useCallback } from "react";

interface GenericPromptEditorProps {
  promptId: string;
  label: string;
  description: string;
  defaultPrompt: string;
  customPrompt: string | null;
  isLoading: boolean;
  onSave: (promptId: string, value: string) => Promise<void>;
  onReset: (promptId: string) => Promise<void>;
  /** Field name in Firestore (default: 'systemPrompt', use 'commonRules' for general) */
  fieldName?: string;
}

export default function GenericPromptEditor({
  promptId,
  label,
  description,
  defaultPrompt,
  customPrompt,
  isLoading,
  onSave,
  onReset,
}: GenericPromptEditorProps) {
  const hasCustom = !!(customPrompt && customPrompt.trim());
  const [editValue, setEditValue] = useState(hasCustom ? customPrompt! : defaultPrompt);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  // Sync editValue when customPrompt or defaultPrompt changes externally
  useEffect(() => {
    if (customPrompt && customPrompt.trim()) {
      setEditValue(customPrompt);
    } else {
      setEditValue(defaultPrompt);
    }
  }, [customPrompt, defaultPrompt, promptId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(promptId, editValue);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 3000);
    } catch {
      // parent handles error
    } finally {
      setIsSaving(false);
    }
  }, [promptId, editValue, onSave]);

  const handleReset = useCallback(async () => {
    setIsSaving(true);
    try {
      await onReset(promptId);
      setEditValue(defaultPrompt);
    } catch {
      // parent handles error
    } finally {
      setIsSaving(false);
    }
  }, [promptId, defaultPrompt, onReset]);

  if (isLoading) {
    return (
      <div className="card p-0 overflow-hidden border-argent">
        <div className="p-12 text-center text-text-muted text-small">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden border-argent">
      {/* Header */}
      <header className="bg-special border-b border-argent p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-black text-text-primary uppercase tracking-widest">
              {label}
            </h2>
            {hasCustom ? (
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase rounded-full">
                Custom
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-synced/10 text-synced text-[8px] font-black uppercase rounded-full">
                Default
              </span>
            )}
            {saveFlash && (
              <span className="px-2 py-0.5 bg-synced/20 text-synced text-[8px] font-black uppercase rounded-full animate-in fade-in duration-300">
                Guardado
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-muted mt-1">{description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {hasCustom && (
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Revertir
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-classic px-6 py-2 text-[10px]"
          >
            {isSaving ? "GUARDANDO..." : "GUARDAR"}
          </button>
        </div>
      </header>

      {/* Editor */}
      <div className="p-6">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full h-[400px] bg-stellar border border-argent rounded-xl p-4 text-[12px] font-mono leading-relaxed focus:border-classic outline-none resize-none text-text-primary"
          placeholder="Prompt content..."
        />
        <div className="mt-2 flex justify-end">
          <span className="text-[9px] text-text-muted font-mono">
            {editValue.length.toLocaleString()} chars
          </span>
        </div>
      </div>
    </div>
  );
}
