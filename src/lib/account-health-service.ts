import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { AccountHealth, SpendCapAlertLevel, MetaAccountHealth, GoogleAdsAccountHealth } from "@/types/system-events";
import { EventService } from "@/lib/event-service";
import { SlackService } from "@/lib/slack-service";
import { reportError } from "@/lib/error-reporter";
import { GoogleAdsService } from "@/lib/google-ads-service";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

/**
 * Meta account_status values:
 * 1 = ACTIVE, 2 = DISABLED, 3 = UNSETTLED, 7 = PENDING_RISK_REVIEW,
 * 8 = PENDING_SETTLEMENT, 9 = IN_GRACE_PERIOD, 100 = PENDING_CLOSURE, 101 = CLOSED
 */
const STATUS_NAMES: Record<number, string> = {
    1: "ACTIVE",
    2: "DISABLED",
    3: "UNSETTLED",
    7: "PENDING_RISK_REVIEW",
    8: "PENDING_SETTLEMENT",
    9: "IN_GRACE_PERIOD",
    100: "PENDING_CLOSURE",
    101: "CLOSED",
};

export class AccountHealthService {

    /**
     * Check health of all active clients' ad accounts (Meta + Google Ads).
     * Returns per-client results for cron logging.
     */
    static async checkAll(): Promise<Array<{
        clientId: string;
        clientName: string;
        status: string;
        error?: string;
    }>> {
        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{
            clientId: string;
            clientName: string;
            status: string;
            error?: string;
        }> = [];

        for (const doc of clientsSnap.docs) {
            const client = doc.data() as Client;
            const clientId = doc.id;

            const hasMeta = !!client.metaAdAccountId && !!META_ACCESS_TOKEN;
            const hasGoogle = !!client.googleAdsCustomerId;

            if (!hasMeta && !hasGoogle) {
                results.push({
                    clientId,
                    clientName: client.name,
                    status: "skipped",
                    error: "No ad accounts configured"
                });
                continue;
            }

            try {
                // Load previous health state
                const prevDoc = await db.collection("account_health").doc(clientId).get();
                const prev = prevDoc.exists ? (prevDoc.data() as AccountHealth) : null;

                const now = new Date().toISOString();
                const health: AccountHealth = {
                    clientId,
                    clientName: client.name,
                    lastChecked: now,
                    lastAlertSent: prev?.lastAlertSent,
                };

                // Check Meta
                if (hasMeta) {
                    const metaHealth = await this.checkMetaAccount(clientId, client, prev?.meta);
                    health.meta = metaHealth;
                }

                // Check Google Ads
                if (hasGoogle) {
                    const googleHealth = await this.checkGoogleAdsAccount(clientId, client, prev?.google);
                    health.google = googleHealth;
                }

                // Evaluate and send alerts
                await this.evaluateAlerts(health, prev);

                // Persist
                await db.collection("account_health").doc(clientId).set(health);

                results.push({ clientId, clientName: client.name, status: "success" });
            } catch (err: any) {
                reportError("Account Health Check", err, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: err.message });
            }
        }

        return results;
    }

    // ═════════════════════════════════════════════════════════
    //  META ADS HEALTH CHECK
    // ═════════════════════════════════════════════════════════

    /**
     * Check a single client's Meta ad account health.
     */
    private static async checkMetaAccount(
        clientId: string,
        client: Client,
        prev?: MetaAccountHealth
    ): Promise<MetaAccountHealth> {
        const accountId = client.metaAdAccountId!.startsWith("act_")
            ? client.metaAdAccountId!
            : `act_${client.metaAdAccountId}`;

        // Fetch account info from Meta API
        const fields = "account_status,disable_reason,balance,spend_cap,amount_spent";
        const url = `https://graph.facebook.com/${META_API_VERSION}/${accountId}?fields=${fields}&access_token=${META_ACCESS_TOKEN}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            throw new Error(`Meta API: ${data.error.message || JSON.stringify(data.error)}`);
        }

        const accountStatus = data.account_status || 1;
        const balance = data.balance ? parseFloat(data.balance) / 100 : undefined; // Meta returns in cents
        const spendCap = data.spend_cap ? parseFloat(data.spend_cap) / 100 : undefined;
        const amountSpent = data.amount_spent ? parseFloat(data.amount_spent) / 100 : undefined;

        // Calculate spend cap metrics
        let spendCapPct: number | undefined;
        let spendCapAlertLevel: SpendCapAlertLevel = "safe";
        let projectedCutoffDays: number | undefined;
        let avgDailySpend7d: number | undefined;

        if (spendCap && spendCap > 0 && amountSpent !== undefined) {
            spendCapPct = (amountSpent / spendCap) * 100;

            if (spendCapPct >= 95) spendCapAlertLevel = "imminent";
            else if (spendCapPct >= 85) spendCapAlertLevel = "critical";
            else if (spendCapPct >= 70) spendCapAlertLevel = "warning";
            else spendCapAlertLevel = "safe";

            // Get avg daily spend from rolling metrics for projection
            avgDailySpend7d = await this.getAvgDailySpend(clientId, "meta");

            if (avgDailySpend7d && avgDailySpend7d > 0) {
                const remaining = spendCap - amountSpent;
                projectedCutoffDays = Math.round(remaining / avgDailySpend7d);
            }
        }

        return {
            accountId,
            accountStatus,
            accountStatusName: STATUS_NAMES[accountStatus] || `UNKNOWN_${accountStatus}`,
            disableReason: data.disable_reason,
            balance,
            spendCap,
            amountSpent,
            spendCapPct,
            spendCapAlertLevel,
            projectedCutoffDays,
            avgDailySpend7d,
            previousStatus: prev?.accountStatus,
        };
    }

    // ═════════════════════════════════════════════════════════
    //  GOOGLE ADS HEALTH CHECK
    // ═════════════════════════════════════════════════════════

    /**
     * Check a single client's Google Ads account health.
     */
    private static async checkGoogleAdsAccount(
        clientId: string,
        client: Client,
        prev?: GoogleAdsAccountHealth
    ): Promise<GoogleAdsAccountHealth> {
        try {
            // Fetch account info via Google Ads API
            const customerId = client.googleAdsCustomerId!;
            const accountInfo = await GoogleAdsService.getAccountInfo(customerId);

            const avgDailySpend7d = await this.getAvgDailySpend(clientId, "google");

            return {
                customerId,
                accountStatus: accountInfo.status,
                canManageCampaigns: accountInfo.canManageCampaigns,
                billingStatus: accountInfo.billingStatus,
                currencyCode: accountInfo.currencyCode,
                timeZone: accountInfo.timeZone,
                budgetUtilizationPct: accountInfo.budgetUtilizationPct,
                avgDailySpend7d,
                approvalStatus: accountInfo.approvalStatus,
                policyViolations: accountInfo.policyViolations,
                previousStatus: prev?.accountStatus,
            };
        } catch (err: any) {
            throw new Error(`Google Ads API: ${err.message}`);
        }
    }

    /**
     * Get average daily spend from the last 7 days.
     */
    private static async getAvgDailySpend(clientId: string, platform: "meta" | "google"): Promise<number | undefined> {
        try {
            if (platform === "meta") {
                // From Meta entity_rolling_metrics
                const snap = await db.collection("entity_rolling_metrics")
                    .where("clientId", "==", clientId)
                    .where("level", "==", "account")
                    .limit(1)
                    .get();

                if (snap.empty) return undefined;

                const data = snap.docs[0].data();
                const spend7d = data.rolling?.spend_7d;
                if (spend7d && spend7d > 0) {
                    return spend7d / 7;
                }
            } else if (platform === "google") {
                // From Google channel_snapshots (last 7 days)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const startDate = sevenDaysAgo.toISOString().split("T")[0];

                const snap = await db.collection("channel_snapshots")
                    .where("clientId", "==", clientId)
                    .where("channel", "==", "GOOGLE")
                    .where("date", ">=", startDate)
                    .get();

                if (snap.empty) return undefined;

                const totalSpend = snap.docs.reduce((sum, doc) => {
                    const metrics = doc.data().metrics;
                    return sum + (metrics?.spend || 0);
                }, 0);

                return totalSpend / 7;
            }

            return undefined;
        } catch {
            return undefined;
        }
    }

    // ═════════════════════════════════════════════════════════
    //  ALERT EVALUATION & SENDING
    // ═════════════════════════════════════════════════════════

    /**
     * Evaluate alerts based on state transitions and thresholds.
     */
    private static async evaluateAlerts(health: AccountHealth, prev: AccountHealth | null): Promise<void> {
        const alerts: Array<{
            type: string;
            severity: "info" | "warning" | "critical";
            message: string;
            platform: "meta" | "google";
        }> = [];

        // ── Meta Alerts ──
        if (health.meta) {
            const metaAlerts = this.evaluateMetaAlerts(health, prev);
            alerts.push(...metaAlerts.map(a => ({ ...a, platform: "meta" as const })));
        }

        // ── Google Ads Alerts ──
        if (health.google) {
            const googleAlerts = this.evaluateGoogleAdsAlerts(health, prev);
            alerts.push(...googleAlerts.map(a => ({ ...a, platform: "google" as const })));
        }

        // ── Send Alerts ──
        for (const alert of alerts) {
            // Log to EventService
            await EventService.log({
                type: "integration",
                service: alert.platform === "meta" ? "meta" : "google_ads",
                severity: alert.severity,
                clientId: health.clientId,
                clientName: health.clientName,
                message: `[${alert.type}] ${alert.message}`,
                metadata: {
                    alertType: alert.type,
                    platform: alert.platform,
                },
            }, { skipSlackError: true });

            // Send dedicated Slack alert
            await SlackService.sendAccountHealthAlert(
                health.clientId,
                health.clientName,
                alert.type,
                alert.severity,
                alert.message,
                health,
                alert.platform
            );
        }

        // Update lastAlertSent if we sent any
        if (alerts.length > 0) {
            health.lastAlertSent = new Date().toISOString();
        }
    }

    /**
     * Evaluate Meta-specific alerts.
     */
    private static evaluateMetaAlerts(
        health: AccountHealth,
        prev: AccountHealth | null
    ): Array<{ type: string; severity: "info" | "warning" | "critical"; message: string }> {
        const alerts: Array<{ type: string; severity: "info" | "warning" | "critical"; message: string }> = [];
        const meta = health.meta!;
        const prevMeta = prev?.meta;

        // 1. Account status transitions
        if (prevMeta && prevMeta.accountStatus !== meta.accountStatus) {
            const wasActive = prevMeta.accountStatus === 1;
            const isActive = meta.accountStatus === 1;

            if (wasActive && !isActive) {
                // ACTIVE → DISABLED/UNSETTLED
                alerts.push({
                    type: "ACCOUNT_DISABLED",
                    severity: "critical",
                    message: `Cuenta Meta DESACTIVADA: ${meta.accountStatusName}${meta.disableReason ? ` — Razón: ${meta.disableReason}` : ""}`,
                });
            } else if (!wasActive && isActive) {
                // DISABLED → ACTIVE (recovered)
                alerts.push({
                    type: "ACCOUNT_REACTIVATED",
                    severity: "info",
                    message: `Cuenta Meta REACTIVADA. Estado anterior: ${STATUS_NAMES[prevMeta.accountStatus] || prevMeta.accountStatus}`,
                });
            } else {
                // Other transitions
                alerts.push({
                    type: "ACCOUNT_STATUS_CHANGE",
                    severity: "warning",
                    message: `Cambio de estado: ${STATUS_NAMES[prevMeta.accountStatus] || prevMeta.accountStatus} → ${meta.accountStatusName}`,
                });
            }
        } else if (!prevMeta && meta.accountStatus !== 1) {
            // First check and account is not active
            alerts.push({
                type: "ACCOUNT_DISABLED",
                severity: "critical",
                message: `Cuenta Meta NO ACTIVA en primera verificación: ${meta.accountStatusName}`,
            });
        }

        // 2. Spend cap alerts (only on level escalation)
        if (meta.spendCapAlertLevel !== "safe") {
            const prevLevel = prevMeta?.spendCapAlertLevel || "safe";
            const levels: SpendCapAlertLevel[] = ["safe", "warning", "critical", "imminent"];
            const currIdx = levels.indexOf(meta.spendCapAlertLevel);
            const prevIdx = levels.indexOf(prevLevel);

            if (currIdx > prevIdx) {
                // Level escalated
                const daysMsg = meta.projectedCutoffDays !== undefined
                    ? ` — ~${meta.projectedCutoffDays} días restantes`
                    : "";
                alerts.push({
                    type: `SPEND_CAP_${meta.spendCapAlertLevel.toUpperCase()}`,
                    severity: meta.spendCapAlertLevel === "warning" ? "warning" : "critical",
                    message: `Spend Cap al ${meta.spendCapPct?.toFixed(1)}% ($${meta.amountSpent?.toFixed(0)} / $${meta.spendCap?.toFixed(0)})${daysMsg}`,
                });
            }
        }

        // 3. Balance alerts (no funds / pending debt)
        if (meta.balance !== undefined && meta.balance <= 0) {
            const prevHadBalance = !prevMeta?.balance || prevMeta.balance > 0;

            if (prevHadBalance) {
                // Transition: had funds → no funds
                const debtMsg = meta.balance < 0
                    ? ` — Deuda pendiente: $${Math.abs(meta.balance).toFixed(2)}`
                    : "";
                alerts.push({
                    type: "ACCOUNT_NO_BALANCE",
                    severity: "critical",
                    message: `Sin saldo disponible en cuenta Meta${debtMsg}`,
                });
            }
        }

        return alerts;
    }

    /**
     * Evaluate Google Ads-specific alerts.
     */
    private static evaluateGoogleAdsAlerts(
        health: AccountHealth,
        prev: AccountHealth | null
    ): Array<{ type: string; severity: "info" | "warning" | "critical"; message: string }> {
        const alerts: Array<{ type: string; severity: "info" | "warning" | "critical"; message: string }> = [];
        const google = health.google!;
        const prevGoogle = prev?.google;

        // 1. Account status transitions
        if (prevGoogle && prevGoogle.accountStatus !== google.accountStatus) {
            const wasEnabled = prevGoogle.accountStatus === "ENABLED";
            const isEnabled = google.accountStatus === "ENABLED";

            if (wasEnabled && !isEnabled) {
                // ENABLED → SUSPENDED/REMOVED
                alerts.push({
                    type: "GOOGLE_ACCOUNT_SUSPENDED",
                    severity: "critical",
                    message: `Cuenta Google Ads SUSPENDIDA: ${google.accountStatus}`,
                });
            } else if (!wasEnabled && isEnabled) {
                // SUSPENDED → ENABLED (recovered)
                alerts.push({
                    type: "GOOGLE_ACCOUNT_ENABLED",
                    severity: "info",
                    message: `Cuenta Google Ads REACTIVADA. Estado anterior: ${prevGoogle.accountStatus}`,
                });
            } else {
                // Other transitions
                alerts.push({
                    type: "GOOGLE_STATUS_CHANGE",
                    severity: "warning",
                    message: `Cambio de estado Google Ads: ${prevGoogle.accountStatus} → ${google.accountStatus}`,
                });
            }
        } else if (!prevGoogle && google.accountStatus !== "ENABLED") {
            // First check and account is not enabled
            alerts.push({
                type: "GOOGLE_ACCOUNT_SUSPENDED",
                severity: "critical",
                message: `Cuenta Google Ads NO ACTIVA en primera verificación: ${google.accountStatus}`,
            });
        }

        // 2. Billing alerts
        if (google.billingStatus && google.billingStatus !== "SETUP_COMPLETE") {
            const prevBillingOk = !prevGoogle?.billingStatus || prevGoogle.billingStatus === "SETUP_COMPLETE";

            if (prevBillingOk) {
                alerts.push({
                    type: "GOOGLE_BILLING_FAILED",
                    severity: "critical",
                    message: `Problema de pago en Google Ads: ${google.billingStatus}`,
                });
            }
        }

        // 3. Budget depletion (if available)
        if (google.budgetUtilizationPct !== undefined && google.budgetUtilizationPct >= 90) {
            const prevBudgetPct = prevGoogle?.budgetUtilizationPct || 0;

            if (prevBudgetPct < 90) {
                alerts.push({
                    type: "GOOGLE_BUDGET_DEPLETED",
                    severity: "critical",
                    message: `Presupuesto Google Ads casi agotado: ${google.budgetUtilizationPct.toFixed(1)}%`,
                });
            }
        }

        // 4. Policy violations
        if (google.policyViolations && google.policyViolations.length > 0) {
            const prevViolationsCount = prevGoogle?.policyViolations?.length || 0;

            if (google.policyViolations.length > prevViolationsCount) {
                const newViolations = google.policyViolations.slice(prevViolationsCount);
                alerts.push({
                    type: "GOOGLE_POLICY_VIOLATION",
                    severity: "warning",
                    message: `Nuevas violaciones de políticas en Google Ads: ${newViolations.map(v => v.type).join(", ")}`,
                });
            }
        }

        return alerts;
    }

    /**
     * Get all account health records for admin dashboard.
     */
    static async getAll(): Promise<AccountHealth[]> {
        const snap = await db.collection("account_health")
            .orderBy("lastChecked", "desc")
            .get();

        return snap.docs.map(d => d.data() as AccountHealth);
    }
}
