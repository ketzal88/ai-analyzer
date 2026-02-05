/**
 * Core Data Contracts for Meta Ads Diagnostic Tool
 */

export type Severity = "CRITICAL" | "WARNING" | "HEALTHY" | "INACTIVE";
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
    accountId: string;
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
    accountId: string;
    generatedAt: string;
    kpis: {
        roas: KPISummary;
        spend: KPISummary;
        cpa: KPISummary;
    };
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
    accountId: string;
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
    accountId: string;
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
