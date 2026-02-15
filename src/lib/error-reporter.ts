import { SlackService } from "./slack-service";

/**
 * Global error reporter — wraps SlackService.sendError with a simpler API.
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

    // Always log to console
    console.error(`[${source}]`, message);

    // Send to Slack #errors channel (fire-and-forget, never throw)
    try {
        await SlackService.sendError({
            source,
            message,
            stack,
            clientId: context?.clientId,
            clientName: context?.clientName,
            metadata: context?.metadata,
        });
    } catch {
        // Silently fail — never let error reporting break the app
    }
}
