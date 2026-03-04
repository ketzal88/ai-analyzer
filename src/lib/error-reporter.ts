import { EventService } from "./event-service";
import { EventType, EventService as EventServiceType } from "@/types/system-events";
import { NextRequest, NextResponse } from "next/server";

/**
 * Global error reporter — persists to system_events and sends to Slack via EventService.
 *
 * Usage (manual catch):
 *   import { reportError } from "@/lib/error-reporter";
 *   catch (error: any) {
 *       await reportError("API /api/sync", error, { clientId });
 *   }
 *
 * Usage (automatic wrapper for route handlers):
 *   import { withErrorReporting } from "@/lib/error-reporter";
 *   export const GET = withErrorReporting("API Performance", async (req) => {
 *       // ... handler logic
 *   });
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

    // Delegate to EventService (persists to Firestore + rate-limited Slack via SlackService.sendError)
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

/**
 * Higher-order wrapper for Next.js API route handlers.
 * Automatically catches unhandled errors and reports them to Slack + Firestore.
 *
 * Usage:
 *   export const GET = withErrorReporting("API Performance", async (req) => {
 *       const { searchParams } = new URL(req.url);
 *       const clientId = searchParams.get("clientId");
 *       // ... logic
 *       return NextResponse.json(data);
 *   });
 *
 *   // With dynamic params (e.g. /api/clients/[id]):
 *   export const PATCH = withErrorReporting("API Clients", async (req, ctx) => {
 *       const { id } = await ctx.params;
 *       // ...
 *   });
 */
type RouteHandler = (
    req: NextRequest,
    ctx?: any
) => Promise<NextResponse>;

export function withErrorReporting(source: string, handler: RouteHandler): RouteHandler {
    return async (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => {
        try {
            return await handler(req, ctx);
        } catch (error: any) {
            // Extract clientId from common query param names if available
            const url = new URL(req.url);
            const clientId = url.searchParams.get("clientId") || undefined;

            console.error(`[${source}] Unhandled error:`, error);

            await reportError(source, error, {
                clientId,
                metadata: {
                    method: req.method,
                    path: url.pathname,
                    query: url.search,
                },
            });

            return NextResponse.json(
                { error: error.message || "Internal Server Error" },
                { status: 500 }
            );
        }
    };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function inferEventCategory(source: string): { type: EventType; service: EventServiceType } {
    const s = source.toLowerCase();

    if (s.includes("cron")) return { type: "cron", service: "cron" };
    if (s.includes("meta") || s.includes("permission")) return { type: "integration", service: "meta" };
    if (s.includes("firebase") || s.includes("firestore")) return { type: "infra", service: "firestore" };
    if (s.includes("slack")) return { type: "integration", service: "slack" };
    if (s.includes("gemini") || s.includes("llm") || s.includes("ai")) return { type: "integration", service: "gemini" };
    if (s.includes("creative")) return { type: "integration", service: "meta" };
    if (s.includes("sync")) return { type: "cron", service: "cron" };

    return { type: "infra", service: "cron" };
}

function inferSeverity(message: string): "info" | "warning" | "critical" {
    const m = message.toLowerCase();

    if (m.includes("permission") || m.includes("unauthorized") || m.includes("fatal")) return "critical";
    if (m.includes("failed_precondition") || m.includes("index")) return "critical";
    if (m.includes("timeout") || m.includes("rate limit") || m.includes("429")) return "warning";

    return "warning";
}
