"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PublicChannelView from "@/components/public/PublicChannelView";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { UnifiedDateRange, resolvePreset, getComparisonRange } from "@/lib/date-utils";

interface ClientInfo {
  id: string;
  name: string;
  businessType?: string;
  currency?: string;
  targetCpa?: number;
  targetRoas?: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  META: "Meta Ads",
  GOOGLE: "Google Ads",
  ECOMMERCE: "Ecommerce",
  EMAIL: "Email Marketing",
  GA4: "Google Analytics",
};

type PageState = "loading" | "ready" | "error";

export default function PublicDashboardPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState("");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [dateRange, setDateRange] = useState<UnifiedDateRange>(() => resolvePreset("mtd"));
  const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<ChannelDailySnapshot[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // 1. Validate token & load client info
  useEffect(() => {
    if (!token) return;

    fetch(`/api/public/${token}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? "Link invalido" : res.status === 403 ? "Link revocado o expirado" : "Error");
        return res.json();
      })
      .then(data => {
        setClient(data.client);
        setChannels(data.channels);
        setActiveChannel(data.channels[0] || "");
        setState("ready");
      })
      .catch(err => {
        setError(err.message);
        setState("error");
      });
  }, [token]);

  // 2. Fetch channel data when channel or dates change
  useEffect(() => {
    if (state !== "ready" || !activeChannel) return;

    setDataLoading(true);
    const compRange = getComparisonRange(dateRange);

    Promise.all([
      fetch(`/api/public/${token}/channel-snapshots?channel=${activeChannel}&startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.json()),
      fetch(`/api/public/${token}/channel-snapshots?channel=${activeChannel}&startDate=${compRange.start}&endDate=${compRange.end}`).then(r => r.json()),
    ])
      .then(([curr, prev]) => {
        setSnapshots(curr.snapshots || []);
        setPrevSnapshots(prev.snapshots || []);
      })
      .catch(err => console.error("Error fetching channel data:", err))
      .finally(() => setDataLoading(false));
  }, [token, state, activeChannel, dateRange.start, dateRange.end]);

  // Loading state
  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-classic/30 border-t-classic rounded-full animate-spin mb-4" />
          <p className="text-white/40 text-sm">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-400 text-lg font-bold mb-2">{error}</p>
          <p className="text-white/40 text-sm">Contacta a tu equipo de Worker para obtener un nuevo link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] text-classic font-bold uppercase tracking-widest mb-1">Worker Brain</p>
          <h1 className="text-2xl font-black text-white">{client?.name}</h1>
          {client?.businessType && (
            <p className="text-white/40 text-xs mt-1">{client.businessType}</p>
          )}
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </header>

      {/* Channel tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/10 pb-px">
        {channels.map(ch => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeChannel === ch
                ? "text-classic border-b-2 border-classic"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {CHANNEL_LABELS[ch] || ch}
          </button>
        ))}
      </div>

      {/* Channel content */}
      {dataLoading ? (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic rounded-full animate-spin" />
        </div>
      ) : (
        <PublicChannelView
          channel={activeChannel}
          snapshots={snapshots}
          prevSnapshots={prevSnapshots}
          currency={client?.currency === "ARS" ? "AR$" : "$"}
        />
      )}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-white/5 text-center">
        <p className="text-white/20 text-[10px] uppercase tracking-widest">Powered by Worker Brain</p>
      </footer>
    </div>
  );
}
