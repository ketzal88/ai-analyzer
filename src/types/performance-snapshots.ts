export type EntityLevel = 'account' | 'campaign' | 'adset' | 'ad';

export interface PerformanceMetrics {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number;
    cpc: number;
    purchases?: number;
    leads?: number;
    whatsapp?: number;
    revenue?: number;
    roas?: number;
    addToCart?: number;
    checkout?: number;
    installs?: number;
}

export interface EngagementMetrics {
    hookRate?: number;
    hookViews?: number;
    videoPlayCount?: number;
    videoP50Count?: number;
    videoP75Count?: number;
    videoP100Count?: number;
    fitr?: number; // First Impression Truncation Rate (likely)
    retentionRate?: number;
}

export interface AudienceMetrics {
    newUsersPct?: number;
    returningUsersPct?: number;
    existingCustomersPct?: number;
}

export interface StabilityMetrics {
    daysActive: number;
    daysSinceLastEdit: number;
    creativeAgeDays?: number;
    budgetChange3dPct?: number;
}

export interface MetaInfo {
    campaignId?: string;
    adsetId?: string;
    conceptId?: string;
    personaType?: string;
    proofType?: string;
    formatType?: string;
}

/**
 * daily_entity_snapshots
 * ID: clientId__YYYY-MM-DD__level__entityId
 */
export interface DailyEntitySnapshot {
    clientId: string;
    date: string; // YYYY-MM-DD
    level: EntityLevel;
    entityId: string;
    parentId?: string;
    meta: MetaInfo;
    name?: string;
    performance: PerformanceMetrics;
    engagement: EngagementMetrics;
    audience: AudienceMetrics;
    stability: StabilityMetrics;
}

/**
 * entity_rolling_metrics
 * ID: clientId__entityId__level
 */
export interface EntityRollingMetrics {
    clientId: string;
    entityId: string;
    level: EntityLevel;
    name?: string;
    rolling: {
        spend_3d?: number;
        spend_7d?: number;
        spend_14d?: number;
        spend_30d?: number;

        impressions_7d?: number;
        clicks_7d?: number;
        purchases_7d?: number;
        leads_7d?: number;
        whatsapp_7d?: number;
        installs_7d?: number;

        cpa_3d?: number;
        cpa_7d?: number;
        cpa_14d?: number;
        cpa_delta_pct?: number;

        roas_7d?: number;
        roas_delta_pct?: number;

        conversion_velocity_3d?: number;
        conversion_velocity_7d?: number;
        conversion_velocity_14d?: number;

        frequency_7d?: number;
        ctr_7d?: number;
        ctr_delta_pct?: number;
        hook_rate_7d?: number;
        hook_rate_delta_pct?: number;
        fitr_7d?: number;
        retention_rate_7d?: number;
        conversion_per_impression_delta?: number;

        // Concentration metrics
        spend_top1_ad_pct?: number;
        spend_top3_ads_pct?: number;
        budget_change_3d_pct?: number;
    };
    lastUpdate: string; // YYYY-MM-DD
}

/**
 * concept_rolling_metrics
 * ID: clientId__conceptId
 */
export interface ConceptRollingMetrics {
    clientId: string;
    conceptId: string;
    rolling: {
        avg_cpa_7d: number;
        avg_cpa_14d: number;
        hook_rate_delta: number;
        spend_concentration_top1: number;
        frequency_7d?: number;
        fatigue_flag: boolean;
    };
    lastUpdate: string; // YYYY-MM-DD
}
