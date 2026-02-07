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
        risks: {
            fatigue: string;
            collision: string;
            other?: string;
        };
        actions: {
            horizon7d: string;
            horizon14d: string;
            horizon30d: string;
        };
        score?: number;
    };

    metadata: {
        tokensEstimate: number;
        inputsHash: string;
        generatedAt: string;
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
}
