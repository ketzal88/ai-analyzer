/**
 * Core Data Contracts for Meta Ads Diagnostic Tool
 */
export * from "./gem-report";
export * from "./meta-creative";
export * from "./creative-kpi";

export type BusinessType = 'ecommerce' | 'leads' | 'whatsapp' | 'apps';

/**
 * Mission 20: Caching & Analysis Types
 */
export interface DashboardSnapshot {
    id: string; // docId = hash(...)
    clientId: string;
    currentRange: { start: string; end: string };
    compareRange: { start: string; end: string };
    timezone: string;
    currency: string;
    kpis: AdvancedKPISummary[];
    config: KPIConfig;
    createdAt: string;
    dataCoverage: {
        daysAvailable: number;
        daysRequested: number;
    };
}

export interface FindingsRun {
    id: string; // docId = hash(...)
    clientId: string;
    ranges: {
        current: { start: string; end: string };
        compare: { start: string; end: string };
    };
    findingsCount: number;
    findings: DiagnosticFinding[];
    createdAt: string;
}

export interface AnalyzeRequest {
    clientId: string;
    currentRangePreset?: string; // "last_14d"
    currentRangeCustom?: { start: string; end: string };
    compareMode?: "previous_period" | "wow" | "custom";
    flags?: {
        syncIfMissing?: boolean;
        forceRefresh?: boolean;
        runLLM?: boolean;
    };
}

export interface AnalyzeResponse {
    snapshot: DashboardSnapshot;
    findingsRun?: FindingsRun;
    report?: any; // GemReportV1
    meta?: {
        cacheHit: boolean;
        dataFreshness?: string;
        syncRunId?: string;
    };
}

export type severity = "CRITICAL" | "WARNING" | "INFO" | "HEALTHY" | "INACTIVE";

export interface Alert {
    id: string;
    clientId: string;
    level: string; // "account" | "campaign" | "adset" | "ad"
    entityId: string;
    entityName?: string;
    adsetName?: string;
    campaignName?: string;
    type: string;
    severity: severity;
    title: string;
    description: string;
    impactScore: number;
    evidence: string[];
    createdAt: string;
}

export type Severity = severity; // maintain backward compatibility

export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "BRL" | "MXN";

/**
 * Account Interface (Firestore Document)
 */
export type AccountGoal = "scale" | "efficiency";

export interface AdAccount {
    id: string;
    ownerUid: string;
    name: string;
    metaAdAccountId: string;
    targetCpa: number;
    goal: AccountGoal;
    status: "synced" | "sync-required";
    currency: Currency;
    createdAt: string;
    updatedAt: string;
}

/**
 * KPI Summary Interface
 */
export interface KPISummary {
    label: string;
    value: string | number;
    change?: number; // percentage change
    trend?: "up" | "down" | "neutral";
    limit?: string | number;
    suffix?: string;
}

/**
 * Diagnostic Finding (Findings Engine v1)
 */
export interface DiagnosticFinding {
    id: string;
    clientId: string;
    type: string; // CPA_SPIKE, ROAS_DROP, etc.
    title: string;
    description: string;
    severity: Severity;
    status: "DISCREPANCY" | "OPTIMAL" | "ATTENTION";
    entities: string[]; // List of campaign names or IDs affected
    evidence: {
        current: number | string;
        previous: number | string;
        delta: number; // percentage
        threshold: number;
    };
    version: number;
    createdAt: string;
}

/**
 * Diagnostic Report
 */
export interface DiagnosticReport {
    id: string;
    clientId: string;
    generatedAt: string;
    kpis: KPISummary[];
    findings: DiagnosticFinding[];
    campaignPerformance: CampaignPerformanceRow[];
}

export interface CampaignPerformanceRow {
    id: string;
    name: string;
    delivery: number;
    spend: number;
    result: number;
    status: "active" | "paused" | "warning" | "error";
}

/**
 * Insight Metric Interface (Daily Snapshot)
 */
export interface InsightDaily {
    id: string;
    clientId: string;
    campaignId: string;
    campaignName: string;
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchaseValue: number;
    ctr: number;
    cpc: number;
    roas: number;
    cpa: number;
}

/**
 * Sync Run Record
 */
export interface SyncRun {
    id: string;
    clientId: string;
    status: "running" | "completed" | "failed";
    range: string;
    campaignsProcessed: number;
    startedAt: string;
    completedAt?: string;
    error?: string;
}

/**
 * Authentication & User Types
 */
export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}

/**
 * UI State Interfaces
 */
export interface UIState {
    isLoading: boolean;
    error: string | null;
    isEmpty: boolean;
}

/**
 * Pro KPI Panel Types (Mission 16)
 */
export interface KPIConfig {
    primaryConversionType: string; // e.g., "purchase", "lead"
    whatsappClickType?: string;    // e.g., "onsite_conversion.messaging_conversation_started_7d"
    bookingType?: string;          // e.g., "appointment_scheduled"
    valueType: string;             // e.g., "purchase", "offsite_conversion.fb_pixel_purchase"
    currencyCode: Currency;
    timezone: string;
}

export interface KPIDefinition {
    label: string;
    source: string; // e.g., "Meta action_type: purchase"
    formula?: string;
}

export interface AdvancedKPISummary {
    id: string;
    label: string;
    current: string | number;
    previous: string | number;
    delta: number;
    trend: "up" | "down" | "neutral";
    definition?: KPIDefinition;
    suffix?: string;
    prefix?: string;
}

export interface GemSummary {
    learning: { exploration: number; stabilizing: number; exploitation: number; unstable: number };
    intent: { tofu: number; mofu: number; bofu: number };
    decisions: { scale: number; hold: number; rotate: number; kill: number; consolidate: number };
}

export interface DashboardReport {
    id: string;
    clientId: string;
    generatedAt: string;
    dateRange: { start: string; end: string };
    comparisonRange: { start: string; end: string };
    config: KPIConfig;
    kpis: AdvancedKPISummary[];
    findings: DiagnosticFinding[];
    alerts: Alert[];
    gemSummary?: GemSummary;
}

/**
 * Administrative Client Interface (Mission 9 + 16 updates)
 */
export interface Client {
    id: string;
    slug: string;
    name: string;
    active: boolean;
    businessType: BusinessType;
    isEcommerce: boolean;
    isGoogle: boolean;
    metaAdAccountId?: string;
    googleAdsId?: string;
    slackPublicChannel?: string;
    slackInternalChannel?: string;

    // Mission 18: Business Context
    businessModel?: string; // e.g., "SaaS", "E-commerce", "Lead Gen"
    description?: string;
    averageTicket?: number;
    grossMarginPct?: number;
    primaryGoal?: "scale" | "efficiency" | "stability";
    targetCpa?: number;
    targetRoas?: number;
    targetSalesVolume?: number;

    // Mission 18: Advanced Conversion Context
    conversionSchema?: {
        primary: { name: string; actionType: string; isRevenueEvent: boolean };
        secondary?: { name: string; actionType: string }[];
        value?: { actionType: string; currency: Currency; isNet: boolean };
    };

    // Phase 3: Strategic Business Profile
    growthMode?: "aggressive" | "stable" | "conservative";
    ltv?: number;
    seasonalityNotes?: string;
    funnelPriority?: "TOFU" | "MOFU" | "BOFU" | "FULL_FUNNEL";

    constraints?: {
        budgetLockedUntil?: string;
        noCreativeUntil?: string;
        stockRisk?: boolean;
        seasonality?: string;
        maxDailyBudget?: number;
        acceptableVolatilityPct?: number;   // e.g., 30 = tolerates 30% CPA variation
        scalingSpeed?: "slow" | "normal" | "fast";
        fatigueTolerance?: "low" | "normal" | "high";
    };

    kpiConfig?: KPIConfig; // Optional custom overrides (legacy/simplified)
    createdAt: string;
    updatedAt: string;
}

/**
 * Prompt Management (Mission 15)
 */
export interface PromptTemplate {
    id: string;
    key: string; // e.g., "report"
    version: number;
    status: "active" | "draft" | "archived";
    system: string;
    userTemplate: string;
    variables: string[]; // should include "summary_json"
    outputSchemaVersion?: string; // "v1" (old) or "v2" (GemReport)
    criticalInstructions?: string;  // Cerebro: instructions appended after system prompt (JSON schema, language, etc.)
    outputSchema?: string;          // Cerebro: expected output JSON schema (visual reference)
    createdAt: string;
    updatedAt: string;
    createdByUid: string;
}

export interface PromptRun {
    id: string;
    promptId: string;
    clientId: string;
    range: string;
    modelUsed: string;
    latencyMs: number;
    cacheHit: boolean;
    output: string; // max 8KB
    success: boolean;
    error?: string;
    createdAt: string;
}

/**
 * Simple Audit Log for Client changes
 */
export interface AuditLog {
    id: string;
    clientId: string;
    action: "create" | "update" | "archive" | "duplicate";
    timestamp: string;
    userId: string;
}
