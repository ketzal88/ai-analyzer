"use client";

import React, { useState, useEffect } from "react";
import SlackBlockPreview from "./SlackBlockPreview";
import type { ChannelId } from "@/lib/ai-analyst/types";

interface SlackExportModalProps {
  clientId: string;
  channelId: ChannelId;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

type ModalState = "initial" | "generating" | "preview" | "editing" | "sending" | "sent" | "error";

interface SlackChannelOption {
  id: string;
  label: string;
  type: "public" | "internal";
}

export default function SlackExportModal({
  clientId,
  channelId,
  startDate,
  endDate,
  onClose,
}: SlackExportModalProps) {
  const [state, setState] = useState<ModalState>("initial");
  const [summary, setSummary] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [blocks, setBlocks] = useState<any[]>([]);
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState("");
  const [sentChannel, setSentChannel] = useState("");

  // Channel selection
  const [slackChannels, setSlackChannels] = useState<SlackChannelOption[]>([]);
  const [selectedSlackChannel, setSelectedSlackChannel] = useState("");

  // Fetch available Slack channels for this client
  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then(r => r.json())
      .then(data => {
        const client = data.client || data;
        const options: SlackChannelOption[] = [];
        if (client.slackPublicChannel) {
          options.push({ id: client.slackPublicChannel, label: `Canal Cliente (${client.slackPublicChannel})`, type: "public" });
        }
        if (client.slackInternalChannel) {
          options.push({ id: client.slackInternalChannel, label: `Canal Interno (${client.slackInternalChannel})`, type: "internal" });
        }
        setSlackChannels(options);
        if (options.length > 0) setSelectedSlackChannel(options[0].id);
      })
      .catch(() => {});
  }, [clientId]);

  async function handleGenerate() {
    setState("generating");
    setError("");
    try {
      const res = await fetch("/api/slack-export/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, channelId, startDate, endDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      setSummary(data.summary);
      setEditedSummary(data.summary);
      setBlocks(data.blocks);
      setClientName(data.clientName);
      setState("preview");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    }
  }

  function handleEdit() {
    setState("editing");
  }

  function handlePreview() {
    const updatedBlocks = blocks.map((b: any) => {
      if (b.type === "section" && b.text?.type === "mrkdwn") {
        return { ...b, text: { ...b.text, text: editedSummary } };
      }
      return b;
    });
    setBlocks(updatedBlocks);
    setState("preview");
  }

  async function handleSend() {
    if (!selectedSlackChannel) {
      setError("Selecciona un canal de Slack");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/slack-export/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          blocks,
          targetChannel: selectedSlackChannel,
          fallbackText: `Resumen Semanal — ${clientName}: ${editedSummary.slice(0, 200)}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Send failed");
      }
      const data = await res.json();
      setSentChannel(data.channel);
      setState("sent");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-stellar border border-white/10 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-black text-sm uppercase tracking-widest">
            Enviar Resumen a Slack
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Initial state */}
          {state === "initial" && (
            <div className="text-center py-8 space-y-4">
              <p className="text-white/60 text-sm">
                Genera un resumen semanal con IA para enviar al canal de Slack del cliente.
              </p>

              {/* Channel selector */}
              {slackChannels.length > 0 ? (
                <div className="max-w-xs mx-auto">
                  <label className="block text-white/40 text-[10px] uppercase tracking-widest font-bold mb-2 text-left">
                    Canal de destino
                  </label>
                  <select
                    value={selectedSlackChannel}
                    onChange={(e) => setSelectedSlackChannel(e.target.value)}
                    className="w-full bg-special border border-white/10 rounded text-white text-sm p-2 focus:outline-none focus:border-classic/50"
                  >
                    {slackChannels.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-red-400/60 text-xs">
                  Este cliente no tiene canales de Slack configurados.
                </p>
              )}

              <button
                onClick={handleGenerate}
                disabled={slackChannels.length === 0}
                className="px-6 py-3 bg-classic text-stellar font-black text-[11px] uppercase tracking-widest hover:bg-classic/90 transition-all disabled:opacity-50"
              >
                Generar Resumen con IA
              </button>
            </div>
          )}

          {/* Generating */}
          {state === "generating" && (
            <div className="text-center py-12">
              <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic rounded-full animate-spin mb-3" />
              <p className="text-white/60 text-sm">Generando resumen con Claude...</p>
            </div>
          )}

          {/* Preview */}
          {state === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                  Vista previa del mensaje
                </p>
                {slackChannels.length > 1 && (
                  <select
                    value={selectedSlackChannel}
                    onChange={(e) => setSelectedSlackChannel(e.target.value)}
                    className="bg-special border border-white/10 rounded text-white text-xs p-1 focus:outline-none focus:border-classic/50"
                  >
                    {slackChannels.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.label}</option>
                    ))}
                  </select>
                )}
              </div>
              <SlackBlockPreview blocks={blocks} />
            </>
          )}

          {/* Editing */}
          {state === "editing" && (
            <>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                Editar resumen
              </p>
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full h-64 bg-special border border-white/10 rounded text-white text-sm p-3 resize-none focus:outline-none focus:border-classic/50"
                placeholder="Edita el resumen..."
              />
              <p className="text-white/30 text-[10px]">
                Usa formato Slack: *bold*, _italic_, • para bullets
              </p>
            </>
          )}

          {/* Sending */}
          {state === "sending" && (
            <div className="text-center py-12">
              <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic rounded-full animate-spin mb-3" />
              <p className="text-white/60 text-sm">Enviando a Slack...</p>
            </div>
          )}

          {/* Sent */}
          {state === "sent" && (
            <div className="text-center py-8">
              <p className="text-synced text-2xl mb-2">✓</p>
              <p className="text-white text-sm font-bold">Resumen enviado</p>
              <p className="text-white/40 text-xs mt-1">
                Canal: {sentChannel}
              </p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button
                onClick={() => setState("initial")}
                className="px-4 py-2 bg-special text-white text-[10px] uppercase tracking-widest font-bold hover:bg-special/80"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(state === "preview" || state === "editing") && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
            <div className="flex gap-2">
              {state === "preview" && (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-special text-white/70 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  Editar
                </button>
              )}
              {state === "editing" && (
                <button
                  onClick={handlePreview}
                  className="px-4 py-2 bg-special text-white/70 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  Vista previa
                </button>
              )}
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-special text-white/70 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
              >
                Regenerar
              </button>
            </div>
            {state === "preview" && (
              <button
                onClick={handleSend}
                className="px-6 py-2 bg-synced text-stellar font-black text-[11px] uppercase tracking-widest hover:bg-synced/90 transition-all"
              >
                Enviar a Slack
              </button>
            )}
          </div>
        )}

        {/* Close button for sent/error states */}
        {(state === "sent" || state === "error") && (
          <div className="flex justify-end px-6 py-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-special text-white/70 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
