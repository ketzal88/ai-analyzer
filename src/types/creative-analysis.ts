/**
 * AG-45: Creative AI Report & Analysis Types
 */

export interface CreativeAIReport {
    id: string; // clientId__adId__range__promptVersionHash
    clientId: string;
    adId: string;
    range: {
        start: string;
        end: string;
        tz?: string;
    };
    rangeKey: string;
    promptId: string;
    promptVersion: number;
    model: string;

    // Structured Output
    output: {
        diagnosis: string;
        risks?: {
            fatigue?: string;
            collision?: string;
            other?: string;
        };
        actions?: {
            horizon7d?: string;
            horizon14d?: string;
            horizon30d?: string;
        };
        score?: number;
    };

    metadata: {
        tokensEstimate: number;
        inputsHash: string;
        generatedAt: string;
    };
}

export interface CreativeVariation {
    concept_name: string;
    difference_axis: string;
    gem_intent: string;
    target_context: string;
    hooks: string[];
    copy_variations: string[];
    headline_variations: string[];
    cta_suggestion: string;
    format_suggestion: string;
    visual_context: string;
    creative_role: 'exploration' | 'expansion' | 'stabilization';
    risk_notes?: string;
}

export interface CreativeVariationsReport {
    id: string;
    clientId: string;
    adId: string;
    range: {
        start: string;
        end: string;
        tz?: string;
    };
    rangeKey: string;
    promptId: string;
    promptVersion: number;
    model: string;
    objective: string;
    variations: CreativeVariation[];
    metadata: {
        generatedAt: string;
        capability: 'variations_copy';
        creative_role: 'exploration';
    };
}

export interface CreativeDetailResponse {
    creative: any; // MetaCreativeDoc
    kpis: any; // CreativeKPIMetrics
    cluster?: {
        size: number;
        totalSpend: number;
        members: Array<{
            adId: string;
            adName: string;
            campaignName: string;
        }>;
    };
    aiReport?: CreativeAIReport | null;
    imageUrl?: string;
    videoUrl?: string;
    videoId?: string;
    previewUrl?: string;
    score?: number;
    reasons?: string[];
}
