export type ConceptHealth = 'HEALTHY' | 'DEGRADING' | 'CRITICAL_FATIGUE';

export interface ConceptRollup {
    clientId: string;
    conceptId: string;
    health: ConceptHealth;

    // Performance (Rolling 7d)
    spend_7d: number;
    spendShare: number; // Concentration in account
    cpa_7d: number;
    cpa_14d: number;
    roas_7d: number;

    // Fatigue Signals
    frequency_7d: number;
    hookRateDelta: number; // % change 7d vs 14d
    cpaDelta: number; // % change 7d vs 14d

    // Intent & Content Mix
    intentMix: {
        TOFU: number; // percentage (0-1)
        MOFU: number;
        BOFU: number;
    };
    dominantFormat: string;

    lastUpdate: string;
}

export interface ConceptInsight {
    type: 'OPPORTUNITY' | 'RISK' | 'ACTION';
    title: string;
    description: string;
    evidence: string[];
}
