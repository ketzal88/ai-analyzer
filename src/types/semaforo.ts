/**
 * Semáforo Types — Quarterly goal pacing system
 *
 * The Semáforo tracks quarterly business objectives against actual performance,
 * providing traffic light indicators (green/yellow/red) per metric, per channel,
 * and a general overview.
 */

import { ChannelType } from "@/lib/channel-brain-interface";

// ── Core Status ──────────────────────────────────────
export type SemaforoStatus = 'green' | 'yellow' | 'red';

// ── Quarterly Objectives ─────────────────────────────
/**
 * Firestore: quarterly_objectives/{clientId__Q{N}_{YYYY}}
 */
export interface QuarterlyObjective {
    clientId: string;
    quarter: string;            // "Q2_2026"
    year: number;
    quarterNumber: 1 | 2 | 3 | 4;
    startDate: string;          // "2026-04-01"
    endDate: string;            // "2026-06-30"

    /**
     * Business goals per metric.
     * Key = metric name (orders, revenue, leads, cpa, roas, email_opens, etc.)
     * baseline = starting point (e.g., 100 orders/quarter before)
     * target = desired end state (e.g., 200 orders/quarter)
     * isInverse = true for metrics where lower is better (CPA)
     */
    goals: Record<string, MetricGoal>;

    /** Optional per-channel sub-goals */
    channelGoals?: Partial<Record<ChannelType, Record<string, { target: number }>>>;

    /** How to distribute weekly targets */
    weeklyPacing: {
        mode: 'linear' | 'accelerating' | 'custom';
        customWeeklyTargets?: Record<string, number[]>; // metric -> [week1Target, week2Target, ...]
    };

    createdAt: string;
    updatedAt: string;
}

export interface MetricGoal {
    target: number;
    baseline: number;
    isInverse?: boolean; // true for CPA-like metrics (lower is better)
}

// ── Semáforo Snapshot ────────────────────────────────
/**
 * Firestore: semaforo_snapshots/{clientId}
 * Single doc per client, overwritten daily by cron.
 */
export interface SemaforoSnapshot {
    clientId: string;
    quarterRef: string;         // "Q2_2026"
    computedAt: string;

    quarterProgress: QuarterProgress;
    metrics: Record<string, MetricSemaforo>;
    channels: Partial<Record<ChannelType, ChannelSemaforo>>;
    general: GeneralSemaforo;
}

export interface QuarterProgress {
    daysElapsed: number;
    daysTotal: number;
    pctElapsed: number;         // 0-100
    weeksElapsed: number;
    weeksTotal: number;
    currentWeek: number;        // 1-13
}

export interface MetricSemaforo {
    metric: string;
    target: number;
    baseline: number;
    current: number;
    isInverse: boolean;
    pctAchieved: number;        // current / target * 100 (or inverse for CPA)
    pctExpected: number;        // expected based on time elapsed
    pacingRatio: number;        // pctAchieved / pctExpected
    status: SemaforoStatus;
    weeklyRate: number;         // current weekly run rate
    requiredWeeklyRate: number; // needed to hit target
    projectedEnd: number;       // linear projection at current rate
    trend: 'accelerating' | 'steady' | 'decelerating';
}

export interface ChannelSemaforo {
    channel: ChannelType;
    status: SemaforoStatus;
    metrics: Record<string, MetricSemaforo>;
    dataFreshness?: string;     // ISO date of last sync
}

export interface GeneralSemaforo {
    status: SemaforoStatus;
    score: number;              // 0-100
    summary: string;            // Human-readable summary
}

// ── Engine Input ─────────────────────────────────────
export interface SemaforoEvaluationInput {
    clientId: string;
    objective: QuarterlyObjective;
    currentDate: string;        // YYYY-MM-DD

    /** Accumulated actuals per metric from quarter start to currentDate */
    actuals: Record<string, number>;

    /** Per-channel accumulated actuals */
    channelActuals: Partial<Record<ChannelType, Record<string, number>>>;

    /** Weekly history for trend detection: metric -> [week1Value, week2Value, ...] */
    weeklyHistory?: Record<string, number[]>;
}

// ── Helpers ──────────────────────────────────────────
export function buildObjectiveId(clientId: string, quarter: string): string {
    return `${clientId}__${quarter}`;
}

export function getCurrentQuarter(date: Date = new Date()): { quarter: string; number: 1 | 2 | 3 | 4; year: number; startDate: string; endDate: string } {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const qNum = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
    const startMonth = (qNum - 1) * 3;
    const endMonth = startMonth + 2;
    const startDate = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, endMonth + 1, 0).getDate();
    const endDate = `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    return {
        quarter: `Q${qNum}_${year}`,
        number: qNum,
        year,
        startDate,
        endDate,
    };
}
