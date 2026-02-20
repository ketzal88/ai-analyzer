export type EventType = "integration" | "infra" | "data" | "cron";
export type EventService = "meta" | "firestore" | "slack" | "gemini" | "cron";
export type EventSeverity = "info" | "warning" | "critical";

export interface SystemEvent {
    id?: string;
    type: EventType;
    service: EventService;
    severity: EventSeverity;
    clientId?: string;
    clientName?: string;
    message: string;
    rawError?: string;
    metadata?: Record<string, any>;
    timestamp: string;
    resolved?: boolean;
    resolvedAt?: string;
}

export interface CronExecution {
    id?: string;
    cronType: "data-sync" | "daily-digest" | "sync-creatives" | "weekly-alerts" | "account-health";
    startedAt: string;
    completedAt: string;
    durationMs: number;
    summary: {
        total: number;
        success: number;
        failed: number;
        skipped: number;
    };
    results: Array<{
        clientId: string;
        clientName?: string;
        status: string;
        error?: string;
    }>;
    triggeredBy: "schedule" | "manual";
}

// ─── Account Health Monitoring ─────────────────────────

export type SpendCapAlertLevel = "safe" | "warning" | "critical" | "imminent";

export interface AccountHealth {
    clientId: string;
    clientName: string;
    metaAccountId: string;
    accountStatus: number;          // Meta: 1=active, 2=disabled, 3=unsettled
    accountStatusName: string;      // human-readable
    disableReason?: string;
    balance?: number;
    spendCap?: number;
    amountSpent?: number;
    spendCapPct?: number;           // amountSpent / spendCap * 100
    spendCapAlertLevel: SpendCapAlertLevel;
    projectedCutoffDays?: number;   // days until spend cap reached
    avgDailySpend7d?: number;
    lastChecked: string;
    lastAlertSent?: string;
    previousStatus?: number;        // for detecting transitions
}
