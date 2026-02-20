import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { SystemEvent, CronExecution, EventSeverity } from "@/types/system-events";

/**
 * EventService — Central nervous system for observability.
 *
 * - Persists all events to `system_events` collection
 * - Rate-limits Slack notifications (same type+service+clientId: max 1 per 30 min)
 * - Provides query methods for admin dashboard
 * - Logs cron executions to `cron_executions` collection
 */
export class EventService {

    // In-memory rate limit cache: key → last Slack send timestamp
    private static rateLimitCache = new Map<string, number>();
    private static RATE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

    /**
     * Log a system event. Persists to Firestore and optionally sends to Slack.
     */
    static async log(event: Omit<SystemEvent, "id" | "timestamp">): Promise<string> {
        const fullEvent: SystemEvent = {
            ...event,
            timestamp: new Date().toISOString(),
            resolved: false,
        };

        // 1. Always persist to Firestore
        let docId = "";
        try {
            const ref = await db.collection("system_events").add(fullEvent);
            docId = ref.id;
        } catch (dbError) {
            console.error("[EventService] Failed to write to Firestore:", dbError);
        }

        // 2. Always log to console
        const prefix = event.severity === "critical" ? "🔴" : event.severity === "warning" ? "🟡" : "🔵";
        console.log(`${prefix} [${event.service}] ${event.message}`, event.clientId ? `(${event.clientId})` : "");

        // 3. Send to Slack if severity >= warning, respecting rate limit
        if (event.severity !== "info") {
            const shouldSend = this.checkRateLimit(event);
            if (shouldSend) {
                try {
                    await SlackService.sendError({
                        source: `${event.type}/${event.service}`,
                        message: event.message,
                        stack: event.rawError,
                        clientId: event.clientId,
                        clientName: event.clientName,
                        metadata: event.metadata,
                    });
                } catch {
                    // Never let Slack failure break the flow
                }
            }
        }

        return docId;
    }

    /**
     * Log a cron execution result.
     */
    static async logCronExecution(execution: Omit<CronExecution, "id">): Promise<string> {
        try {
            const ref = await db.collection("cron_executions").add(execution);
            return ref.id;
        } catch (dbError) {
            console.error("[EventService] Failed to log cron execution:", dbError);
            return "";
        }
    }

    /**
     * Query recent system events for admin dashboard.
     */
    static async getRecentEvents(options: {
        limit?: number;
        severity?: EventSeverity;
        service?: string;
    } = {}): Promise<SystemEvent[]> {
        const { limit = 50, severity, service } = options;

        let query: FirebaseFirestore.Query = db.collection("system_events")
            .orderBy("timestamp", "desc")
            .limit(limit);

        if (severity) {
            query = db.collection("system_events")
                .where("severity", "==", severity)
                .orderBy("timestamp", "desc")
                .limit(limit);
        }

        const snap = await query.get();
        const events = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemEvent));

        // Filter by service in memory if needed (avoids composite index)
        if (service) {
            return events.filter(e => e.service === service);
        }

        return events;
    }

    /**
     * Query recent cron executions for admin dashboard.
     */
    static async getRecentCronExecutions(limit: number = 30): Promise<CronExecution[]> {
        const snap = await db.collection("cron_executions")
            .orderBy("startedAt", "desc")
            .limit(limit)
            .get();

        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CronExecution));
    }

    /**
     * Mark an event as resolved.
     */
    static async resolveEvent(eventId: string): Promise<void> {
        await db.collection("system_events").doc(eventId).update({
            resolved: true,
            resolvedAt: new Date().toISOString(),
        });
    }

    /**
     * Rate limit check: returns true if we should send to Slack.
     * Same type+service+clientId combo is limited to 1 Slack message per 30 minutes.
     */
    private static checkRateLimit(event: Pick<SystemEvent, "type" | "service" | "clientId">): boolean {
        const key = `${event.type}:${event.service}:${event.clientId || "global"}`;
        const now = Date.now();
        const lastSent = this.rateLimitCache.get(key);

        if (lastSent && (now - lastSent) < this.RATE_LIMIT_MS) {
            return false;
        }

        this.rateLimitCache.set(key, now);

        // Cleanup old entries periodically (prevent memory leak in long-running processes)
        if (this.rateLimitCache.size > 500) {
            const cutoff = now - this.RATE_LIMIT_MS;
            for (const [k, v] of this.rateLimitCache.entries()) {
                if (v < cutoff) this.rateLimitCache.delete(k);
            }
        }

        return true;
    }
}
