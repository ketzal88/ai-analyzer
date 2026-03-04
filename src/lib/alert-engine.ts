import { db } from "@/lib/firebase-admin";
import { Alert, Client } from "@/types";
import { EntityRollingMetrics, DailyEntitySnapshot } from "@/types/performance-snapshots";
import { EntityClassification } from "@/types/classifications";
import { EngineConfigService } from "@/lib/engine-config-service";
import { getDefaultEngineConfig } from "@/types/engine-config";
import { SystemSettingsService } from "@/lib/system-settings-service";
import {
    resolveObjective,
    getPrimaryMetric,
    getPrimaryMetricValue,
    isCpaRelevant,
    isRoasRelevant,
    businessTypeToObjective,
    type CampaignObjectiveType
} from "@/lib/objective-utils";
import type { EngineConfig } from "@/types/engine-config";

export type AlertChannel = 'slack_immediate' | 'slack_weekly' | 'panel_only';

export function getAlertChannel(alert: Alert): AlertChannel {
    if (alert.severity === 'CRITICAL') return 'slack_immediate';
    if (alert.type === 'SCALING_OPPORTUNITY') return 'slack_immediate';
    if (alert.severity === 'WARNING') return 'slack_weekly';
    return 'panel_only';
}

export interface AlertEvaluationInput {
    clientId: string;
    rollingMetrics: EntityRollingMetrics[];
    classifications: EntityClassification[];
    dailySnapshots: DailyEntitySnapshot[];
    clientData: Client | null;
    config: EngineConfig;
    enabledAlertTypes?: string[];
}

export class AlertEngine {
    /**
     * Pure computation: evaluate alerts from pre-fetched data.
     * No DB access — usable from both AlertEngine.run() and ClientSnapshotService.
     */
    static evaluate(input: AlertEvaluationInput): Alert[] {
        const { clientId, rollingMetrics, classifications, dailySnapshots, clientData, config, enabledAlertTypes } = input;
        const alerts: Alert[] = [];

        const nameMap: Record<string, string> = {};
        for (const rm of rollingMetrics) {
            if (rm.name) nameMap[rm.entityId] = rm.name;
        }
        for (const s of dailySnapshots) {
            if (!nameMap[s.entityId] && s.name) nameMap[s.entityId] = s.name;
        }

        const formatMessage = (template: string, vars: Record<string, string | number>) => {
            let msg = template;
            for (const [k, v] of Object.entries(vars)) {
                msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
            return msg;
        };

        for (const rolling of rollingMetrics) {
            if (rolling.level === 'campaign' || rolling.level === 'account') continue;

            const r = rolling.rolling;
            const snap = dailySnapshots.find(s => s.entityId === rolling.entityId && s.level === rolling.level);
            const classif = classifications.find(c => c.entityId === rolling.entityId && c.level === rolling.level);

            const entityName = rolling.name || rolling.entityId;
            const contextName = rolling.level === 'ad' && snap?.meta.adsetId && snap?.meta.campaignId
                ? `${nameMap[snap.meta.campaignId] || 'Camp.'} > ${nameMap[snap.meta.adsetId] || 'Set'} > ${entityName}`
                : rolling.level === 'adset' && snap?.meta.campaignId
                    ? `${nameMap[snap.meta.campaignId] || 'Camp.'} > ${entityName}`
                    : entityName;

            const spend_7d = r.spend_7d || 0;
            const businessType = config.businessType || 'ecommerce';
            const metaObjective = snap?.meta?.objective;
            const fallbackObjective = businessTypeToObjective(businessType);
            const resolvedObj: CampaignObjectiveType = resolveObjective(metaObjective, entityName) || fallbackObjective;
            const metricInfo = getPrimaryMetric(resolvedObj);

            const primaryMetric = getPrimaryMetricValue(r, resolvedObj);
            const metricName = metricInfo.labelEs;

            const isEcom = resolvedObj === 'sales';
            const primaryCpa = primaryMetric > 0 ? (spend_7d / primaryMetric) : undefined;
            const targetCpa = clientData?.targetCpa;
            const targetRoas = clientData?.targetRoas || 2.0;

            const commonVars = {
                entityName: contextName,
                spend_7d: `$${spend_7d.toFixed(2)}`,
                cpa_7d: primaryCpa ? `$${primaryCpa.toFixed(2)}` : 'N/A',
                targetCpa: targetCpa ? `$${targetCpa.toFixed(2)}` : 'N/A',
                frequency_7d: (r.frequency_7d || 0).toFixed(1),
                budget_change_3d_pct: (r.budget_change_3d_pct || 0).toFixed(0),
                cpa_delta_pct: (r.cpa_delta_pct || 0).toFixed(0)
            };

            // SCALING OPPORTUNITY
            const cpaMeetsTarget = targetCpa ? (primaryCpa || Infinity) <= targetCpa : false;
            const roasMeetsTarget = isEcom ? (r.roas_7d || 0) >= targetRoas : true;
            const velocity7d = isEcom ? (r.conversion_velocity_7d || 0) : (primaryMetric / 7);
            const velocityStable = velocity7d > (config.alerts.velocityMinForScaling ?? 0.5);
            const freqSafe = (r.frequency_7d || 0) < config.alerts.scalingFrequencyMax;
            const daysStable = snap ? snap.stability.daysSinceLastEdit >= (config.alerts.scalingStableDays ?? 3) : true;

            if ((cpaMeetsTarget || (isEcom && roasMeetsTarget)) && velocityStable && freqSafe && daysStable) {
                const type = "SCALING_OPPORTUNITY";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `SCALING_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "INFO",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: classif?.impactScore || 50,
                    evidence: [
                        `${isEcom ? 'CPA' : `Coste/${metricName}`} 7d: ${commonVars.cpa_7d}`,
                        isEcom ? `ROAS 7d: ${(r.roas_7d || 0).toFixed(2)}x` : `Volumen 7d: ${primaryMetric}`,
                        `Frecuencia: ${commonVars.frequency_7d}`
                    ],
                    createdAt: new Date().toISOString()
                });
            }

            // LEARNING RESET RISK
            const budgetChange = r.budget_change_3d_pct || 0;
            const recentEdit = snap ? snap.stability.daysSinceLastEdit < 3 : false;
            const hasMinSpend = (r.spend_7d || 0) > (config.alerts.minSpendForAlerts ?? 10);

            if (Math.abs(budgetChange) > config.alerts.learningResetBudgetChangePct && recentEdit && rolling.level === 'adset' && hasMinSpend) {
                const type = "LEARNING_RESET_RISK";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `LEARNING_RESET_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "WARNING",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, { ...commonVars, threshold_pct: config.alerts.learningResetBudgetChangePct }),
                    impactScore: Math.min((classif?.impactScore || 50) + 15, 100),
                    evidence: [`Budget Δ 3d: ${budgetChange.toFixed(1)}%`, `Edición hace < 3 días`],
                    createdAt: new Date().toISOString()
                });
            }

            // CPA SPIKE
            const cpaDelta = r.cpa_delta_pct || 0;
            if (cpaDelta > (config.findings.cpaSpikeThreshold * 100)) {
                const type = "CPA_SPIKE";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `CPA_SPIKE_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "CRITICAL",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 80,
                    evidence: [`CPA 7d: ${commonVars.cpa_7d}`, `CPA 14d: $${(r.cpa_14d || 0).toFixed(2)}`, `Delta: ${cpaDelta.toFixed(1)}%`],
                    createdAt: new Date().toISOString()
                });
            }

            // BUDGET BLEED
            const bleedMultiplier = config.alerts.budgetBleedMultiplier ?? 2;
            if (primaryMetric === 0 && targetCpa && spend_7d > (targetCpa * bleedMultiplier)) {
                const type = "BUDGET_BLEED";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `BLEED_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "CRITICAL",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 90,
                    evidence: [`Gasto 7d: ${commonVars.spend_7d}`, `Conversiones: 0`, `Target CPA: ${commonVars.targetCpa}`],
                    createdAt: new Date().toISOString()
                });
            }

            // CPA VOLATILITY
            if (Math.abs(budgetChange) > (config.findings.volatilityThreshold * 100)) {
                const type = "CPA_VOLATILITY";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                alerts.push({
                    id: `VOLATILITY_${rolling.entityId}_${Date.now()}`,
                    clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                    severity: "WARNING",
                    title: formatMessage(template.title, commonVars),
                    description: formatMessage(template.description, commonVars),
                    impactScore: 40,
                    evidence: [`Δ Budget 3d: ${budgetChange.toFixed(1)}%`, `Threshold: ${config.findings.volatilityThreshold * 100}%`],
                    createdAt: new Date().toISOString()
                });
            }

            // VIDEO DIAGNOSTICS
            const hookRate7d = r.hook_rate_7d || 0;
            const holdRate7d = r.hold_rate_7d;
            const isVideoEntity = (r.video_views_7d || 0) > 0 || hookRate7d > 0;
            const videoConfig = config.video ?? getDefaultEngineConfig(clientId).video;

            if (isVideoEntity) {
                if (hookRate7d > 0 && hookRate7d < (videoConfig.hookKillThreshold ?? 20) && spend_7d > (videoConfig.hookKillMinSpend ?? 50)) {
                    const type = "HOOK_KILL";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    if (template) {
                        alerts.push({
                            id: `HOOK_KILL_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                            severity: "CRITICAL",
                            title: formatMessage(template.title, { ...commonVars, hookThreshold: videoConfig.hookKillThreshold ?? 20 }),
                            description: formatMessage(template.description, { ...commonVars, hook_rate_7d: `${hookRate7d.toFixed(1)}%`, hookThreshold: videoConfig.hookKillThreshold ?? 20 }),
                            impactScore: 85,
                            evidence: [`Hook Rate: ${hookRate7d.toFixed(1)}%`, `Gasto 7d: ${commonVars.spend_7d}`, `Threshold: ${videoConfig.hookKillThreshold ?? 20}%`],
                            createdAt: new Date().toISOString()
                        });
                    }
                }

                if (hookRate7d >= (videoConfig.bodyWeakHookMin ?? 25) && holdRate7d !== undefined && holdRate7d < (videoConfig.bodyWeakHoldThreshold ?? 30)) {
                    const type = "BODY_WEAK";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    if (template) {
                        alerts.push({
                            id: `BODY_WEAK_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                            severity: "WARNING",
                            title: formatMessage(template.title, commonVars),
                            description: formatMessage(template.description, { ...commonVars, hook_rate_7d: `${hookRate7d.toFixed(1)}%`, hold_rate_7d: `${holdRate7d.toFixed(1)}%` }),
                            impactScore: 55,
                            evidence: [`Hook Rate: ${hookRate7d.toFixed(1)}%`, `Hold Rate: ${holdRate7d.toFixed(1)}%`, `Threshold: ${videoConfig.bodyWeakHoldThreshold ?? 30}%`],
                            createdAt: new Date().toISOString()
                        });
                    }
                }

                const ctr7d = r.ctr_7d || 0;
                if (hookRate7d >= (videoConfig.bodyWeakHookMin ?? 25) && (holdRate7d === undefined || holdRate7d >= (videoConfig.bodyWeakHoldThreshold ?? 30)) && ctr7d > 0 && ctr7d < (videoConfig.ctaWeakCtrThreshold ?? 0.8)) {
                    const type = "CTA_WEAK";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    if (template) {
                        alerts.push({
                            id: `CTA_WEAK_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                            severity: "WARNING",
                            title: formatMessage(template.title, commonVars),
                            description: formatMessage(template.description, { ...commonVars, ctr_7d: `${ctr7d.toFixed(2)}%` }),
                            impactScore: 50,
                            evidence: [`Hook Rate: ${hookRate7d.toFixed(1)}%`, holdRate7d !== undefined ? `Hold Rate: ${holdRate7d.toFixed(1)}%` : 'Hold Rate: N/A', `CTR: ${ctr7d.toFixed(2)}%`],
                            createdAt: new Date().toISOString()
                        });
                    }
                }

                const dropOff = r.drop_off_point;
                if (dropOff && dropOff !== 'p25') {
                    const type = "VIDEO_DROPOFF";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    if (template) {
                        alerts.push({
                            id: `DROPOFF_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                            severity: "INFO",
                            title: formatMessage(template.title, { ...commonVars, drop_off_point: dropOff }),
                            description: formatMessage(template.description, { ...commonVars, drop_off_point: dropOff }),
                            impactScore: 30,
                            evidence: [`Mayor caída en: ${dropOff}`, `Completion Rate: ${(r.completion_rate_7d || 0).toFixed(1)}%`],
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }

            // FORMAT-SPECIFIC ALERTS (non-video: images)
            const formatConfig = config.format ?? getDefaultEngineConfig(clientId).format;
            if (!isVideoEntity && spend_7d > (config.alerts.minSpendForAlerts ?? 10)) {
                const ctr7dFmt = r.ctr_7d || 0;
                const imp7d = r.impressions_7d || 0;

                // IMAGE_INVISIBLE: Low CTR + significant impressions
                if (ctr7dFmt < (formatConfig.imageInvisibleCtrThreshold ?? 0.5) && imp7d > (formatConfig.imageInvisibleMinImpressions ?? 2000)) {
                    const type = "IMAGE_INVISIBLE";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    if (template) {
                        alerts.push({
                            id: `IMG_INVIS_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                            severity: "WARNING",
                            title: formatMessage(template.title, commonVars),
                            description: formatMessage(template.description, { ...commonVars, ctr_7d: `${ctr7dFmt.toFixed(2)}%`, impressions_7d: imp7d }),
                            impactScore: 45,
                            evidence: [`CTR: ${ctr7dFmt.toFixed(2)}%`, `Impresiones: ${imp7d}`, `Gasto: ${commonVars.spend_7d}`],
                            createdAt: new Date().toISOString()
                        });
                    }
                }

                // IMAGE_NO_CONVERT: Good CTR but CPA way above target
                if (ctr7dFmt >= (formatConfig.imageNoConvertCtrMin ?? 1.5) && targetCpa && primaryCpa && primaryCpa > targetCpa * (formatConfig.imageNoConvertCpaMultiplier ?? 2)) {
                    const type = "IMAGE_NO_CONVERT";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    if (template) {
                        alerts.push({
                            id: `IMG_NOCONV_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                            severity: "WARNING",
                            title: formatMessage(template.title, commonVars),
                            description: formatMessage(template.description, { ...commonVars, ctr_7d: `${ctr7dFmt.toFixed(2)}%` }),
                            impactScore: 50,
                            evidence: [`CTR: ${ctr7dFmt.toFixed(2)}%`, `CPA: ${commonVars.cpa_7d}`, `Target CPA: ${commonVars.targetCpa}`],
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }

            if (classif) {
                if (classif.fatigueState === "REAL" || classif.fatigueState === "CONCEPT_DECAY" || classif.fatigueState === "AUDIENCE_SATURATION") {
                    const type = "ROTATE_CONCEPT";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    const fatigueLabels: Record<string, string> = { REAL: "Fatiga Real", CONCEPT_DECAY: "Decaimiento Conceptual", AUDIENCE_SATURATION: "Saturación de Audiencia", HEALTHY_REPETITION: "Repetición Saludable", NONE: "Ninguna" };
                    alerts.push({
                        id: `FATIGUE_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "CRITICAL",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, { ...commonVars, fatigueLabel: fatigueLabels[classif.fatigueState] || "Fatiga", hook_rate_7d: `${(r.hook_rate_7d || 0).toFixed(2)}%` }),
                        impactScore: classif.impactScore, evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.structuralState === "FRAGMENTED" || classif.structuralState === "OVERCONCENTRATED") {
                    const type = "CONSOLIDATE";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    alerts.push({
                        id: `STRUCT_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "WARNING",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, { ...commonVars, structuralState: classif.structuralState === "FRAGMENTED" ? "Fragmentada" : "Sobreconcentrada" }),
                        impactScore: classif.impactScore, evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.finalDecision === "KILL_RETRY") {
                    const type = "KILL_RETRY";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    alerts.push({
                        id: `KILL_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "WARNING",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, commonVars),
                        impactScore: classif.impactScore, evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }

                if (classif.finalDecision === "INTRODUCE_BOFU_VARIANTS") {
                    const type = "INTRODUCE_BOFU_VARIANTS";
                    const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                    alerts.push({
                        id: `UPSELL_${rolling.entityId}_${Date.now()}`, clientId, level: rolling.level, entityId: rolling.entityId, entityName: contextName, type,
                        severity: "INFO",
                        title: formatMessage(template.title, commonVars),
                        description: formatMessage(template.description, commonVars),
                        impactScore: classif.impactScore, evidence: classif.evidence,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        // CREATIVE MIX IMBALANCE — aggregate alert across all ad entities
        const fmtConfig = config.format ?? getDefaultEngineConfig(clientId).format;
        const adEntities = rollingMetrics.filter(rm => rm.level === 'ad' && (rm.rolling.spend_7d || 0) > 0);
        if (adEntities.length >= 3) {
            // Classify format by presence of video data
            let videoCount = 0, imageCount = 0;
            let videoSpend = 0, imageSpend = 0;
            for (const ad of adEntities) {
                const hasVideo = (ad.rolling.video_views_7d || 0) > 0 || (ad.rolling.hook_rate_7d || 0) > 0;
                if (hasVideo) { videoCount++; videoSpend += (ad.rolling.spend_7d || 0); }
                else { imageCount++; imageSpend += (ad.rolling.spend_7d || 0); }
            }
            const totalSpend = videoSpend + imageSpend;
            const totalAds = videoCount + imageCount;
            const formatCount = (videoCount > 0 ? 1 : 0) + (imageCount > 0 ? 1 : 0);

            const mixIssues: string[] = [];

            // Detect low format diversity
            if (formatCount < (fmtConfig.creativeMixMinFormats ?? 3) && totalAds >= 5) {
                mixIssues.push(`Solo ${formatCount} formato(s) activo(s) de ${totalAds} ads`);
            }

            // Detect spend over-concentration in one format
            const maxFormatSpendPct = totalSpend > 0 ? Math.max(videoSpend, imageSpend) / totalSpend : 0;
            if (maxFormatSpendPct > (fmtConfig.creativeMixConcentrationPct ?? 0.8) && totalAds >= 4) {
                const dominantFormat = videoSpend > imageSpend ? 'VIDEO' : 'IMAGE';
                mixIssues.push(`${(maxFormatSpendPct * 100).toFixed(0)}% del gasto en ${dominantFormat}`);
            }

            if (mixIssues.length > 0) {
                const type = "CREATIVE_MIX_IMBALANCE";
                const template = config.alertTemplates[type] || getDefaultEngineConfig(clientId).alertTemplates[type];
                if (template) {
                    const mixDescription = mixIssues.join('. ') + '. Andromeda prioriza diversidad de formatos.';
                    alerts.push({
                        id: `MIX_${clientId}_${Date.now()}`,
                        clientId,
                        level: 'account',
                        entityId: clientId,
                        entityName: 'Cuenta',
                        type,
                        severity: "WARNING",
                        title: formatMessage(template.title, { entityName: 'Cuenta' }),
                        description: formatMessage(template.description, { entityName: 'Cuenta', mixDescription }),
                        impactScore: 35,
                        evidence: [
                            `Videos activos: ${videoCount}`,
                            `Imágenes activas: ${imageCount}`,
                            ...mixIssues
                        ],
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        // Deduplicate: ad (2) > adset (1)
        const levelPriority: Record<string, number> = { ad: 2, adset: 1 };
        const seen = new Map<string, Alert>();

        for (const alert of alerts) {
            const snap = dailySnapshots.find(s => s.entityId === alert.entityId && s.level === alert.level);
            const adsetId = alert.level === 'adset' ? alert.entityId : snap?.meta?.adsetId || alert.entityId;
            const dedupeKey = `${alert.type}__${adsetId}`;
            const existing = seen.get(dedupeKey);
            if (!existing || (levelPriority[alert.level] || 0) > (levelPriority[existing.level] || 0)) {
                seen.set(dedupeKey, alert);
            }
        }
        const deduped = [...seen.values()];

        // Filter by enabled alerts
        const clientActiveIds = config.enabledAlerts || Object.keys(config.alertTemplates);
        const globalActiveIds = enabledAlertTypes || Object.keys(config.alertTemplates);

        return deduped.filter(a =>
            clientActiveIds.includes(a.type) &&
            globalActiveIds.includes(a.type)
        );
    }

    static async run(clientId: string) {
        // 0. Global Switch Check
        const sysSettings = await SystemSettingsService.getSettings();
        if (!sysSettings.alertsEnabled) {
            console.log(`[AlertEngine] Alerts are GLOBALLY DISABLED. Skipping for client: ${clientId}`);
            // Clear existing alerts for this client to be safe
            const oldAlerts = await db.collection("alerts")
                .where("clientId", "==", clientId)
                .get();
            if (!oldAlerts.empty) {
                const batch = db.batch();
                for (const d of oldAlerts.docs) batch.delete(d.ref);
                await batch.commit();
            }
            return [];
        }

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

        // Delegate to pure evaluate()
        const filteredAlerts = this.evaluate({
            clientId,
            rollingMetrics,
            classifications,
            dailySnapshots,
            clientData,
            config,
            enabledAlertTypes: sysSettings.enabledAlertTypes
        });

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
