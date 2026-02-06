import { Currency } from "./index";

/**
 * GemReport V1 Types (Andromeda Schema)
 * Supports structured LLM outputs for audit reporting.
 */

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type InsightClassification = "STRUCTURE" | "CREATIVE" | "FREQUENCY" | "AUDIENCE" | "OFFER" | "TECHNICAL";
export type ActionHorizon = "IMMEDIATE" | "SHORT_TERM" | "LONG_TERM";
export type ActionType = "DO" | "DONT" | "MONITOR";

export interface GemReportMeta {
    reportId: string;
    generatedAt: string;
    period: {
        start: string;
        end: string;
        comparisonStart?: string;
        comparisonEnd?: string;
    };
    account: {
        id: string;
        currency: Currency;
        timezone: string;
    };
    model: string;
    schemaVersion: "v2";
}

export interface GemEvidenceMetric {
    label: string;
    value: number | string;
    comparisonValue?: number | string;
    delta?: number; // % change
    trend?: "up" | "down" | "neutral";
}

export interface GemAction {
    type: ActionType;
    description: string;
    horizon: ActionHorizon;
    expectedImpact?: string;
}

export interface GemInsight {
    id: string;
    title: string;
    severity: "CRITICAL" | "WARNING" | "INFO" | "SUCCESS";
    confidence: ConfidenceLevel;
    classification: InsightClassification;

    // Core content
    observation: string;

    // Algorithmic Interpretation
    interpretation: string;

    // Operational Implication (Why it matters)
    implication: string;

    // Data backing this
    evidence: {
        metrics: GemEvidenceMetric[];
        entities?: string[]; // IDs or Names
    };

    // What to do
    actions: GemAction[];

    // Guardrails / caveats
    guardrails?: string[];
}

export interface GemSection {
    id: string;
    title: string;
    summary?: string;
    insights: GemInsight[];
}

export interface GemReportV1 {
    meta: GemReportMeta;
    sections: GemSection[];
}
