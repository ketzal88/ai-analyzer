"use client";

import { useState } from "react";

export interface BriefConfig {
  // Data sources
  useClientCreatives: boolean;
  useSharedLibrary: boolean;
  useCreativeDNA: boolean;
  includeMetrics: boolean;
  // Output type
  staticCount: number;
  carouselCount: number;
  reelCount: number;
}

const DEFAULT_CONFIG: BriefConfig = {
  useClientCreatives: true,
  useSharedLibrary: true,
  useCreativeDNA: true,
  includeMetrics: true,
  staticCount: 8,
  carouselCount: 2,
  reelCount: 4,
};

interface BriefConfigPanelProps {
  onConfigReady: (config: BriefConfig) => void;
}

export default function BriefConfigPanel({ onConfigReady }: BriefConfigPanelProps) {
  const [config, setConfig] = useState<BriefConfig>(DEFAULT_CONFIG);

  const toggle = (key: keyof BriefConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setCount = (key: 'staticCount' | 'carouselCount' | 'reelCount', value: number) => {
    setConfig(prev => ({ ...prev, [key]: Math.max(0, Math.min(20, value)) }));
  };

  const totalPieces = config.staticCount + config.carouselCount + config.reelCount;

  return (
    <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-10 h-10 bg-classic/10 border border-classic/20 flex items-center justify-center mx-auto mb-3">
          <span className="text-classic text-lg font-black">AI</span>
        </div>
        <p className="text-[11px] font-black text-text-primary uppercase tracking-widest mb-1">
          Bajadas Creativas
        </p>
        <p className="text-[10px] text-text-muted font-mono">
          Configurá qué datos usar y cuántas piezas generar
        </p>
      </div>

      {/* Data Sources */}
      <div className="mb-6">
        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-3">
          Fuentes de datos
        </p>
        <div className="space-y-2">
          <CheckboxRow
            label="Creativos ganadores del cliente"
            description="Top ads por spend con mejor rendimiento"
            checked={config.useClientCreatives}
            onChange={() => toggle('useClientCreatives')}
          />
          <CheckboxRow
            label="Biblioteca compartida de Worker"
            description="Ads ganadores históricos cross-client"
            checked={config.useSharedLibrary}
            onChange={() => toggle('useSharedLibrary')}
          />
          <CheckboxRow
            label="Creative DNA (análisis visual)"
            description="Estilo visual, hook type, copy type de cada ad"
            checked={config.useCreativeDNA}
            onChange={() => toggle('useCreativeDNA')}
          />
          <CheckboxRow
            label="Métricas de rendimiento"
            description="Hook rate, CTR, CPA, spend por creativo"
            checked={config.includeMetrics}
            onChange={() => toggle('includeMetrics')}
          />
        </div>
      </div>

      {/* Output Type */}
      <div className="mb-6">
        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-3">
          Tipo de output
        </p>
        <div className="space-y-3">
          <CounterRow
            label="Anuncios estáticos"
            value={config.staticCount}
            onChange={(v) => setCount('staticCount', v)}
          />
          <CounterRow
            label="Carruseles"
            value={config.carouselCount}
            onChange={(v) => setCount('carouselCount', v)}
          />
          <CounterRow
            label="Guiones de Reels"
            value={config.reelCount}
            onChange={(v) => setCount('reelCount', v)}
          />
        </div>
        <div className="mt-3 px-3 py-2 bg-special border border-argent/20">
          <span className="text-[10px] font-mono text-text-muted">
            Total: <span className="text-text-primary font-bold">{totalPieces} piezas</span>
          </span>
        </div>
      </div>

      {/* Confirm */}
      <button
        onClick={() => onConfigReady(config)}
        disabled={totalPieces === 0}
        className="w-full py-3 bg-classic text-stellar font-black text-[10px] uppercase tracking-widest
                   hover:bg-classic/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Configurar y empezar
      </button>

      <p className="text-[9px] text-text-muted font-mono text-center mt-3">
        Después de confirmar, describí el producto o promo
      </p>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function CheckboxRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-start gap-3 px-3 py-2.5 bg-special border border-argent/20 hover:border-argent/40 transition-all cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-classic shrink-0"
      />
      <div>
        <p className="text-[11px] font-bold text-text-primary">{label}</p>
        <p className="text-[9px] text-text-muted font-mono">{description}</p>
      </div>
    </label>
  );
}

function CounterRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-special border border-argent/20">
      <span className="text-[11px] font-bold text-text-primary">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(value - 1)}
          className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary
                     bg-stellar border border-argent/30 hover:border-argent/60 transition-all text-sm font-bold"
        >
          -
        </button>
        <span className="text-[12px] font-mono font-bold text-text-primary w-6 text-center tabular-nums">
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary
                     bg-stellar border border-argent/30 hover:border-argent/60 transition-all text-sm font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
}
