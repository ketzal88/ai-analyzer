import { db } from "@/lib/firebase-admin";
import { Alert, Client } from "@/types";
import { EntityRollingMetrics, DailyEntitySnapshot } from "@/types/performance-snapshots";
import { EntityClassification } from "@/types/classifications";
import { EngineConfigService } from "@/lib/engine-config-service";
import { getDefaultEngineConfig } from "@/types/engine-config";

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
                console.log(`[AlertEngine] Today's data not available yet, using latest: ${latestDate}`);
            }
        }

        const classifications = classSnap.docs.map(d => d.data() as EntityClassification);
        const rollingMetrics = rollingSnap.docs.map(d => d.data() as EntityRollingMetrics);
        const dailySnapshots = dailySnap.docs.map(d => d.data() as DailyEntitySnapshot);
        const clientData = clientDoc.exists ? clientDoc.data() as Client : null;
        const isEcommerce = clientData?.isEcommerce ?? true;

        // 2. Helper: Build a name map for all levels for easy lookup
        const nameMap: Record<string, string> = {};
        for (const rm of rollingMetrics) {
            if (rm.name) nameMap[rm.entityId] = rm.name;
        }

        // 3. Helper: Format with templates
        const formatMessage = (template: string, vars: Record<string, string | number>) => {
            let msg = template;
            for (const [k, v] of Object.entries(vars)) {
                msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
            return msg;
        };

        // 4. Alert Evaluations
        for (const rolling of rollingMetrics) {
            const r = rolling.rolling;
            const snap = dailySnapshots.find(s => s.entityId === rolling.entityId && s.level === rolling.level);
            const classif = classifications.find(c => c.entityId === rolling.entityId && c.level === rolling.level);

            const entityName = rolling.name || rolling.entityId;
            const contextName = rolling.level === 'ad' && snap?.meta.adsetId && snap?.meta.campaignId
                ? `${nameMap[snap.meta.campaignId] || 'Camp.'} > ${nameMap[snap.meta.adsetId] || 'Set'} > ${entityName}`
                : rolling.level === 'adset' && snap?.meta.campaignId
                    ? `${nameMap[snap.meta.campaignId] || 'Camp.'} > ${entityName}`
                    : entityName;

            // Metrics normalization based on business model
            const spend_7d = r.spend_7d || 0;
            const businessType = config.businessType || 'ecommerce';

            let primaryMetric = 0;
            let metricName = "Conv.";

            if (businessType === 'ecommerce') {
                primaryMetric = r.purchases_7d || 0;
                metricName = "Ventas";
            } else if (businessType === 'leads') {
                primaryMetric = r.leads_7d || 0;
                metricName = "Leads";
            } else if (businessType === 'whatsapp') {
                primaryMetric = r.whatsapp_7d || 0;
                metricName = "Conversaciones";
            } else if (businessType === 'apps') {
                primaryMetric = r.installs_7d || 0;
                metricName = "App Installs";
            }

            const isEcommerce = businessType === 'ecommerce';
            const primaryCpa = primaryMetric > 0 ? (spend_7d / primaryMetric) : undefined;
            const targetCpa = clientData?.targetCpa;
            const targetRoas = clientData?.targetRoas || 2.0;

            const commonVars = {
                entityName: contextName,
                spend_7d: `$${spend_7d.toFixed(2)}`, // Used spend_7d variable
                cpa_7d: primaryCpa ? `$${primaryCpa.toFixed(2)}` : 'N/A',
                targetCpa: targetCpa ? `$${targetCpa.toFixed(2)}` : 'N/A',
                frequency_7d: (r.frequency_7d || 0).toFixed(1),
                budget_change_3d_pct: (r.budget_change_3d_pct || 0).toFixed(0),
                cpa_delta_pct: (r.cpa_delta_pct || 0).toFixed(0)
            };

            // ─────────────────────────────────────────────
            // 🟢 SCALING OPPORTUNITY
            // ─────────────────────────────────────────────
            const cpaMeetsTarget = targetCpa ? (primaryCpa || Infinity) <= targetCpa : false;
            const roasMeetsTarget = isEcommerce ? (r.roas_7d || 0) >= targetRoas : true; // Always true for leads if CPA is OK
            const velocity7d = isEcommerce ? (r.conversion_velocity_7d || 0) : (primaryMetric / 7);
            const velocityStable = velocity7d > 0.5; // Simplified
            const freqSafe = (r.frequency_7d || 0) < config.alerts.scalingFrequencyMax;
            const daysStable = snap ? snap.stability.daysSinceLastEdit >= 3 : true;

            if ((cpaMeetsTarget || (isEcommerce && roasMeetsTarget)) && velocityStable && freqSafe && daysStable) {
                const type = "SCALING_OPPORTUNITY";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `SCALING_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    entityName: contextName,
                    type,
                    severity: "INFO",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: classif?.impactScore || 50,
                    evidence: [
                        `${isEcommerce ? 'CPA' : `Coste/${metricName}`} 7d: ${commonVars.cpa_7d}`,
                        isEcommerce ? `ROAS 7d: ${(r.roas_7d || 0).toFixed(2)}x` : `Volumen 7d: ${primaryMetric}`,
                        `Frecuencia: ${commonVars.frequency_7d}`
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
                const type = "LEARNING_RESET_RISK";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `LEARNING_RESET_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    entityName: contextName,
                    type,
                    severity: "WARNING",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, { ...commonVars, threshold_pct: config.alerts.learningResetBudgetChangePct }),
                    impactScore: Math.min((classif?.impactScore || 50) + 15, 100),
                    evidence: [
                        `Budget Δ 3d: ${budgetChange.toFixed(1)}%`,
                        `Edición hace < 3 días`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // ─────────────────────────────────────────────
            // 🔴 CPA SPIKE
            // ─────────────────────────────────────────────
            const cpaDelta = r.cpa_delta_pct || 0;
            if (cpaDelta > (config.findings.cpaSpikeThreshold * 100)) {
                const type = "CPA_SPIKE";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `CPA_SPIKE_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    entityName: contextName,
                    type,
                    severity: "CRITICAL",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 80,
                    evidence: [
                        `CPA 7d: ${commonVars.cpa_7d}`,
                        `CPA 14d: $${(r.cpa_14d || 0).toFixed(2)}`,
                        `Delta: ${cpaDelta.toFixed(1)}%`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // ─────────────────────────────────────────────
            // 🔴 BUDGET BLEED
            // ─────────────────────────────────────────────
            if (primaryMetric === 0 && targetCpa && spend_7d > (targetCpa * 2)) { // Used spend_7d variable
                const type = "BUDGET_BLEED";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `BLEED_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    entityName: contextName,
                    type,
                    severity: "CRITICAL",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 90,
                    evidence: [
                        `Gasto 7d: ${commonVars.spend_7d}`,
                        `Conversiones: 0`,
                        `Target CPA: ${commonVars.targetCpa}`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // ─────────────────────────────────────────────
            // 🟡 CPA VOLATILITY
            // ─────────────────────────────────────────────
            if (Math.abs(budgetChange) > (config.findings.volatilityThreshold * 100)) {
                const type = "CPA_VOLATILITY";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `VOLATILITY_${rolling.entityId}_${Date.now()}`,
                    clientId,
                    level: rolling.level,
                    entityId: rolling.entityId,
                    entityName: contextName,
                    type,
                    severity: "WARNING",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
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
                if (classif.fatigueState === "REAL" || classif.fatigueState === "CONCEPT_DECAY" || classif.fatigueState === "AUDIENCE_SATURATION") {
                    const type = "ROTATE_CONCEPT";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    // Added type guard for fatigueLabel index
                    const fatigueLabels: Record<string, string> = {
                        REAL: "Fatiga Real",
                        CONCEPT_DECAY: "Decaimiento Conceptual",
                        AUDIENCE_SATURATION: "Saturación de Audiencia",
                        HEALTHY_REPETITION: "Repetición Saludable",
                        NONE: "Ninguna"
                    };
                    const fatigueLabel = fatigueLabels[classif.fatigueState] || "Fatiga";

                    alerts.push({
                        id: `FATIGUE_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        entityName: contextName,
                        type,
                        severity: "CRITICAL",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, {
                            ...commonVars,
                            fatigueLabel,
                            hook_rate_7d: `${(r.hook_rate_7d || 0).toFixed(2)}%`
                        }),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                // ─────────────────────────────────────────────
                // 🟣 ESTRUCTURA
                // ─────────────────────────────────────────────
                if (classif.structuralState === "FRAGMENTED" || classif.structuralState === "OVERCONCENTRATED") {
                    const type = "CONSOLIDATE";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    alerts.push({
                        id: `STRUCT_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        entityName: contextName,
                        type,
                        severity: "WARNING",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, {
                            ...commonVars,
                            structuralState: classif.structuralState === "FRAGMENTED" ? "Fragmentada" : "Sobreconcentrada"
                        }),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.finalDecision === "KILL_RETRY") {
                    const type = "KILL_RETRY";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    alerts.push({
                        id: `KILL_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        entityName: contextName,
                        type,
                        severity: "WARNING",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, commonVars),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.finalDecision === "INTRODUCE_BOFU_VARIANTS") {
                    const type = "INTRODUCE_BOFU_VARIANTS";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    alerts.push({
                        id: `UPSELL_${rolling.entityId}_${Date.now()}`,
                        clientId,
                        level: rolling.level,
                        entityId: rolling.entityId,
                        entityName: contextName,
                        type,
                        severity: "INFO",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, commonVars),
                        impactScore: classif.impactScore,
                        evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        // 5. Final Filter: Only keep enabled alerts
        const activeAlertIds = config.enabledAlerts || Object.keys(config.alertTemplates);
        const filteredAlerts = alerts.filter(a => activeAlertIds.includes(a.type));

        // Save alerts to Firestore (clear old + write new)
        const oldAlerts = await db.collection("alerts")
            .where("clientId", "==", clientId)
            .get();

        const batch = db.batch();
        for (const doc of oldAlerts.docs) {
            batch.delete(doc.ref);
        }
        for (const alert of filteredAlerts) {
            const docRef = db.collection("alerts").doc(alert.id);
            batch.set(docRef, alert);
        }
        await batch.commit();

        return filteredAlerts;
    }
}
