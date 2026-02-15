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
import { EngineConfig } from "@/types/engine-config";

export interface ClientTargets {
    targetCpa?: number;
    targetRoas?: number;
    primaryGoal?: "scale" | "efficiency" | "stability";
}

export class DecisionEngine {

    static compute(
        snap: DailyEntitySnapshot,
        rolling: EntityRollingMetrics,
        percentiles: ClientPercentiles,
        config: EngineConfig, // Added config
        conceptMetrics?: ConceptRollingMetrics,
        activeAdsetsCount: number = 0,
        conversions7d: number = 0,
        clientTargets?: ClientTargets
    ): EntityClassification {

        // Layer 1: Learning State
        const learningState = this.classifyLearningState(snap);

        // Layer 2: Intent Engine
        const { score: intentScore, stage: intentStage } = this.computeIntent(snap, percentiles);

        // Layer 3: Fatigue Engine (now with concentration check)
        const fatigueState = this.classifyFatigue(rolling, config, conceptMetrics);

        // Layer 4: Structure Engine
        const structuralState = this.classifyStructure(snap, activeAdsetsCount, conversions7d, rolling, config);

        // Layer 5: Final Decision Matrix (now with client targets)
        const { decision: finalDecision, confidence: confidenceScore, facts } = this.makeDecision(
            learningState,
            intentStage,
            fatigueState,
            structuralState,
            rolling,
            snap,
            config,
            clientTargets
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
            evidence: facts,
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

    private static classifyFatigue(
        rolling: EntityRollingMetrics,
        config: EngineConfig,
        concept?: ConceptRollingMetrics
    ): FatigueState {
        const { frequency_7d, cpa_7d, cpa_14d, hook_rate_delta_pct, spend_top1_ad_pct } = rolling.rolling;
        const f = config.fatigue;

        // Entity Level
        if (frequency_7d && frequency_7d > f.frequencyThreshold) {
            const cpaWorse = cpa_14d && cpa_14d > 0 ? (cpa_7d! > cpa_14d * f.cpaMultiplierThreshold) : false;
            const hookDrop = (hook_rate_delta_pct || 0) < (f.hookRateDeltaThreshold * 100);
            const highConcentration = (spend_top1_ad_pct || 0) > f.concentrationThreshold;

            if (cpaWorse && hookDrop && highConcentration) return "REAL";
            if (!cpaWorse && !hookDrop) return "HEALTHY_REPETITION";
        }

        // Concept Level
        if (concept) {
            const { avg_cpa_7d, avg_cpa_14d, hook_rate_delta } = concept.rolling;
            if (avg_cpa_7d > avg_cpa_14d * f.cpaMultiplierThreshold && hook_rate_delta < f.hookRateDeltaThreshold) {
                return "CONCEPT_DECAY";
            }
        }

        return "NONE";
    }

    private static classifyStructure(
        snap: DailyEntitySnapshot,
        activeAdsets: number,
        conversions7d: number,
        rolling: EntityRollingMetrics,
        config: EngineConfig
    ): StructuralState {
        const s = config.structure;
        if (snap.level === 'account' || snap.level === 'campaign') {
            if (conversions7d < 30 && activeAdsets > s.fragmentationAdsetsMax) return "FRAGMENTED";
        }

        const spendTop1 = rolling.rolling.spend_top1_ad_pct || 0;
        if (spendTop1 > s.overconcentrationPct && (rolling.rolling.spend_7d || 0) > s.overconcentrationMinSpend) {
            return "OVERCONCENTRATED";
        }

        return "HEALTHY";
    }

    private static makeDecision(
        learning: LearningState,
        intent: IntentStage,
        fatigue: FatigueState,
        structure: StructuralState,
        rolling: EntityRollingMetrics,
        snap: DailyEntitySnapshot,
        config: EngineConfig,
        clientTargets?: ClientTargets
    ): { decision: FinalDecision, confidence: number, facts: string[] } {
        const facts: string[] = [];

        // Collect basic facts
        const cpa7d = rolling.rolling.cpa_7d || 0;
        const spend7d = rolling.rolling.spend_7d || 0;
        const velocity7d = rolling.rolling.conversion_velocity_7d || 0;
        const velocity14d = rolling.rolling.conversion_velocity_14d || 0;
        const roas7d = rolling.rolling.roas_7d || 0;
        const roasDelta = rolling.rolling.roas_delta_pct || 0;
        const hookDelta = rolling.rolling.hook_rate_delta_pct || 0;
        const freq7d = rolling.rolling.frequency_7d || 0;
        const budgetChange = rolling.rolling.budget_change_3d_pct || 0;

        if (spend7d > 0) facts.push(`Gasto 7d: $${spend7d.toFixed(2)}`);
        if (cpa7d > 0) facts.push(`CPA 7d: $${cpa7d.toFixed(2)}`);
        if (roas7d > 0) facts.push(`ROAS 7d: ${roas7d.toFixed(2)}`);
        if (velocity7d > 0) facts.push(`Convs/día: ${velocity7d.toFixed(2)}`);
        if (freq7d > 0) facts.push(`Frecuencia 7d: ${freq7d.toFixed(1)}`);
        if (Math.abs(roasDelta) > 5) facts.push(`Delta ROAS: ${roasDelta.toFixed(1)}%`);
        if (Math.abs(hookDelta) > 5) facts.push(`Delta Gancho: ${hookDelta.toFixed(1)}%`);
        if (Math.abs(budgetChange) > 10) facts.push(`Δ Budget 3d: ${budgetChange.toFixed(1)}%`);

        const targetCpa = clientTargets?.targetCpa;
        const targetRoas = clientTargets?.targetRoas || 2.0;

        if (learning === "EXPLORATION") {
            if (spend7d > 50 && velocity7d === 0) {
                facts.push("Cero conversiones con gasto significativo en fase de exploración.");
                return { decision: "KILL_RETRY", confidence: 0.8, facts };
            }
            facts.push("Activo en fase temprana de aprendizaje (0-4 días).");
            return { decision: "HOLD", confidence: 0.9, facts };
        }

        if (learning === "UNSTABLE") {
            if (budgetChange > config.alerts.learningResetBudgetChangePct) {
                facts.push(`Edición reciente con cambio de budget > ${config.alerts.learningResetBudgetChangePct}%. Riesgo de reinicio de aprendizaje.`);
            }
            facts.push("Entidad editada recientemente (< 3 días). En período de re-estabilización.");
            return { decision: "HOLD", confidence: 0.85, facts };
        }

        if (fatigue === "REAL") {
            facts.push(`Frecuencia > ${config.fatigue.frequencyThreshold} + CPA al alza + Tasa de Gancho a la baja + Concentración > ${config.fatigue.concentrationThreshold * 100}%.`);
            return { decision: "ROTATE_CONCEPT", confidence: 0.85, facts };
        }

        if (fatigue === "CONCEPT_DECAY") {
            facts.push("CPA promedio del concepto al alza + Tasa de Gancho a la baja en escala.");
            return { decision: "ROTATE_CONCEPT", confidence: 0.85, facts };
        }

        if (structure === "FRAGMENTED") {
            facts.push(`Conversiones totales < 30/semana con > ${config.structure.fragmentationAdsetsMax} adsets activos.`);
            return { decision: "CONSOLIDATE", confidence: 0.8, facts };
        }

        if (structure === "OVERCONCENTRATED") {
            facts.push(`Un único ad concentra > ${config.structure.overconcentrationPct * 100}% del gasto total. Riesgo de dependencia.`);
            return { decision: "CONSOLIDATE", confidence: 0.7, facts };
        }

        // SCALE decision now uses client targets
        if (learning === "EXPLOITATION" && intent === "BOFU") {
            const cpaMeetTarget = targetCpa ? cpa7d <= targetCpa : true;
            const roasMeetTarget = roas7d >= targetRoas;
            const velocityStable = velocity14d > 0 ? velocity7d >= velocity14d : velocity7d > 0;
            const daysStable = snap.stability.daysSinceLastEdit >= 3;

            if ((cpaMeetTarget || roasMeetTarget) && velocityStable && freq7d < config.alerts.scalingFrequencyMax && daysStable) {
                facts.push(`Performance alta y estable en fase de explotación.`);
                if (targetCpa) facts.push(`CPA ($${cpa7d.toFixed(2)}) dentro del target ($${targetCpa}).`);
                if (roasMeetTarget) facts.push(`ROAS (${roas7d.toFixed(2)}x) supera objetivo (${targetRoas}x).`);
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
