import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { AccountHealth, SpendCapAlertLevel } from "@/types/system-events";
import { EventService } from "@/lib/event-service";
import { SlackService } from "@/lib/slack-service";
import { reportError } from "@/lib/error-reporter";

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
     * Check health of all active clients' Meta ad accounts.
     * Returns per-client results for cron logging.
     */
    static async checkAll(): Promise<Array<{
        clientId: string;
        clientName: string;
        status: string;
        error?: string;
    }>> {
        if (!META_ACCESS_TOKEN) {
            throw new Error("META_ACCESS_TOKEN not configured");
        }

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

            if (!client.metaAdAccountId) {
                results.push({ clientId, clientName: client.name, status: "skipped", error: "No metaAdAccountId" });
                continue;
            }

            try {
                await this.checkClient(clientId, client);
                results.push({ clientId, clientName: client.name, status: "success" });
            } catch (err: any) {
                reportError("Account Health Check", err, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: err.message });
            }
        }

        return results;
    }

    /**
     * Check a single client's Meta ad account health.
     */
    private static async checkClient(clientId: string, client: Client): Promise<void> {
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
            avgDailySpend7d = await this.getAvgDailySpend(clientId);

            if (avgDailySpend7d && avgDailySpend7d > 0) {
                const remaining = spendCap - amountSpent;
                projectedCutoffDays = Math.round(remaining / avgDailySpend7d);
            }
        }

        // Load previous state
        const prevDoc = await db.collection("account_health").doc(clientId).get();
        const prev = prevDoc.exists ? (prevDoc.data() as AccountHealth) : null;

        const now = new Date().toISOString();

        const health: AccountHealth = {
            clientId,
            clientName: client.name,
            metaAccountId: accountId,
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
            lastChecked: now,
            lastAlertSent: prev?.lastAlertSent,
            previousStatus: prev?.accountStatus,
        };

        // Detect state transitions and send alerts
        await this.evaluateAlerts(health, prev);

        // Persist
        await db.collection("account_health").doc(clientId).set(health);
    }

    /**
     * Get average daily spend from the last 7 days of entity rolling metrics.
     */
    private static async getAvgDailySpend(clientId: string): Promise<number | undefined> {
        try {
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
            return undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Evaluate alerts based on state transitions and spend cap levels.
     */
    private static async evaluateAlerts(health: AccountHealth, prev: AccountHealth | null): Promise<void> {
        const alerts: Array<{ type: string; severity: "info" | "warning" | "critical"; message: string }> = [];

        // 1. Account status transitions
        if (prev && prev.accountStatus !== health.accountStatus) {
            const wasActive = prev.accountStatus === 1;
            const isActive = health.accountStatus === 1;

            if (wasActive && !isActive) {
                // ACTIVE → DISABLED/UNSETTLED
                alerts.push({
                    type: "ACCOUNT_DISABLED",
                    severity: "critical",
                    message: `Cuenta Meta DESACTIVADA: ${health.accountStatusName}${health.disableReason ? ` — Razón: ${health.disableReason}` : ""}`,
                });
            } else if (!wasActive && isActive) {
                // DISABLED → ACTIVE (recovered)
                alerts.push({
                    type: "ACCOUNT_REACTIVATED",
                    severity: "info",
                    message: `Cuenta Meta REACTIVADA. Estado anterior: ${STATUS_NAMES[prev.accountStatus] || prev.accountStatus}`,
                });
            } else {
                // Other transitions (e.g., UNSETTLED → DISABLED)
                alerts.push({
                    type: "ACCOUNT_STATUS_CHANGE",
                    severity: "warning",
                    message: `Cambio de estado: ${STATUS_NAMES[prev.accountStatus] || prev.accountStatus} → ${health.accountStatusName}`,
                });
            }
        } else if (!prev && health.accountStatus !== 1) {
            // First check and account is not active
            alerts.push({
                type: "ACCOUNT_DISABLED",
                severity: "critical",
                message: `Cuenta Meta NO ACTIVA en primera verificación: ${health.accountStatusName}`,
            });
        }

        // 2. Spend cap alerts (only on level escalation)
        if (health.spendCapAlertLevel !== "safe") {
            const prevLevel = prev?.spendCapAlertLevel || "safe";
            const levels: SpendCapAlertLevel[] = ["safe", "warning", "critical", "imminent"];
            const currIdx = levels.indexOf(health.spendCapAlertLevel);
            const prevIdx = levels.indexOf(prevLevel);

            if (currIdx > prevIdx) {
                // Level escalated
                const daysMsg = health.projectedCutoffDays !== undefined
                    ? ` — ~${health.projectedCutoffDays} días restantes`
                    : "";
                alerts.push({
                    type: `SPEND_CAP_${health.spendCapAlertLevel.toUpperCase()}`,
                    severity: health.spendCapAlertLevel === "warning" ? "warning" : "critical",
                    message: `Spend Cap al ${health.spendCapPct?.toFixed(1)}% ($${health.amountSpent?.toFixed(0)} / $${health.spendCap?.toFixed(0)})${daysMsg}`,
                });
            }
        }

        // 3. Balance alerts (no funds / pending debt)
        if (health.balance !== undefined && health.balance <= 0) {
            const prevHadBalance = prev?.balance === undefined || prev.balance > 0;

            if (prevHadBalance) {
                // Transition: had funds → no funds (or first check with no balance)
                const debtMsg = health.balance < 0
                    ? ` — Deuda pendiente: $${Math.abs(health.balance).toFixed(2)}`
                    : "";
                alerts.push({
                    type: "ACCOUNT_NO_BALANCE",
                    severity: "critical",
                    message: `Sin saldo disponible en cuenta Meta${debtMsg}`,
                });
            }
        }

        // 4. Send alerts
        for (const alert of alerts) {
            // Log to EventService
            await EventService.log({
                type: "integration",
                service: "meta",
                severity: alert.severity,
                clientId: health.clientId,
                clientName: health.clientName,
                message: `[${alert.type}] ${alert.message}`,
                metadata: {
                    alertType: alert.type,
                    accountStatus: health.accountStatus,
                    spendCapPct: health.spendCapPct,
                    spendCapAlertLevel: health.spendCapAlertLevel,
                },
            });

            // Send dedicated Slack alert
            await SlackService.sendAccountHealthAlert(
                health.clientId,
                health.clientName,
                alert.type,
                alert.severity,
                alert.message,
                health
            );
        }

        // Update lastAlertSent if we sent any
        if (alerts.length > 0) {
            health.lastAlertSent = new Date().toISOString();
        }
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
