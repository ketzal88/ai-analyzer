export type LearningState = 'EXPLORATION' | 'STABILIZING' | 'EXPLOITATION' | 'UNSTABLE';
export type IntentStage = 'TOFU' | 'MOFU' | 'BOFU';
export type FatigueState = 'REAL' | 'HEALTHY_REPETITION' | 'CONCEPT_DECAY' | 'NONE';
export type StructuralState = 'FRAGMENTED' | 'OVERCONCENTRATED' | 'HEALTHY';
export type FinalDecision = 'HOLD' | 'ROTATE_CONCEPT' | 'CONSOLIDATE' | 'SCALE' | 'INTRODUCE_BOFU_VARIANTS' | 'KILL_RETRY';

export interface EntityClassification {
    clientId: string;
    level: 'account' | 'campaign' | 'adset' | 'ad';
    entityId: string;
    conceptId?: string;
    updatedAt: string;

    // Layer 1: Learning
    learningState: LearningState;

    // Layer 2: Intent
    intentScore: number;
    intentStage: IntentStage;

    // Layer 3: Fatigue
    fatigueState: FatigueState;

    // Layer 4: Structure
    structuralState: StructuralState;

    // Layer 5: Decision
    finalDecision: FinalDecision;
    evidence: string[];
    confidenceScore: number;
    impactScore: number;
}

export interface ClientPercentiles {
    fitr: { p10: number; p90: number };
    convRate: { p10: number; p90: number };
    cpaInv: { p10: number; p90: number };
    ctr: { p10: number; p90: number };
}
