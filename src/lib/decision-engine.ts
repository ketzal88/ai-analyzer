import {
    LearningState,
    IntentStage,
    FatigueState,
    StructuralState,
    FinalDecision,
    EntityClassification,
    ClientPercentiles
} from "@/types/classifications";
import { DailyEntitySnapshot, EntityRollingMetrics, ConceptRollingMetrics } from "@/types/performance-snapshots";

export class DecisionEngine {

    static compute(
        snap: DailyEntitySnapshot,
        rolling: EntityRollingMetrics,
        percentiles: ClientPercentiles,
        conceptMetrics?: ConceptRollingMetrics,
        activeAdsetsCount: number = 0,
        conversions7d: number = 0
    ): EntityClassification {

        // Layer 1: Learning State
        const learningState = this.classifyLearningState(snap);

        // Layer 2: Intent Engine
        const { score: intentScore, stage: intentStage } = this.computeIntent(snap, percentiles);

        // Layer 3: Fatigue Engine
        const fatigueState = this.classifyFatigue(rolling, conceptMetrics);

        // Layer 4: Structure Engine
        const structuralState = this.classifyStructure(snap, activeAdsetsCount, conversions7d);

        // Layer 5: Final Decision Matrix
        const { decision: finalDecision, confidence: confidenceScore, facts } = this.makeDecision(
            learningState,
            intentStage,
            fatigueState,
            structuralState,
            rolling,
            snap
        );

        // Impact Score Calculation
        const impactScore = this.calculateImpact(rolling, finalDecision);

        return {
            clientId: snap.clientId,
            level: snap.level,
            entityId: snap.entityId,
            conceptId: snap.meta.conceptId,
            updatedAt: new Date().toISOString(),
            learningState,
            intentScore,
            intentStage,
            fatigueState,
            structuralState,
            finalDecision,
            evidence: facts, // <--- Added evidence facts
            confidenceScore,
            impactScore
        };
    }

    private static classifyLearningState(snap: DailyEntitySnapshot): LearningState {
        const { daysActive, daysSinceLastEdit } = snap.stability;

        if (daysSinceLastEdit < 3) return "UNSTABLE";
        if (daysActive <= 4) return "EXPLORATION";
        if (daysActive <= 14) return "STABILIZING";
        return "EXPLOITATION";
    }

    private static computeIntent(snap: DailyEntitySnapshot, p: ClientPercentiles): { score: number, stage: IntentStage } {
        const fitr = (snap.performance.purchases || 0) / (snap.performance.clicks || 1);
        const convRate = (snap.performance.purchases || 0) / (snap.performance.impressions || 1);
        const cpaInv = snap.performance.purchases ? (snap.performance.purchases / snap.performance.spend) : 0;
        const ctr = snap.performance.ctr;

        const norm = (val: number, p10: number, p90: number) => {
            if (p90 <= p10) return 0.5;
            return Math.max(0, Math.min(1, (val - p10) / (p90 - p10)));
        };

        const fitrNorm = norm(fitr, p.fitr.p10, p.fitr.p90);
        const convRateNorm = norm(convRate, p.convRate.p10, p.convRate.p90);
        const cpaInvNorm = norm(cpaInv, p.cpaInv.p10, p.cpaInv.p90);
        const ctrNorm = norm(ctr, p.ctr.p10, p.ctr.p90);

        const score = (0.30 * fitrNorm) + (0.25 * convRateNorm) + (0.25 * cpaInvNorm) + (0.20 * ctrNorm);

        let stage: IntentStage = "TOFU";
        if (score >= 0.65) stage = "BOFU";
        else if (score >= 0.35) stage = "MOFU";

        return { score: Number(score.toFixed(4)), stage };
    }

    private static classifyFatigue(rolling: EntityRollingMetrics, concept?: ConceptRollingMetrics): FatigueState {
        const { frequency_7d, cpa_7d, cpa_14d, hook_rate_delta_pct } = rolling.rolling;

        // Entity Level
        if (frequency_7d && frequency_7d > 4) {
            const cpaWorse = cpa_14d && cpa_14d > 0 ? (cpa_7d! > cpa_14d * 1.25) : false;
            const hookDrop = (hook_rate_delta_pct || 0) < -20;

            if (cpaWorse && hookDrop) return "REAL";
            if (!cpaWorse && !hookDrop) return "HEALTHY_REPETITION";
        }

        // Concept Level
        if (concept) {
            const { avg_cpa_7d, avg_cpa_14d, hook_rate_delta } = concept.rolling;
            if (avg_cpa_7d > avg_cpa_14d * 1.25 && hook_rate_delta < -25) {
                return "CONCEPT_DECAY";
            }
        }

        return "NONE";
    }

    private static classifyStructure(snap: DailyEntitySnapshot, activeAdsets: number, conversions7d: number): StructuralState {
        if (snap.level === 'account' || snap.level === 'campaign') {
            if (conversions7d < 30 && activeAdsets > 4) return "FRAGMENTED";
        }

        // Check concentration if needed
        return "HEALTHY";
    }

    private static makeDecision(
        learning: LearningState,
        intent: IntentStage,
        fatigue: FatigueState,
        structure: StructuralState,
        rolling: EntityRollingMetrics,
        snap: DailyEntitySnapshot
    ): { decision: FinalDecision, confidence: number, facts: string[] } {
        const facts: string[] = [];

        // Collect basic facts
        const cpa7d = rolling.rolling.cpa_7d || 0;
        const spend7d = rolling.rolling.spend_7d || 0;
        const velocity7d = rolling.rolling.conversion_velocity_7d || 0;
        const roas7d = rolling.rolling.roas_7d || 0;
        const roasDelta = rolling.rolling.roas_delta_pct || 0;
        const hookDelta = rolling.rolling.hook_rate_delta_pct || 0;

        if (spend7d > 0) facts.push(`Gasto 7d: $${spend7d.toFixed(2)}`);
        if (cpa7d > 0) facts.push(`CPA 7d: $${cpa7d.toFixed(2)}`);
        if (roas7d > 0) facts.push(`ROAS 7d: ${roas7d.toFixed(2)}`);
        if (velocity7d > 0) facts.push(`Convs/día: ${velocity7d.toFixed(2)}`);
        if (Math.abs(roasDelta) > 5) facts.push(`Delta ROAS: ${roasDelta.toFixed(1)}%`);
        if (Math.abs(hookDelta) > 5) facts.push(`Delta Gancho: ${hookDelta.toFixed(1)}%`);

        if (learning === "EXPLORATION") {
            if (spend7d > 50 && velocity7d === 0) {
                facts.push("Cero conversiones con gasto significativo en fase de exploración.");
                return { decision: "KILL_RETRY", confidence: 0.8, facts };
            }
            facts.push("Activo en fase temprana de aprendizaje (0-4 días).");
            return { decision: "HOLD", confidence: 0.9, facts };
        }

        if (fatigue === "REAL") {
            facts.push("Frecuencia > 4 + CPA al alza + Tasa de Gancho a la baja.");
            return { decision: "ROTATE_CONCEPT", confidence: 0.85, facts };
        }

        if (fatigue === "CONCEPT_DECAY") {
            facts.push("CPA promedio del concepto al alza + Tasa de Gancho a la baja en escala.");
            return { decision: "ROTATE_CONCEPT", confidence: 0.85, facts };
        }

        if (structure === "FRAGMENTED") {
            facts.push("Conversiones totales < 30/semana con > 4 adsets activos.");
            return { decision: "CONSOLIDATE", confidence: 0.8, facts };
        }

        if (learning === "EXPLOITATION" && intent === "BOFU") {
            if (roas7d > 2.0) {
                facts.push("Performance alta y estable en fase de explotación.");
                return { decision: "SCALE", confidence: 0.88, facts };
            }
        }

        if (learning === "EXPLOITATION" && intent === "MOFU") {
            facts.push("Señales de intención presentes pero el volumen de conversión podría ser mayor.");
            return { decision: "INTRODUCE_BOFU_VARIANTS", confidence: 0.75, facts };
        }

        return { decision: "HOLD", confidence: 0.95, facts };
    }

    private static calculateImpact(rolling: EntityRollingMetrics, decision: FinalDecision): number {
        const spendWeight = Math.min(rolling.rolling.spend_7d! / 1000, 1) * 40; // Max 40 points for spend
        const severityWeight = (decision === "SCALE" || decision === "ROTATE_CONCEPT" || decision === "KILL_RETRY") ? 40 : 20;
        const velocityWeight = Math.min((rolling.rolling.conversion_velocity_7d || 0) / 5, 1) * 20;

        return Number((spendWeight + severityWeight + velocityWeight).toFixed(2));
    }
}
