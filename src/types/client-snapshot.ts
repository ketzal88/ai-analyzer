import { EntityLevel, EntityRollingMetrics, ConceptRollingMetrics } from "./performance-snapshots";
import { Alert } from "./index";

/** Doc principal: client_snapshots/{clientId} */
export interface ClientSnapshot {
    clientId: string;
    computedAt: string;
    computedDate: string;

    entities: {
        account: EntitySnapshotEntry[];
        campaign: EntitySnapshotEntry[];
        adset: EntitySnapshotEntry[];
    };

    concepts: ConceptSnapshotEntry[];
    classifications: ClassificationEntry[];
    alerts: Alert[];

    accountSummary: {
        rolling: EntityRollingMetrics["rolling"];
        mtd: MTDAggregation | null;
    };

    meta: {
        entityCounts: { account: number; campaign: number; adset: number; ad: number };
        alertCounts: { critical: number; warning: number; info: number };
        docSizeKB: number;
    };
}

/** Doc de ads: client_snapshots_ads/{clientId} */
export interface ClientSnapshotAds {
    clientId: string;
    computedDate: string;
    ads: EntitySnapshotEntry[];
    classifications: ClassificationEntry[];
    meta: { adCount: number; docSizeKB: number };
}

export interface EntitySnapshotEntry {
    entityId: string;
    name?: string;
    level: EntityLevel;
    parentId?: string;
    conceptId?: string;
    rolling: EntityRollingMetrics["rolling"];
}

export interface ConceptSnapshotEntry {
    conceptId: string;
    rolling: ConceptRollingMetrics["rolling"];
}

export interface ClassificationEntry {
    entityId: string;
    level: EntityLevel;
    conceptId?: string;
    learningState: string;
    intentScore: number;
    intentStage: string;
    fatigueState: string;
    structuralState: string;
    finalDecision: string;
    evidence: string[];
    confidenceScore: number;
    impactScore: number;
    creativeCategory?: string;          // Phase 4: DOMINANT_SCALABLE | WINNER_SATURATING | etc.
    creativeCategoryReasoning?: string;
}

export interface MTDAggregation {
    spend: number;
    clicks: number;
    impressions: number;
    purchases: number;
    revenue: number;
    leads: number;
    whatsapp: number;
    addToCart: number;
    checkout: number;
}
