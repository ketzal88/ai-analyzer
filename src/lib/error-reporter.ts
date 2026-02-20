import { EventService } from "./event-service";
import { EventType, EventService as EventServiceType } from "@/types/system-events";

/**
 * Global error reporter — persists to system_events and sends to Slack via EventService.
 *
 * Usage:
 *   import { reportError } from "@/lib/error-reporter";
 *
 *   catch (error: any) {
 *       await reportError("API /api/sync", error, { clientId });
 *   }
 */
export async function reportError(
    source: string,
    error: any,
    context?: {
        clientId?: string;
        clientName?: string;
        metadata?: Record<string, any>;
    }
) {
    const message = error?.message || String(error);
    const stack = error?.stack;

    // Infer event type and service from source string
    const { type, service } = inferEventCategory(source);

    // Delegate to EventService (persists + rate-limited Slack)
    try {
        await EventService.log({
            type,
            service,
            severity: inferSeverity(message),
            clientId: context?.clientId,
            clientName: context?.clientName,
            message,
            rawError: stack ? stack.substring(0, 2000) : undefined,
            metadata: context?.metadata,
        });
    } catch {
        // Absolute last resort: console only
        console.error(`[${source}]`, message);
    }
}

function inferEventCategory(source: string): { type: EventType; service: EventServiceType } {
    const s = source.toLowerCase();

    if (s.includes("cron")) return { type: "cron", service: "cron" };
    if (s.includes("meta") || s.includes("permission")) return { type: "integration", service: "meta" };
    if (s.includes("firebase") || s.includes("firestore")) return { type: "infra", service: "firestore" };
    if (s.includes("slack")) return { type: "integration", service: "slack" };
    if (s.includes("gemini") || s.includes("llm") || s.includes("ai")) return { type: "integration", service: "gemini" };

    return { type: "infra", service: "cron" };
}

function inferSeverity(message: string): "info" | "warning" | "critical" {
    const m = message.toLowerCase();

    if (m.includes("permission") || m.includes("unauthorized") || m.includes("fatal")) return "critical";
    if (m.includes("failed_precondition") || m.includes("index")) return "critical";
    if (m.includes("timeout") || m.includes("rate limit") || m.includes("429")) return "warning";

    return "warning";
}
