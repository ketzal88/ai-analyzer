export interface EngineConfig {
    clientId: string;
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

    // Alert Templates (New)
    alertTemplates: Record<string, {
        title: string;
        description: string;
    }>;

    // Daily Digest Template
    dailySnapshotTitle: string;
}

export function getDefaultEngineConfig(clientId: string): EngineConfig {
    return {
        clientId,
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
            scalingFrequencyMax: 4
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
                description: "{fatigueLabel} detectada. Hook rate {hook_rate_7d} con frecuencia {frequency_7d}."
            },
            CONSOLIDATE: {
                title: "Sugerencia de Consolidación: {entityName}",
                description: "Estructura {structuralState}. Se recomienda consolidar para mejorar el aprendizaje."
            },
            KILL_RETRY: {
                title: "Gasto sin Señales: {entityName}",
                description: "Fase de exploración fallida con gasto significativo ({spend_7d})."
            },
            INTRODUCE_BOFU_VARIANTS: {
                title: "Refuerzo de Conversión (BOFU): {entityName}",
                description: "Añade variantes con ofertas directas o escasez para este ganador."
            }
        },
        dailySnapshotTitle: "Reporte Acumulado Mes — {clientName}"
    };
}
