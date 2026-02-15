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
        cpaSpikeThreshold: number;          // default 0.25 (25%)
        roasDropThreshold: number;          // default -0.15 (-15%)
        cvrDropThreshold: number;           // default -0.15 (-15%)
        volatilityThreshold: number;        // default 0.5 (50% coefficient of variation)
        concentrationPct: number;           // default 0.8 (80%)
    };
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
        }
    };
}
