export type EventType = "integration" | "infra" | "data" | "cron";
export type EventService = "meta" | "google_ads" | "firestore" | "slack" | "gemini" | "cron";
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
    cronType: "data-sync" | "daily-digest" | "daily-briefing" | "sync-creatives" | "weekly-alerts" | "account-health" | "creative-dna" | "sync-meta" | "sync-google" | "sync-ga4" | "sync-ecommerce" | "sync-email" | "sync-leads" | "semaforo" | "fill-gaps" | "process-backfill-queue";
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

export type AccountHealthAlertType =
    // Meta alerts
    | "ACCOUNT_DISABLED"
    | "ACCOUNT_REACTIVATED"
    | "ACCOUNT_STATUS_CHANGE"
    | "SPEND_CAP_WARNING"
    | "SPEND_CAP_CRITICAL"
    | "SPEND_CAP_IMMINENT"
    | "ACCOUNT_NO_BALANCE"
    // Google Ads alerts
    | "GOOGLE_ACCOUNT_SUSPENDED"
    | "GOOGLE_ACCOUNT_ENABLED"
    | "GOOGLE_BILLING_FAILED"
    | "GOOGLE_BUDGET_DEPLETED"
    | "GOOGLE_POLICY_VIOLATION"
    | "GOOGLE_STATUS_CHANGE";

export interface MetaAccountHealth {
    accountId: string;
    accountStatus: number;          // 1=active, 2=disabled, 3=unsettled
    accountStatusName: string;
    disableReason?: string;
    balance?: number;
    spendCap?: number;
    amountSpent?: number;
    spendCapPct?: number;
    spendCapAlertLevel: SpendCapAlertLevel;
    projectedCutoffDays?: number;
    avgDailySpend7d?: number;
    previousStatus?: number;
}

export interface GoogleAdsAccountHealth {
    customerId: string;
    accountStatus: string;          // "ENABLED" | "SUSPENDED" | "REMOVED" | "CANCELLED"
    canManageCampaigns: boolean;
    billingStatus?: string;         // "SETUP_COMPLETE" | "PENDING" | "SUSPENDED"
    currencyCode?: string;
    timeZone?: string;
    budgetUtilizationPct?: number;
    avgDailySpend7d?: number;
    approvalStatus?: string;
    policyViolations?: Array<{ type: string; description: string }>;
    previousStatus?: string;
}

export interface AccountHealth {
    clientId: string;
    clientName: string;

    // Platform-specific health data
    meta?: MetaAccountHealth;
    google?: GoogleAdsAccountHealth;

    lastChecked: string;
    lastAlertSent?: string;

    // ─── DEPRECATED (backward compatibility) ───
    /** @deprecated Use meta.accountId instead */
    metaAccountId?: string;
    /** @deprecated Use meta.accountStatus instead */
    accountStatus?: number;
    /** @deprecated Use meta.accountStatusName instead */
    accountStatusName?: string;
    /** @deprecated Use meta.disableReason instead */
    disableReason?: string;
    /** @deprecated Use meta.balance instead */
    balance?: number;
    /** @deprecated Use meta.spendCap instead */
    spendCap?: number;
    /** @deprecated Use meta.amountSpent instead */
    amountSpent?: number;
    /** @deprecated Use meta.spendCapPct instead */
    spendCapPct?: number;
    /** @deprecated Use meta.spendCapAlertLevel instead */
    spendCapAlertLevel?: SpendCapAlertLevel;
    /** @deprecated Use meta.projectedCutoffDays instead */
    projectedCutoffDays?: number;
    /** @deprecated Use meta.avgDailySpend7d instead */
    avgDailySpend7d?: number;
    /** @deprecated Use meta.previousStatus instead */
    previousStatus?: number;
}
