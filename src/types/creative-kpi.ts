/**
 * AG-42: Creative KPI Snapshots & Intelligent Selector
 * DB-first approach for creative performance analysis
 */

export interface CreativeKPIMetrics {
    adId: string;
    creativeId: string;
    fingerprint: string;

    // Core metrics
    spend: number;
    impressions: number;
    reach?: number;
    frequency?: number;
    clicks: number;
    linkClicks?: number;
    primaryConversions: number;
    value: number;

    // Derived KPIs
    cpa: number;
    roas: number;
    ctr: number;
    cpc: number;

    // Comparison (if previous period available)
    prev?: {
        spend: number;
        primaryConversions: number;
        cpa: number;
        roas: number;
        frequency?: number;
    };

    delta?: {
        spendPct: number;
        convPct: number;
        cpaPct: number;
        roasPct: number;
    };
}

export interface CreativeKPISnapshot {
    id: string; // sha256(clientId + rangeStart + rangeEnd + "v1")
    clientId: string;
    range: {
        start: string; // YYYY-MM-DD
        end: string;
    };
    createdAt: string;
    metricsByCreative: CreativeKPIMetrics[];
    coverage: {
        daysRequested: number;
        daysAvailable: number;
    };
    lastSyncAt: string;
}

export type SelectionReason =
    | "TOP_SPEND"
    | "TOP_IMPRESSIONS"
    | "HIGH_FATIGUE_RISK"
    | "UNDERFUNDED_WINNER"
    | "NEW_CREATIVE"
    | "LOW_SIGNAL";

export interface SelectedCreative {
    // Identity
    adId: string;
    creativeId: string;
    campaignId: string;
    campaignName: string;
    adsetId: string;
    adsetName: string;
    adName: string;

    // Creative metadata
    format: string;
    fingerprint: string;
    headline?: string;
    primaryText?: string;

    // KPIs
    kpis: CreativeKPIMetrics;

    // Selection metadata
    score: number;
    reasons: SelectionReason[];

    // Clustering (deduplication)
    cluster?: {
        size: number; // How many creatives share this fingerprint
        spendSum: number; // Total spend of cluster
        memberIds: string[]; // Other adIds in cluster
    };
}

export interface CreativeSelectionResponse {
    clientId: string;
    range: {
        start: string;
        end: string;
    };
    cacheHit: boolean;
    coverage: {
        daysRequested: number;
        daysAvailable: number;
    };
    selected: SelectedCreative[];
    skipped: {
        lowSignalCount: number;
        dedupedCount: number;
    };
    meta: {
        totalCreativesEvaluated: number;
        avgScore: number;
        generatedAt: string;
    };
}

export interface CreativeSelectionFilters {
    clientId: string;
    range?: string; // "last_7d", "last_14d", "last_30d"
    limit?: number; // Default 40, max 50
    includeDeduped?: boolean; // Include cluster members in response
}
