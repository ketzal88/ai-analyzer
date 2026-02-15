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
        }
    };
}
