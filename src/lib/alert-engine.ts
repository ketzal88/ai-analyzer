import { db } from "@/lib/firebase-admin";
import { EntityClassification, FinalDecision } from "@/types/classifications";
import { EntityRollingMetrics, DailyEntitySnapshot } from "@/types/performance-snapshots";
import { Client } from "@/types";
import { EngineConfigService } from "./engine-config-service";

export interface Alert {
    id: string;
    clientId: string;
    level: string;
    entityId: string;
    type: FinalDecision | "LEARNING_RESET_RISK" | "SCALING_OPPORTUNITY" | "CPA_SPIKE" | "BUDGET_BLEED" | "UNDERFUNDED_WINNER" | "CPA_VOLATILITY";
    severity: "CRITICAL" | "WARNING" | "INFO";
    title: string;
    description: string;
    impactScore: number;
    evidence: string[];
    createdAt: string;
}

export class AlertEngine {
    static async run(clientId: string) {
        const alerts: Alert[] = [];
        const today = new Date().toISOString().split("T")[0];

        // 1. Fetch all needed data
        const [classSnap, rollingSnap, clientDoc, config] = await Promise.all([
            db.collection("entity_classifications")
                .where("clientId", "==", clientId)
                .get(),
            db.collection("entity_rolling_metrics")
                .where("clientId", "==", clientId)
                .get(),
            db.collection("clients").doc(clientId).get(),
            EngineConfigService.getEngineConfig(clientId)
        ]);

        let dailySnap = await db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .where("date", "==", today)
            .get();

        if (dailySnap.empty) {
            // Fallback to latest date available
            const latestSnapRef = await db.collection("daily_entity_snapshots")
                .where("clientId", "==", clientId)
                .orderBy("date", "desc")
                .limit(1)
                .get();

            if (!latestSnapRef.empty) {
                const latestDate = latestSnapRef.docs[0].data().date;
                dailySnap = await db.collection("daily_entity_snapshots")
                    .where("clientId", "==", clientId)
                    .where("date", "==", latestDate)
                    .get();
                console.log(`AlertEngine using latest available date: ${latestDate}`);
            }
        }

        const classifications = classSnap.docs.map(d => d.data() as EntityClassification);
        const rollingMetrics = rollingSnap.docs.map(d => d.data() as EntityRollingMetrics);
        const dailySnapshots = dailySnap.docs.map(d => d.data() as DailyEntitySnapshot);
        const clientData = clientDoc.exists ? clientDoc.data() as Client : null;
        const targetCpa = clientData?.targetCpa;
        const targetRoas = clientData?.targetRoas || 2.0;

        // 2. Alert Evaluations

        for (const rolling of rollingMetrics) {
            const r = rolling.rolling;
            const snap = dailySnapshots.find(s => s.entityId === rolling.entityId && s.level === rolling.level);
            const classif = classifications.find(c => c.entityId === rolling.entityId && c.level === rolling.level);

            // ─────────────────────────────────────────────
            // 🟢 SCALING OPPORTUNITY
            // ─────────────────────────────────────────────
            const cpaMeetsTarget = targetCpa ? (r.cpa_7d || Infinity) <= targetCpa : false;
            const roas7d = r.roas_7d || 0;
            const roasMeetsTarget = roas7d >= targetRoas;
            const velocity7d = r.conversion_velocity_7d || 0;
            const velocity14d = r.conversion_velocity_14d || 0;
            const velocityStable = velocity14d > 0 ? velocity7d >= velocity14d : velocity7d > 0.5;
            const freqSafe = (r.frequency_7d || 0) < config.alerts.scalingFrequencyMax;
            const daysStable = snap ? snap.stability.daysSinceLastEdit >= 3 : true;

            if ((cpaMeetsTarget || roasMeetsTarget) && velocityStable && freqSafe && daysStable) {
                alerts.push({
                    id: `SCALING_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    type: "SCALING_OPPORTUNITY",
                    severity: "INFO",
                    title: `Oportunidad de Escala: ${rolling.entityId}`,
                    description: `Señal consolidada. CPA ${r.cpa_7d ? `$${r.cpa_7d.toFixed(2)}` : 'N/A'} (target: $${targetCpa || 'N/A'}). Velocidad estable. Frecuencia ${(r.frequency_7d || 0).toFixed(1)} OK.`,
                    impactScore: classif?.impactScore || 50,
                    evidence: [
                        `CPA 7d: $${(r.cpa_7d || 0).toFixed(2)}`,
                        `ROAS 7d: ${(r.roas_7d || 0).toFixed(2)}x`,
                        `Frecuencia: ${(r.frequency_7d || 0).toFixed(1)}`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // ─────────────────────────────────────────────
            // 🟡 LEARNING RESET RISK
            // ─────────────────────────────────────────────
            const budgetChange = r.budget_change_3d_pct || 0;
            const recentEdit = snap ? snap.stability.daysSinceLastEdit < 3 : false;

            if (Math.abs(budgetChange) > config.alerts.learningResetBudgetChangePct && recentEdit) {
                alerts.push({
                    id: `LEARNING_RESET_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    type: "LEARNING_RESET_RISK",
                    severity: "WARNING",
                    title: `Riesgo de Reinicio de Aprendizaje`,
                    description: `Cambio de budget de ${budgetChange.toFixed(0)}% (> ${config.alerts.learningResetBudgetChangePct}%) con edición reciente.`,
                    impactScore: Math.min((classif?.impactScore || 50) + 15, 100),
                    evidence: [
                        `Budget Δ 3d: ${budgetChange.toFixed(1)}%`,
                        `Edición hace < 3 días`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // ─────────────────────────────────────────────
            // 🔴 CPA SPIKE (New - from findings)
            // ─────────────────────────────────────────────
            const cpaDelta = r.cpa_delta_pct || 0;
            if (cpaDelta > (config.findings.cpaSpikeThreshold * 100)) {
                alerts.push({
                    id: `CPA_SPIKE_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    type: "CPA_SPIKE",
                    severity: "CRITICAL",
                    title: `Pico de CPA Detectado`,
                    description: `El CPA ha subido un ${cpaDelta.toFixed(0)}% en comparación con el período anterior (threshold: ${config.findings.cpaSpikeThreshold * 100}%).`,
                    impactScore: 80,
                    evidence: [
                        `CPA 7d: $${(r.cpa_7d || 0).toFixed(2)}`,
                        `CPA 14d: $${(r.cpa_14d || 0).toFixed(2)}`,
                        `Delta: ${cpaDelta.toFixed(1)}%`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // ─────────────────────────────────────────────
            // 🔴 BUDGET BLEED (New - from findings)
            // ─────────────────────────────────────────────
            const spend7d = r.spend_7d || 0;
            const purchases7d = r.purchases_7d || 0;
            if (purchases7d === 0 && targetCpa && spend7d > (targetCpa * 2)) {
                alerts.push({
                    id: `BLEED_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    type: "BUDGET_BLEED",
                    severity: "CRITICAL",
                    title: `Fuga de Presupuesto (Budget Bleed)`,
                    description: `Se han gastado $${spend7d.toFixed(2)} (> 2x Target CPA) sin registrar conversiones.`,
                    impactScore: 90,
                    evidence: [
                        `Gasto 7d: $${spend7d.toFixed(2)}`,
                        `Conversiones: 0`,
                        `Target CPA: $${targetCpa.toFixed(2)}`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // ─────────────────────────────────────────────
            // 🟢 UNDERFUNDED WINNER (New - from findings)
            // ─────────────────────────────────────────────
            if (purchases7d > 3 && targetCpa && (r.cpa_7d || 999) < (targetCpa * 0.8)) {
                // If it's a winner but spend is low relative to others at same level? 
                // Let's simplify: if CPA is 20% better than target and spend is low-ish
                if (spend7d < 500) { // arbitrary threshold for now
                    alerts.push({
                        id: `WINNER_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        type: "UNDERFUNDED_WINNER",
                        severity: "INFO",
                        title: `Ganador Infra-presupuestado`,
                        description: `CPA de $${(r.cpa_7d || 0).toFixed(2)} es un 20% mejor que el objetivo, pero el gasto es bajo ($${spend7d.toFixed(2)}).`,
                        impactScore: 60,
                        evidence: [
                            `CPA 7d: $${(r.cpa_7d || 0).toFixed(2)}`,
                            `Target CPA: $${targetCpa.toFixed(2)}`,
                            `Gasto 7d: $${spend7d.toFixed(2)}`
                        ],
                        createdAt: new Date().toISOString()
                    });
                }
            }

            // ─────────────────────────────────────────────
            // 🟡 CPA VOLATILITY (New - from findings)
            // ─────────────────────────────────────────────
            // For now approximated via large budget changes or wild delta changes
            // Real CoV would need more history, but we can flag if budget change > volatilityThreshold
            if (Math.abs(budgetChange) > (config.findings.volatilityThreshold * 100)) {
                alerts.push({
                    id: `VOLATILITY_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    type: "CPA_VOLATILITY",
                    severity: "WARNING",
                    title: `Alta Volatilidad Detectada`,
                    description: `Cambios bruscos de presupuesto (${budgetChange.toFixed(0)}%) están afectando la estabilidad del CPA.`,
                    impactScore: 40,
                    evidence: [
                        `Δ Budget 3d: ${budgetChange.toFixed(1)}%`,
                        `Threshold: ${config.findings.volatilityThreshold * 100}%`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            if (classif) {
                // ─────────────────────────────────────────────
                // 🔴 FATIGA REAL
                // ─────────────────────────────────────────────
                if (classif.fatigueState === "REAL" || classif.fatigueState === "CONCEPT_DECAY") {
                    const fatigueLabel = classif.fatigueState === "REAL" ? "Fatiga Real" : "Fatiga Conceptual";
                    alerts.push({
                        id: `FATIGUE_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        type: "ROTATE_CONCEPT",
                        severity: "CRITICAL",
                        title: `${fatigueLabel} Detectada`,
                        description: classif.fatigueState === "REAL"
                            ? `Frecuencia > ${config.fatigue.frequencyThreshold} + CPA al alza + Tasa de Gancho a la baja.`
                            : `El concepto está decayendo. CPA promedio al alza con hook rate en baja.`,
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                // ─────────────────────────────────────────────
                // 🟣 ESTRUCTURA (Fragmentación / Sobreconcentración)
                // ─────────────────────────────────────────────
                if (classif.structuralState === "FRAGMENTED") {
                    alerts.push({
                        id: `FRAG_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        type: "CONSOLIDATE",
                        severity: "WARNING",
                        title: `Estructura Fragmentada`,
                        description: `Sugerencia: consolidar adsets para mejorar el aprendizaje.`,
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.structuralState === "OVERCONCENTRATED") {
                    alerts.push({
                        id: `OVERCONC_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        type: "CONSOLIDATE",
                        severity: "WARNING",
                        title: `Sobreconcentración de Gasto`,
                        description: `Un único anuncio concentra > ${config.structure.overconcentrationPct * 100}% del gasto.`,
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                // ─────────────────────────────────────────────
                // Other decision-based alerts
                // ─────────────────────────────────────────────
                if (classif.finalDecision === "KILL_RETRY") {
                    alerts.push({
                        id: `KILL_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        type: "KILL_RETRY",
                        severity: "WARNING",
                        title: `Gasto sin Señales`,
                        description: `Fase de exploración fallida con gasto significativo.`,
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.finalDecision === "INTRODUCE_BOFU_VARIANTS") {
                    alerts.push({
                        id: `UPSELL_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        type: "INTRODUCE_BOFU_VARIANTS",
                        severity: "INFO",
                        title: `Refuerzo de Conversión (BOFU)`,
                        description: `Añade variantes con ofertas directas o escasez.`,
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        // Save alerts to Firestore (clear old + write new)
        const oldAlerts = await db.collection("alerts")
            .where("clientId", "==", clientId)
            .get();

        const batch = db.batch();
        for (const doc of oldAlerts.docs) {
            batch.delete(doc.ref);
        }
        for (const alert of alerts) {
            const docRef = db.collection("alerts").doc(alert.id);
            batch.set(docRef, alert);
        }
        await batch.commit();

        return alerts;
    }
}
