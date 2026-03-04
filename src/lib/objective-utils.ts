/**
 * Objective Utils — Single Source of Truth for campaign objective → metric mapping.
 *
 * All alert, classification, and reporting logic should use these functions
 * instead of implementing their own objective detection.
 */

export type CampaignObjectiveType =
    | 'sales'        // Ventas directas (ecommerce)
    | 'leads'        // Formularios, registros
    | 'messaging'    // WhatsApp conversations
    | 'scheduling'   // Reservas, appointments, turnos
    | 'traffic'      // Clicks, visitas
    | 'awareness'    // Alcance, impresiones
    | 'app_installs' // Instalaciones de app
    | 'video_views'; // Reproducciones de video

export interface PrimaryMetricInfo {
    /** Field name in PerformanceMetrics / EntityRollingMetrics (e.g., 'purchases_7d') */
    rollingField: string;
    /** Field name in daily PerformanceMetrics (e.g., 'purchases') */
    dailyField: string;
    /** Display label in Spanish */
    labelEs: string;
    /** Display label in English */
    label: string;
}

interface FrequencyThresholds {
    warn: number;
    critical: number;
}

// ─────────────────────────────────────────────
// Meta Objective → Internal Type Resolution
// ─────────────────────────────────────────────

const META_OBJECTIVE_MAP: Record<string, CampaignObjectiveType> = {
    // Sales / Conversions
    'OUTCOME_SALES': 'sales',
    'CONVERSIONS': 'sales',
    'PRODUCT_CATALOG_SALES': 'sales',

    // Leads
    'OUTCOME_LEADS': 'leads',
    'LEAD_GENERATION': 'leads',

    // Messaging
    'OUTCOME_ENGAGEMENT': 'messaging',
    'MESSAGES': 'messaging',

    // Traffic
    'OUTCOME_TRAFFIC': 'traffic',
    'TRAFFIC': 'traffic',
    'LINK_CLICKS': 'traffic',

    // Awareness
    'OUTCOME_AWARENESS': 'awareness',
    'REACH': 'awareness',
    'BRAND_AWARENESS': 'awareness',

    // App Installs
    'OUTCOME_APP_PROMOTION': 'app_installs',
    'APP_INSTALLS': 'app_installs',

    // Video Views
    'VIDEO_VIEWS': 'video_views',
};

/** Name-based patterns for fallback detection */
const NAME_PATTERNS: { pattern: RegExp; type: CampaignObjectiveType }[] = [
    // Scheduling (must be before leads since it's a sub-type)
    { pattern: /reserva|booking|schedule|turno|cita|appointment/i, type: 'scheduling' },
    // Messaging
    { pattern: /whatsapp|mensaje|message|wa_conv/i, type: 'messaging' },
    // Leads
    { pattern: /lead|formulario|form|registro|captacion|clientes/i, type: 'leads' },
    // Traffic
    { pattern: /trafico|traffic|visita|click/i, type: 'traffic' },
    // Awareness
    { pattern: /awareness|alcance|reconocimiento|branding/i, type: 'awareness' },
    // Video
    { pattern: /video_view|reproducci/i, type: 'video_views' },
];

/**
 * Resolve a Meta objective string + entity name into an internal objective type.
 *
 * Priority:
 * 1. Client override (if set per campaign pattern)
 * 2. Meta API objective field
 * 3. Entity name pattern matching
 * 4. Fallback to 'sales'
 */
export function resolveObjective(
    metaObjective?: string,
    entityName?: string,
    clientOverride?: CampaignObjectiveType
): CampaignObjectiveType {
    // 1. Client-level override
    if (clientOverride) return clientOverride;

    // 2. Direct Meta objective mapping
    if (metaObjective) {
        const mapped = META_OBJECTIVE_MAP[metaObjective];
        if (mapped) {
            // Special case: OUTCOME_LEADS can be scheduling based on name
            if (mapped === 'leads' && entityName) {
                const schedulingMatch = NAME_PATTERNS.find(p => p.type === 'scheduling');
                if (schedulingMatch && schedulingMatch.pattern.test(entityName)) {
                    return 'scheduling';
                }
            }
            // Special case: OUTCOME_ENGAGEMENT can be video_views based on name
            if (mapped === 'messaging' && entityName) {
                const videoMatch = NAME_PATTERNS.find(p => p.type === 'video_views');
                if (videoMatch && videoMatch.pattern.test(entityName)) {
                    return 'video_views';
                }
            }
            return mapped;
        }
    }

    // 3. Name-based fallback
    if (entityName) {
        for (const { pattern, type } of NAME_PATTERNS) {
            if (pattern.test(entityName)) return type;
        }
    }

    // 4. Default
    return 'sales';
}

// ─────────────────────────────────────────────
// Primary Metric per Objective
// ─────────────────────────────────────────────

const METRIC_MAP: Record<CampaignObjectiveType, PrimaryMetricInfo> = {
    sales: {
        rollingField: 'purchases_7d',
        dailyField: 'purchases',
        labelEs: 'Ventas',
        label: 'Purchases',
    },
    leads: {
        rollingField: 'leads_7d',
        dailyField: 'leads',
        labelEs: 'Leads',
        label: 'Leads',
    },
    messaging: {
        rollingField: 'whatsapp_7d',
        dailyField: 'whatsapp',
        labelEs: 'Conversaciones WA',
        label: 'WA Conversations',
    },
    scheduling: {
        rollingField: 'schedule_7d',
        dailyField: 'schedule',
        labelEs: 'Reservas',
        label: 'Bookings',
    },
    traffic: {
        rollingField: 'clicks_7d',
        dailyField: 'clicks',
        labelEs: 'Clicks',
        label: 'Clicks',
    },
    awareness: {
        rollingField: 'impressions_7d',
        dailyField: 'impressions',
        labelEs: 'Impresiones',
        label: 'Impressions',
    },
    app_installs: {
        rollingField: 'installs_7d',
        dailyField: 'installs',
        labelEs: 'Instalaciones',
        label: 'Installs',
    },
    video_views: {
        rollingField: 'video_views_7d',
        dailyField: 'videoPlayCount',
        labelEs: 'Reproducciones',
        label: 'Video Views',
    },
};

export function getPrimaryMetric(objective: CampaignObjectiveType): PrimaryMetricInfo {
    return METRIC_MAP[objective];
}

/**
 * Extract the primary metric VALUE from a rolling metrics object.
 * Handles the dynamic field lookup.
 */
export function getPrimaryMetricValue(
    rolling: Record<string, any>,
    objective: CampaignObjectiveType
): number {
    const info = METRIC_MAP[objective];
    return Number(rolling[info.rollingField] || 0);
}

/**
 * Extract the primary metric VALUE from a daily performance object.
 */
export function getDailyMetricValue(
    performance: Record<string, any>,
    objective: CampaignObjectiveType
): number {
    const info = METRIC_MAP[objective];
    return Number(performance[info.dailyField] || 0);
}

// ─────────────────────────────────────────────
// Frequency Thresholds per Objective
// ─────────────────────────────────────────────

const FREQUENCY_THRESHOLDS: Record<CampaignObjectiveType, FrequencyThresholds> = {
    sales: { warn: 2.5, critical: 4.0 },
    leads: { warn: 2.5, critical: 4.0 },
    messaging: { warn: 2.5, critical: 4.0 },
    scheduling: { warn: 2.5, critical: 4.0 },
    traffic: { warn: 3.0, critical: 5.0 },
    awareness: { warn: 3.5, critical: 6.0 },
    app_installs: { warn: 2.5, critical: 4.0 },
    video_views: { warn: 4.0, critical: 7.0 },
};

export function getFrequencyThresholds(objective: CampaignObjectiveType): FrequencyThresholds {
    return FREQUENCY_THRESHOLDS[objective];
}

// ─────────────────────────────────────────────
// Objective Classification Helpers
// ─────────────────────────────────────────────

/** Returns true if the objective measures "real" conversions (not just engagement metrics) */
export function isConversionObjective(objective: CampaignObjectiveType): boolean {
    return ['sales', 'leads', 'messaging', 'scheduling', 'app_installs'].includes(objective);
}

/** Returns true if CPA-based alerts (BUDGET_BLEED, CPA_SPIKE, etc.) make sense for this objective */
export function isCpaRelevant(objective: CampaignObjectiveType): boolean {
    return isConversionObjective(objective);
}

/** Returns true if ROAS-based analysis applies */
export function isRoasRelevant(objective: CampaignObjectiveType): boolean {
    return objective === 'sales';
}

/**
 * Get the list of alert types that are relevant for a given objective.
 * Non-conversion objectives skip CPA-based alerts.
 */
export function getRelevantAlertTypes(objective: CampaignObjectiveType): string[] {
    const base = [
        'LEARNING_RESET_RISK',
        'CPA_VOLATILITY',
        'ROTATE_CONCEPT',
        'CONSOLIDATE',
        'KILL_RETRY',
        'INTRODUCE_BOFU_VARIANTS',
    ];

    if (isCpaRelevant(objective)) {
        return [
            ...base,
            'SCALING_OPPORTUNITY',
            'CPA_SPIKE',
            'BUDGET_BLEED',
            'UNDERFUNDED_WINNER',
        ];
    }

    // Traffic/Awareness/Video: still get scaling based on volume, but not CPA alerts
    return [
        ...base,
        'SCALING_OPPORTUNITY',
    ];
}

// ─────────────────────────────────────────────
// BusinessType → Objective mapping (backward compat)
// ─────────────────────────────────────────────

import { BusinessType } from "@/types";

/**
 * Maps legacy BusinessType to default CampaignObjectiveType.
 * Used as fallback when no Meta objective is available.
 */
export function businessTypeToObjective(bt: BusinessType): CampaignObjectiveType {
    switch (bt) {
        case 'ecommerce': return 'sales';
        case 'leads': return 'leads';
        case 'whatsapp': return 'messaging';
        case 'apps': return 'app_installs';
        default: return 'sales';
    }
}
