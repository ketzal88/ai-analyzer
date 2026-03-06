/**
 * AI Analyst Types — Worker Brain
 *
 * Type definitions for the AI Analyst chat panel.
 * Maps analyst channel IDs (snake_case) to Firestore ChannelTypes (uppercase).
 */

import { ChannelType } from "@/lib/channel-brain-interface";

// ── Channel IDs ────────────────────────────────────────

/** Active channels with full context builder support */
export type ChannelId =
  | 'meta_ads'
  | 'google_ads'
  | 'ecommerce'
  | 'email'
  | 'cross_channel'
  | 'creative_briefs';

/** Future channels — type stubs only, no context builder logic yet */
export type FutureChannelId = 'ga4' | 'mercadolibre';

/** All channel IDs (active + future) */
export type AllChannelId = ChannelId | FutureChannelId;

/** Maps analyst ChannelId → Firestore ChannelType (null = reads multiple) */
export const CHANNEL_TO_FIRESTORE: Record<ChannelId, ChannelType | null> = {
  meta_ads: 'META',
  google_ads: 'GOOGLE',
  ecommerce: 'ECOMMERCE',
  email: 'EMAIL',
  cross_channel: null,
  creative_briefs: 'META',
};

/** Human-readable channel names for UI */
export const CHANNEL_LABELS: Record<ChannelId, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  ecommerce: 'Ecommerce',
  email: 'Email Marketing',
  cross_channel: 'Cross-Channel',
  creative_briefs: 'Bajadas Creativas',
};

// ── Date Range ─────────────────────────────────────────

export interface AnalystDateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

// ── Messages ───────────────────────────────────────────

export interface AnalystMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ── Context (built server-side, formatted to XML) ──────

export interface AnalystContext {
  _meta: AnalystMeta;
  channel: AnalystChannelData;
  cross_channel_insights?: CrossChannelInsights;
}

export interface AnalystMeta {
  clientId: string;
  clientName: string;
  businessType: string;
  currency: string;
  timezone: string;
  growthMode?: string;
  funnelPriority?: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  previousPeriod: {
    start: string;
    end: string;
  };
  targets: Record<string, number | undefined>;
}

export interface AnalystChannelData {
  id: ChannelId;
  summary: Record<string, number | string | undefined>;
  vs_previous: Record<string, number | undefined>;
  details: ChannelDetails;
}

/** Channel-specific detail structures */
export interface ChannelDetails {
  campaigns?: CampaignSummary[];
  topCreatives?: CreativeSummary[];
  topProducts?: ProductSummary[];
  attribution?: Record<string, AttributionSource>;
  automations?: AutomationSummary[];
  topCampaigns?: EmailCampaignSummary[];
  channelSummaries?: Record<string, Record<string, number | undefined>>;
  winningByAngle?: WinningAngleGroup[];
  libraryReferences?: WinningAdReference[];
  diversityScore?: DiversityScoreSummary;
}

// ── Creative Briefs Channel ────────────────────────────

export interface WinningAngleGroup {
  angle: string; // hookType from Creative DNA
  ads: CreativeSummary[];
}

export interface WinningAdReference {
  angle: string;
  format: string;
  description: string;
  whyItWorked: string;
  keyElements: string[];
  visualStyle: string;
  metrics?: { hookRate?: number; ctr?: number; cpa?: number };
}

export interface DiversityScoreSummary {
  score: number;
  dominantStyle?: string;
  dominantHook?: string;
  formatDistribution?: Record<string, number>;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  type?: string;
  spend: number;
  conversions?: number;
  revenue?: number;
  roas?: number;
  cpa?: number;
  ctr?: number;
  impressions?: number;
  clicks?: number;
  qualityScore?: number;
  impressionShare?: number;
  hookRate?: number;
  holdRate?: number;
}

export interface CreativeSummary {
  adId: string;
  format: string;
  spend: number;
  impressions?: number;
  hookRate?: number;
  holdRate?: number;
  ctr?: number;
  dna?: string; // Compact DNA string: "ugc + curiosity hook + face + offer copy"
}

export interface ProductSummary {
  name: string;
  orders: number;
  revenue: number;
}

export interface AttributionSource {
  orders: number;
  revenue: number;
  percentage?: number;
}

export interface AutomationSummary {
  name: string;
  sent: number;
  openRate?: number;
  clickRate?: number;
  revenue?: number;
}

export interface EmailCampaignSummary {
  name: string;
  sent: number;
  openRate?: number;
  clickRate?: number;
  revenue?: number;
}

export interface CrossChannelInsights {
  attribution_gap?: {
    meta_reported: number;
    google_reported?: number;
    ecommerce_real: number;
    gap_pct: number;
  };
  spend_distribution?: Record<string, number>;
  email_vs_paid?: {
    email_revenue?: number;
    paid_spend?: number;
    paid_revenue?: number;
  };
}

// ── API Request/Response ────────────────────────────────

export interface ChatRequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[];
  channelId: ChannelId;
  clientId: string;
  dateRange: AnalystDateRange;
}

export interface SSEEvent {
  type: 'delta' | 'done' | 'error';
  text?: string;
  error?: string;
}

// ── Suggested Questions ─────────────────────────────────

export const SUGGESTED_QUESTIONS: Record<ChannelId, string[]> = {
  meta_ads: [
    "¿Por qué está tan alto el CPA?",
    "Diagnosticá el creativo con peor Hook Rate",
    "¿Qué campaña debería pausar primero?",
  ],
  google_ads: [
    "¿Cómo mejorar el Quality Score?",
    "¿Vale la pena escalar PMax?",
    "Comparame eficiencia Google vs Meta",
  ],
  ecommerce: [
    "¿Por qué hay tanto abandono de carrito?",
    "Comparame el revenue real vs lo que reporta Meta",
    "¿Cuáles son los productos más rentables?",
  ],
  email: [
    "¿Qué flow/campaña genera más revenue?",
    "¿Cómo están las tasas de apertura vs la industria?",
    "Comparame CPA email vs paid ads",
  ],
  cross_channel: [
    "Dame la foto completa de la cuenta",
    "¿Dónde está la mayor oportunidad de crecimiento?",
    "¿Cómo redistribuirías el presupuesto?",
  ],
  creative_briefs: [
    "Necesito bajadas para [producto/promo]",
    "Generá 10 conceptos para una promo de descuento",
    "Quiero variaciones de nuestro mejor anuncio",
  ],
};
