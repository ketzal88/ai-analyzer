/**
 * Semáforo Engine — Pure computation (no DB access)
 *
 * Takes quarterly objectives + accumulated actuals and produces
 * a SemaforoSnapshot with traffic lights per metric, per channel, and general.
 *
 * Follows the same pattern as AlertEngine.evaluate():
 * - All data passed as parameters
 * - No side effects
 * - Unit testable with mock data
 */

import { ChannelType } from "@/lib/channel-brain-interface";
import {
    SemaforoEvaluationInput,
    SemaforoSnapshot,
    MetricSemaforo,
    ChannelSemaforo,
    SemaforoStatus,
    QuarterProgress,
    QuarterlyObjective,
} from "@/types/semaforo";

// ── Thresholds ───────────────────────────────────────
const THRESHOLD_GREEN = 0.90;   // >= 90% of expected pacing
const THRESHOLD_YELLOW = 0.70;  // >= 70% of expected pacing

// ── Engine ───────────────────────────────────────────
export class SemaforoEngine {

    /**
     * Pure computation — no DB access.
     */
    static evaluate(input: SemaforoEvaluationInput): SemaforoSnapshot {
        const { clientId, objective, currentDate, actuals, channelActuals, weeklyHistory } = input;

        const progress = this.computeQuarterProgress(objective, currentDate);
        const metrics = this.computeMetrics(objective, actuals, progress, weeklyHistory);
        const channels = this.computeChannels(objective, channelActuals, progress);
        const general = this.computeGeneral(metrics);

        return {
            clientId,
            quarterRef: objective.quarter,
            computedAt: new Date().toISOString(),
            quarterProgress: progress,
            metrics,
            channels,
            general,
        };
    }

    // ── Quarter Progress ─────────────────────────────
    private static computeQuarterProgress(
        objective: QuarterlyObjective,
        currentDate: string
    ): QuarterProgress {
        const start = new Date(objective.startDate);
        const end = new Date(objective.endDate);
        const current = new Date(currentDate);

        const totalMs = end.getTime() - start.getTime();
        const elapsedMs = Math.max(0, Math.min(current.getTime() - start.getTime(), totalMs));

        const daysTotal = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil(elapsedMs / (1000 * 60 * 60 * 24));
        const weeksTotal = Math.ceil(daysTotal / 7);
        const weeksElapsed = Math.ceil(daysElapsed / 7);

        return {
            daysElapsed,
            daysTotal,
            pctElapsed: daysTotal > 0 ? (daysElapsed / daysTotal) * 100 : 0,
            weeksElapsed,
            weeksTotal,
            currentWeek: Math.min(weeksElapsed + 1, weeksTotal),
        };
    }

    // ── Per-Metric Semáforo ──────────────────────────
    private static computeMetrics(
        objective: QuarterlyObjective,
        actuals: Record<string, number>,
        progress: QuarterProgress,
        weeklyHistory?: Record<string, number[]>
    ): Record<string, MetricSemaforo> {
        const result: Record<string, MetricSemaforo> = {};

        for (const [metric, goal] of Object.entries(objective.goals)) {
            const current = actuals[metric] ?? 0;
            const isInverse = goal.isInverse ?? false;

            const semaforo = this.computeSingleMetric(
                metric,
                goal.target,
                goal.baseline,
                current,
                isInverse,
                progress,
                weeklyHistory?.[metric]
            );
            result[metric] = semaforo;
        }

        return result;
    }

    private static computeSingleMetric(
        metric: string,
        target: number,
        baseline: number,
        current: number,
        isInverse: boolean,
        progress: QuarterProgress,
        weeklyHistory?: number[]
    ): MetricSemaforo {
        const pctExpected = progress.pctElapsed;

        let pctAchieved: number;
        let pacingRatio: number;

        if (isInverse) {
            // For CPA-like metrics: lower is better
            // If target is 50 and current is 40, that's GOOD (achieved more than target)
            // pctAchieved = how much of the reduction we've achieved
            if (baseline === target) {
                pctAchieved = 100;
                pacingRatio = 1;
            } else {
                // Improvement = baseline - current (positive means improving)
                // Target improvement = baseline - target
                const targetImprovement = baseline - target;
                const actualImprovement = baseline - current;
                pctAchieved = targetImprovement !== 0
                    ? (actualImprovement / targetImprovement) * 100
                    : (current <= target ? 100 : 0);
                pacingRatio = pctExpected > 0 ? pctAchieved / pctExpected : (pctAchieved > 0 ? 1.5 : 0);
            }
        } else {
            // For regular metrics: higher is better
            pctAchieved = target > 0 ? (current / target) * 100 : 0;
            pacingRatio = pctExpected > 0 ? pctAchieved / pctExpected : (pctAchieved > 0 ? 1.5 : 0);
        }

        const status = this.getStatus(pacingRatio);

        // Weekly rate calculation
        const weeksElapsed = Math.max(progress.weeksElapsed, 1);
        const weeksRemaining = Math.max(progress.weeksTotal - progress.weeksElapsed, 1);
        const weeklyRate = current / weeksElapsed;

        let requiredWeeklyRate: number;
        if (isInverse) {
            // For CPA: what weekly CPA we need to maintain
            requiredWeeklyRate = target; // Just need to stay at or below target CPA
        } else {
            const remaining = Math.max(target - current, 0);
            requiredWeeklyRate = remaining / weeksRemaining;
        }

        // Projection
        let projectedEnd: number;
        if (isInverse) {
            projectedEnd = current; // CPA projection = current CPA (simplified)
        } else {
            projectedEnd = current + weeklyRate * weeksRemaining;
        }

        // Trend detection
        const trend = this.detectTrend(weeklyHistory);

        return {
            metric,
            target,
            baseline,
            current,
            isInverse,
            pctAchieved: Math.round(pctAchieved * 10) / 10,
            pctExpected: Math.round(pctExpected * 10) / 10,
            pacingRatio: Math.round(pacingRatio * 100) / 100,
            status,
            weeklyRate: Math.round(weeklyRate * 100) / 100,
            requiredWeeklyRate: Math.round(requiredWeeklyRate * 100) / 100,
            projectedEnd: Math.round(projectedEnd * 100) / 100,
            trend,
        };
    }

    // ── Per-Channel Semáforo ─────────────────────────
    private static computeChannels(
        objective: QuarterlyObjective,
        channelActuals: Partial<Record<ChannelType, Record<string, number>>>,
        progress: QuarterProgress
    ): Partial<Record<ChannelType, ChannelSemaforo>> {
        if (!objective.channelGoals) return {};

        const result: Partial<Record<ChannelType, ChannelSemaforo>> = {};

        for (const [channel, goals] of Object.entries(objective.channelGoals)) {
            const channelType = channel as ChannelType;
            const actuals = channelActuals[channelType] || {};
            const metrics: Record<string, MetricSemaforo> = {};

            for (const [metric, goal] of Object.entries(goals)) {
                const mainGoal = objective.goals[metric];
                const isInverse = mainGoal?.isInverse ?? false;
                const baseline = mainGoal?.baseline ?? 0;

                metrics[metric] = this.computeSingleMetric(
                    metric,
                    goal.target,
                    baseline,
                    actuals[metric] ?? 0,
                    isInverse,
                    progress
                );
            }

            // Channel status = worst metric status
            const metricStatuses = Object.values(metrics).map(m => m.status);
            const channelStatus = this.worstStatus(metricStatuses);

            result[channelType] = {
                channel: channelType,
                status: channelStatus,
                metrics,
            };
        }

        return result;
    }

    // ── General Semáforo ─────────────────────────────
    private static computeGeneral(
        metrics: Record<string, MetricSemaforo>
    ): { status: SemaforoStatus; score: number; summary: string } {
        const metricValues = Object.values(metrics);
        if (metricValues.length === 0) {
            return { status: 'green', score: 100, summary: 'Sin objetivos definidos' };
        }

        // Score: average of all pacing ratios (capped at 1.0 for scoring)
        const avgPacing = metricValues.reduce((sum, m) => sum + Math.min(m.pacingRatio, 1.5), 0) / metricValues.length;
        const score = Math.round(Math.min(avgPacing * 100, 100));

        // Status: if any RED → general is at most YELLOW
        const hasRed = metricValues.some(m => m.status === 'red');
        const hasYellow = metricValues.some(m => m.status === 'yellow');
        const allGreen = metricValues.every(m => m.status === 'green');

        let status: SemaforoStatus;
        if (allGreen) {
            status = 'green';
        } else if (hasRed) {
            status = metricValues.filter(m => m.status === 'red').length >= metricValues.length / 2
                ? 'red'
                : 'yellow';
        } else {
            status = 'yellow';
        }

        // Summary
        const greenCount = metricValues.filter(m => m.status === 'green').length;
        const yellowCount = metricValues.filter(m => m.status === 'yellow').length;
        const redCount = metricValues.filter(m => m.status === 'red').length;

        let summary: string;
        if (allGreen) {
            summary = `Todos los objetivos en ritmo (${metricValues.length}/${metricValues.length})`;
        } else if (redCount > 0) {
            const worstMetric = metricValues.reduce((worst, m) => m.pacingRatio < worst.pacingRatio ? m : worst);
            summary = `${redCount} objetivo(s) en riesgo. Peor: ${worstMetric.metric} (${worstMetric.pctAchieved.toFixed(0)}% vs ${worstMetric.pctExpected.toFixed(0)}% esperado)`;
        } else {
            summary = `${greenCount} en ritmo, ${yellowCount} requieren atención`;
        }

        return { status, score, summary };
    }

    // ── Helpers ──────────────────────────────────────
    private static getStatus(pacingRatio: number): SemaforoStatus {
        if (pacingRatio >= THRESHOLD_GREEN) return 'green';
        if (pacingRatio >= THRESHOLD_YELLOW) return 'yellow';
        return 'red';
    }

    private static worstStatus(statuses: SemaforoStatus[]): SemaforoStatus {
        if (statuses.includes('red')) return 'red';
        if (statuses.includes('yellow')) return 'yellow';
        return 'green';
    }

    private static detectTrend(weeklyHistory?: number[]): 'accelerating' | 'steady' | 'decelerating' {
        if (!weeklyHistory || weeklyHistory.length < 3) return 'steady';

        const recent = weeklyHistory.slice(-3);
        const diffs = [recent[1] - recent[0], recent[2] - recent[1]];

        if (diffs[1] > diffs[0] * 1.1) return 'accelerating';
        if (diffs[1] < diffs[0] * 0.9) return 'decelerating';
        return 'steady';
    }
}
