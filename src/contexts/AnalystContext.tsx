"use client";

/**
 * AnalystContext — Global state for the AI Analyst panel
 *
 * Provides openAnalyst/closeAnalyst to any component in the dashboard.
 * Any channel page can trigger the panel with a specific channel and
 * optional initial prompt.
 */

import { createContext, useContext, useState, useCallback } from "react";
import type { ChannelId } from "@/lib/ai-analyst/types";

interface AnalystContextType {
  isOpen: boolean;
  channelId: ChannelId | null;
  initialPrompt: string | null;
  openAnalyst: (channelId: ChannelId, initialPrompt?: string) => void;
  closeAnalyst: () => void;
}

const AnalystContext = createContext<AnalystContextType | undefined>(undefined);

export function AnalystProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [channelId, setChannelId] = useState<ChannelId | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const openAnalyst = useCallback((channel: ChannelId, prompt?: string) => {
    setChannelId(channel);
    setInitialPrompt(prompt || null);
    setIsOpen(true);
  }, []);

  const closeAnalyst = useCallback(() => {
    setIsOpen(false);
    // Keep channelId/initialPrompt until next open (prevents flicker during close animation)
  }, []);

  return (
    <AnalystContext.Provider
      value={{ isOpen, channelId, initialPrompt, openAnalyst, closeAnalyst }}
    >
      {children}
    </AnalystContext.Provider>
  );
}

export function useAnalyst() {
  const context = useContext(AnalystContext);
  if (context === undefined) {
    throw new Error("useAnalyst must be used within an AnalystProvider");
  }
  return context;
}
