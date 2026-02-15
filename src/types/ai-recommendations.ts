import { FinalDecision } from "./classifications";

export interface RecommendationDoc {
    id: string; // YYYY-MM-DD_YYYY-MM-DD__promptVersionId__entityId
    clientId: string;
    range: { start: string; end: string };
    rangeHash: string;
    level: 'account' | 'campaign' | 'adset' | 'ad';
    entityId: string;
    decision: FinalDecision;

    evidence: string[]; // List of numeric "facts"
    actions: string[];  // Checklist with steps
    experiments: string[]; // Variations to test
    creativeBrief?: string;

    confidence: number;
    impactScore: number;

    promptVersionId: string;
    createdAt: string;
}

export interface RecommendationResponse {
    recommendation?: RecommendationDoc;
    status: 'generated' | 'cached' | 'insufficient_evidence' | 'error';
    message?: string;
}
