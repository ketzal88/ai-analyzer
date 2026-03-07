"use client";

import React, { useState } from "react";
import SlackExportModal from "./SlackExportModal";
import type { ChannelId } from "@/lib/ai-analyst/types";

interface SlackExportButtonProps {
  clientId: string;
  channelId: ChannelId;
  startDate: string;
  endDate: string;
}

export default function SlackExportButton({
  clientId,
  channelId,
  startDate,
  endDate,
}: SlackExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-special/80 text-white/70 font-black text-[10px] uppercase tracking-widest hover:bg-special hover:text-white transition-all whitespace-nowrap"
        title="Enviar resumen semanal al canal de Slack del cliente"
      >
        Enviar Resumen
      </button>

      {isOpen && (
        <SlackExportModal
          clientId={clientId}
          channelId={channelId}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
