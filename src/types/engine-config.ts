import { BusinessType } from "@/types";

export interface EngineConfig {
    clientId: string;
    businessType: BusinessType;
    updatedAt: string;

    // Fatigue Engine (decision-engine.ts)
    fatigue: {
        frequencyThreshold: number;      // default 4
        cpaMultiplierThreshold: number;   // default 1.25 (CPA_7d > CPA_14d * this)
        hookRateDeltaThreshold: number;   // default -0.2 (-20%)
        concentrationThreshold: number;   // default 0.6 (60%)
    };

    // Structure Engine (decision-engine.ts)
    structure: {
        fragmentationAdsetsMax: number;   // default 6
        overconcentrationPct: number;     // default 0.8 (80%)
        overconcentrationMinSpend: number; // default 100
    };

    // Alert Engine (alert-engine.ts)
    alerts: {
        learningResetBudgetChangePct: number; // default 30
        scalingFrequencyMax: number;          // default 4
        budgetBleedMultiplier: number;        // default 2 (spend > targetCpa * this = bleed)
        scalingStableDays: number;            // default 3 (min days since edit to scale)
        minSpendForAlerts: number;            // default 10 (min 7d spend to generate alerts)
        velocityMinForScaling: number;        // default 0.5 (min daily velocity for scaling)
    };

    // Findings Engine (findings-engine.ts / migrated to alert-engine)
    findings: {
        cpaSpikeThreshold: number;
        roasDropThreshold: number;
        cvrDropThreshold: number;
        volatilityThreshold: number;
        concentrationPct: number;
    };

    // Learning Phase Logic (New)
    learning: {
        unstableDays: number;       // default 3 (days since last edit)
        explorationDays: number;    // default 4 (initial days)
        exploitationMinConversions: number; // default 50
    };

    // Intent Engine Logic (New)
    intent: {
        bofuScoreThreshold: number; // default 0.65
        mofuScoreThreshold: number; // default 0.35
        volatilityPenalty: number;  // default 0.4 (40% penalty)
        minImpressionsForPenalty: number; // default 2000
    };

    // Video Diagnostics (alert-engine.ts)
    video: {
        hookKillThreshold: number;        // default 20 (Hook Rate < 20% = kill)
        hookKillMinSpend: number;         // default 50
        bodyWeakHoldThreshold: number;    // default 30 (Hold Rate < 30% = weak body)
        bodyWeakHookMin: number;          // default 25 (Hook > 25% to trigger)
        ctaWeakCtrThreshold: number;      // default 0.8 (CTR < 0.8% = weak CTA)
        dropoffDeltaThreshold: number;    // default 50 (>50% drop between stages)
        frequencyVelocityWarn: number;    // default 0.3 (freq increase per day)
    };

    // Format-Specific Diagnostics (alert-engine.ts)
    format: {
        imageInvisibleCtrThreshold: number;      // default 0.5 (CTR < 0.5% = invisible)
        imageInvisibleMinImpressions: number;     // default 2000
        imageNoConvertCtrMin: number;             // default 1.5 (CTR > 1.5% but no conversions)
        imageNoConvertCpaMultiplier: number;      // default 2 (CPA > 2x target)
        creativeMixMinFormats: number;            // default 3 (min distinct formats for Andromeda)
        creativeMixConcentrationPct: number;      // default 0.8 (>80% spend in one format = warning)
    };

    // Alert Templates (New)
    alertTemplates: Record<string, {
        title: string;
        description: string;
    }>;

    // Daily Digest Template
    dailySnapshotTitle: string;

    // Active Alerts Switch (New)
    enabledAlerts: string[];
}

export function getDefaultEngineConfig(clientId: string, businessType: BusinessType = 'ecommerce'): EngineConfig {
    return {
        clientId,
        businessType,
        updatedAt: new Date().toISOString(),
        fatigue: {
            frequencyThreshold: 4,
            cpaMultiplierThreshold: 1.25,
            hookRateDeltaThreshold: -0.2,
            concentrationThreshold: 0.6
        },
        structure: {
            fragmentationAdsetsMax: 6,
            overconcentrationPct: 0.8,
            overconcentrationMinSpend: 100
        },
        alerts: {
            learningResetBudgetChangePct: 30,
            scalingFrequencyMax: 4,
            budgetBleedMultiplier: 2,
            scalingStableDays: 3,
            minSpendForAlerts: 10,
            velocityMinForScaling: 0.5
        },
        findings: {
            cpaSpikeThreshold: 0.25,
            roasDropThreshold: -0.15,
            cvrDropThreshold: -0.15,
            volatilityThreshold: 0.5,
            concentrationPct: 0.8
        },
        learning: {
            unstableDays: 3,
            explorationDays: 4,
            exploitationMinConversions: 50
        },
        intent: {
            bofuScoreThreshold: 0.65,
            mofuScoreThreshold: 0.35,
            volatilityPenalty: 0.6, // Multiplier (so 1 - 0.4 = 0.6)
            minImpressionsForPenalty: 2000
        },
        format: {
            imageInvisibleCtrThreshold: 0.5,
            imageInvisibleMinImpressions: 2000,
            imageNoConvertCtrMin: 1.5,
            imageNoConvertCpaMultiplier: 2,
            creativeMixMinFormats: 3,
            creativeMixConcentrationPct: 0.8
        },
        video: {
            hookKillThreshold: 20,
            hookKillMinSpend: 50,
            bodyWeakHoldThreshold: 30,
            bodyWeakHookMin: 25,
            ctaWeakCtrThreshold: 0.8,
            dropoffDeltaThreshold: 50,
            frequencyVelocityWarn: 0.3
        },
        alertTemplates: {
            SCALING_OPPORTUNITY: {
                title: "Oportunidad de Escala: {entityName}",
                description: "Señal consolidada. CPA {cpa_7d} (target: {targetCpa}). Velocidad estable. Frecuencia {frequency_7d} OK."
            },
            LEARNING_RESET_RISK: {
                title: "Riesgo de Reinicio de Aprendizaje: {entityName}",
                description: "Cambio de budget de {budget_change_3d_pct}% (> {threshold_pct}%) con edición reciente."
            },
            CPA_SPIKE: {
                title: "Pico de CPA en {entityName}",
                description: "El CPA ha subido un {cpa_delta_pct}% en comparación con el período anterior."
            },
            BUDGET_BLEED: {
                title: "Fuga de Presupuesto: {entityName}",
                description: "Se han gastado {spend_7d} (> 2x Target CPA) sin registrar conversiones."
            },
            UNDERFUNDED_WINNER: {
                title: "Ganador Infra-presupuestado: {entityName}",
                description: "CPA de {cpa_7d} es un 20% mejor que el objetivo, pero el gasto es bajo ({spend_7d})."
            },
            CPA_VOLATILITY: {
                title: "Alta Volatilidad en {entityName}",
                description: "Cambios bruscos de presupuesto ({budget_change_3d_pct}%) están afectando la estabilidad del CPA."
            },
            ROTATE_CONCEPT: {
                title: "Rotar Creativo: {entityName}",
                description: "{fatigueLabel} detectada. Hook rate {hook_rate_7d} con frecuencia {frequency_7d}. Objetivo: Evitar el aumento de CPA refrescando el contenido visual."
            },
            CONSOLIDATE: {
                title: "Sugerencia de Consolidación: {entityName}",
                description: "Estructura {structuralState}. Objetivo: Agrupar conjuntos para acelerar la salida de la fase de aprendizaje y estabilizar el CPA."
            },
            KILL_RETRY: {
                title: "Gasto sin Señales: {entityName}",
                description: "Fase de exploración fallida con gasto significativo ({spend_7d})."
            },
            INTRODUCE_BOFU_VARIANTS: {
                title: "Refuerzo de Conversión (BOFU): {entityName}",
                description: "Añade variantes con ofertas directas o escasez para este ganador."
            },
            HOOK_KILL: {
                title: "Hook Muerto: {entityName}",
                description: "Hook Rate de {hook_rate_7d} (< {hookThreshold}%) con gasto de {spend_7d}. El video no captura atención."
            },
            BODY_WEAK: {
                title: "Cuerpo Débil: {entityName}",
                description: "Hook Rate {hook_rate_7d} OK pero Hold Rate de {hold_rate_7d} indica que el contenido post-hook no retiene."
            },
            CTA_WEAK: {
                title: "CTA Débil: {entityName}",
                description: "Hook y retención buenos pero CTR de {ctr_7d} sugiere que el CTA o la landing no convencen."
            },
            VIDEO_DROPOFF: {
                title: "Drop-off en {drop_off_point}: {entityName}",
                description: "Caída significativa de audiencia en {drop_off_point}. Revisar el contenido en ese punto del video."
            },
            IMAGE_INVISIBLE: {
                title: "Imagen Invisible: {entityName}",
                description: "CTR de {ctr_7d} con {impressions_7d} impresiones. La imagen no genera clicks."
            },
            IMAGE_NO_CONVERT: {
                title: "Imagen sin Conversión: {entityName}",
                description: "CTR de {ctr_7d} bueno pero CPA {cpa_7d} supera el target. El problema está post-click."
            },
            CREATIVE_MIX_IMBALANCE: {
                title: "Mix Creativo Desbalanceado: {entityName}",
                description: "{mixDescription}"
            }
        },
        dailySnapshotTitle: "Reporte Acumulado Mes — {clientName}",
        enabledAlerts: [
            "SCALING_OPPORTUNITY",
            "LEARNING_RESET_RISK",
            "CPA_SPIKE",
            "BUDGET_BLEED",
            "UNDERFUNDED_WINNER",
            "CPA_VOLATILITY",
            "ROTATE_CONCEPT",
            "CONSOLIDATE",
            "KILL_RETRY",
            "INTRODUCE_BOFU_VARIANTS",
            "HOOK_KILL",
            "BODY_WEAK",
            "CTA_WEAK",
            "VIDEO_DROPOFF",
            "IMAGE_INVISIBLE",
            "IMAGE_NO_CONVERT",
            "CREATIVE_MIX_IMBALANCE"
        ]
    };
}
