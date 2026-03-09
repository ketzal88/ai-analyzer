/**
 * Massive Historical Backfill Script
 *
 * Backfills ALL channel_snapshots for ALL clients from Jan 1 2025 to yesterday.
 * Handles rate limits, Firestore write budgets, and is resumable across runs.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/massive-backfill.ts
 *   npx tsx --require ./scripts/load-env.cjs scripts/massive-backfill.ts --client=abc123
 *   npx tsx --require ./scripts/load-env.cjs scripts/massive-backfill.ts --channel=META
 *   npx tsx --require ./scripts/load-env.cjs scripts/massive-backfill.ts --dry-run
 *   npx tsx --require ./scripts/load-env.cjs scripts/massive-backfill.ts --reset
 *
 * Rate Limits:
 *   - Firestore: 18K writes per run (leaves 2K for daily crons)
 *   - Klaviyo:   200 reporting calls per run (leaves 25 for daily crons)
 *   - GA4:       900 queries per run (leaves 100 for daily crons)
 *
 * Progress is saved to Firestore (backfill_progress/massive_2025_2026).
 * Re-run the script to resume where it left off.
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";

// ── Config ──────────────────────────────────────────────────────
const START_DATE = "2025-01-01";
const PROGRESS_DOC = "backfill_progress/massive_2025_2026";
const MAX_WRITES_PER_RUN = 18_000;
const MAX_KLAVIYO_CALLS_PER_RUN = 200;
const MAX_GA4_QUERIES_PER_RUN = 900;

// Channel processing order (fastest → slowest)
const CHANNEL_PRIORITY: BackfillChannel[] = ["META", "GOOGLE", "GA4", "ECOMMERCE", "EMAIL"];

type BackfillChannel = "META" | "GOOGLE" | "GA4" | "ECOMMERCE" | "EMAIL";

interface TaskProgress {
    status: "pending" | "in_progress" | "completed" | "failed";
    lastCompletedMonth?: string; // "2025-06" — resume from next month
    daysWritten: number;
    error?: string;
    completedAt?: string;
}

interface BackfillProgress {
    startedAt: string;
    lastRunAt: string;
    totalWritesUsed: number;
    tasks: Record<string, TaskProgress>;
}

interface Budget {
    writes: number;
    klaviyoCalls: number;
    ga4Queries: number;
}

// ── CLI Args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const filterClient = args.find(a => a.startsWith("--client="))?.split("=")[1];
const filterChannel = args.find(a => a.startsWith("--channel="))?.split("=")[1]?.toUpperCase() as BackfillChannel | undefined;
const isDryRun = args.includes("--dry-run");
const isReset = args.includes("--reset");

// ── Helpers ─────────────────────────────────────────────────────
function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
}

function generateMonthRanges(start: string, end: string): Array<{ start: string; end: string; label: string }> {
    const ranges: Array<{ start: string; end: string; label: string }> = [];
    const startDate = new Date(start + "T12:00:00Z");
    const endDate = new Date(end + "T12:00:00Z");

    const current = new Date(startDate);
    while (current <= endDate) {
        const year = current.getUTCFullYear();
        const month = current.getUTCMonth();
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEnd = new Date(Date.UTC(year, month + 1, 0)); // last day of month

        const rangeStart = monthStart < startDate ? start : monthStart.toISOString().split("T")[0];
        const rangeEnd = monthEnd > endDate ? end : monthEnd.toISOString().split("T")[0];
        const label = `${year}-${String(month + 1).padStart(2, "0")}`;

        ranges.push({ start: rangeStart, end: rangeEnd, label });
        current.setUTCMonth(current.getUTCMonth() + 1);
    }
    return ranges;
}

function countDaysInRange(start: string, end: string): number {
    const s = new Date(start + "T12:00:00Z");
    const e = new Date(end + "T12:00:00Z");
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ── Progress Management ─────────────────────────────────────────
async function loadProgress(): Promise<BackfillProgress> {
    const doc = await db.doc(PROGRESS_DOC).get();
    if (doc.exists) return doc.data() as BackfillProgress;
    return {
        startedAt: new Date().toISOString(),
        lastRunAt: new Date().toISOString(),
        totalWritesUsed: 0,
        tasks: {},
    };
}

async function saveProgress(progress: BackfillProgress): Promise<void> {
    await db.doc(PROGRESS_DOC).set(progress, { merge: true });
}

// ── Channel Processors ─────────────────────────────────────────

async function processMetaMonth(clientId: string, adAccountId: string, monthStart: string, monthEnd: string): Promise<number> {
    const { ChannelBackfillService } = await import("@/lib/channel-backfill-service");
    // Meta backfill handles its own batch writes + zero-fill
    const result = await (ChannelBackfillService as any).backfillMetaRange(clientId, adAccountId, monthStart, monthEnd);
    return result.daysWritten || 0;
}

async function processGoogleMonth(clientId: string, customerId: string, monthStart: string, monthEnd: string): Promise<number> {
    const { GoogleAdsService } = await import("@/lib/google-ads-service");
    const { daysWritten } = await GoogleAdsService.syncToChannelSnapshots(clientId, customerId, monthStart, monthEnd);
    return daysWritten;
}

async function processGA4Month(clientId: string, propertyId: string, monthStart: string, monthEnd: string): Promise<number> {
    const { GA4Service } = await import("@/lib/ga4-service");
    const { daysWritten } = await GA4Service.syncToChannelSnapshots(clientId, propertyId, monthStart, monthEnd);
    return daysWritten;
}

async function processEcommerceMonth(clientId: string, client: Client, monthStart: string, monthEnd: string): Promise<number> {
    if (client.integraciones?.ecommerce === "shopify") {
        const { ShopifyService } = await import("@/lib/shopify-service");
        const { daysWritten } = await ShopifyService.syncToChannelSnapshots(clientId, client.shopifyStoreDomain!, client.shopifyAccessToken!, monthStart, monthEnd);
        return daysWritten;
    }
    if (client.integraciones?.ecommerce === "tiendanube") {
        const { TiendaNubeService } = await import("@/lib/tiendanube-service");
        const { daysWritten } = await TiendaNubeService.syncToChannelSnapshots(clientId, client.tiendanubeStoreId!, client.tiendanubeAccessToken!, monthStart, monthEnd);
        return daysWritten;
    }
    if (client.integraciones?.ecommerce === "woocommerce") {
        const { WooCommerceService } = await import("@/lib/woocommerce-service");
        const { daysWritten } = await WooCommerceService.syncToChannelSnapshots(clientId, client.woocommerceStoreDomain!, client.woocommerceConsumerKey!, client.woocommerceConsumerSecret!, monthStart, monthEnd);
        return daysWritten;
    }
    return 0;
}

async function processEmailMonth(clientId: string, client: Client, monthStart: string, monthEnd: string): Promise<number> {
    if (client.integraciones?.email === "perfit") {
        const { PerfitService } = await import("@/lib/perfit-service");
        const { daysWritten } = await PerfitService.syncToChannelSnapshots(clientId, client.perfitApiKey!, monthStart, monthEnd);
        return daysWritten;
    }
    if (client.integraciones?.email === "klaviyo") {
        const { KlaviyoService } = await import("@/lib/klaviyo-service");
        const result = await KlaviyoService.syncToChannelSnapshots(clientId, client.klaviyoApiKey!, monthStart, monthEnd);
        return result.daysWritten || 1; // Klaviyo returns 1 aggregated snapshot per range
    }
    return 0;
}

// ── Task Builder ────────────────────────────────────────────────

interface BackfillTask {
    clientId: string;
    clientName: string;
    channel: BackfillChannel;
    client: Client;
    taskKey: string;
    emailProvider?: string;
}

function buildTaskList(clients: Array<{ id: string; client: Client }>): BackfillTask[] {
    const tasks: BackfillTask[] = [];

    for (const channel of CHANNEL_PRIORITY) {
        for (const { id, client } of clients) {
            // Apply channel filter
            if (filterChannel && channel !== filterChannel) continue;

            const taskKey = `${id}__${channel}`;

            switch (channel) {
                case "META":
                    if (client.integraciones?.meta && client.metaAdAccountId) {
                        tasks.push({ clientId: id, clientName: client.name, channel, client, taskKey });
                    }
                    break;
                case "GOOGLE":
                    if (client.integraciones?.google && client.googleAdsId) {
                        tasks.push({ clientId: id, clientName: client.name, channel, client, taskKey });
                    }
                    break;
                case "GA4":
                    if (client.integraciones?.ga4 && client.ga4PropertyId) {
                        tasks.push({ clientId: id, clientName: client.name, channel, client, taskKey });
                    }
                    break;
                case "ECOMMERCE":
                    if (client.integraciones?.ecommerce) {
                        tasks.push({ clientId: id, clientName: client.name, channel, client, taskKey });
                    }
                    break;
                case "EMAIL":
                    if (client.integraciones?.email) {
                        tasks.push({
                            clientId: id, clientName: client.name, channel, client, taskKey,
                            emailProvider: client.integraciones.email,
                        });
                    }
                    break;
            }
        }
    }

    return tasks;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
    const endDate = getYesterday();
    const monthRanges = generateMonthRanges(START_DATE, endDate);

    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║          MASSIVE HISTORICAL BACKFILL             ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(`  Range: ${START_DATE} → ${endDate} (${countDaysInRange(START_DATE, endDate)} days)`);
    console.log(`  Months: ${monthRanges.length}`);
    console.log(`  Budgets: ${MAX_WRITES_PER_RUN} writes, ${MAX_KLAVIYO_CALLS_PER_RUN} Klaviyo calls, ${MAX_GA4_QUERIES_PER_RUN} GA4 queries`);
    if (filterClient) console.log(`  Filter: client=${filterClient}`);
    if (filterChannel) console.log(`  Filter: channel=${filterChannel}`);
    if (isDryRun) console.log(`  Mode: DRY RUN (no writes)`);
    console.log("");

    // Handle reset
    if (isReset) {
        console.log("Resetting progress...");
        await db.doc(PROGRESS_DOC).delete();
        console.log("Done. Run again without --reset to start fresh.");
        return;
    }

    // Load progress
    const progress = await loadProgress();
    const budget: Budget = {
        writes: MAX_WRITES_PER_RUN,
        klaviyoCalls: MAX_KLAVIYO_CALLS_PER_RUN,
        ga4Queries: MAX_GA4_QUERIES_PER_RUN,
    };

    // Fetch clients
    const clientsSnap = await db.collection("clients").where("active", "==", true).get();
    let clients = clientsSnap.docs.map(doc => ({ id: doc.id, client: { id: doc.id, ...doc.data() } as Client }));

    if (filterClient) {
        clients = clients.filter(c => c.id === filterClient);
        if (clients.length === 0) {
            console.error(`Client ${filterClient} not found or inactive.`);
            return;
        }
    }

    console.log(`Found ${clients.length} active client(s)\n`);

    // Build tasks
    const tasks = buildTaskList(clients);
    const pendingTasks = tasks.filter(t => progress.tasks[t.taskKey]?.status !== "completed");
    const completedTasks = tasks.filter(t => progress.tasks[t.taskKey]?.status === "completed");

    console.log(`Tasks: ${tasks.length} total, ${completedTasks.length} completed, ${pendingTasks.length} pending\n`);

    if (isDryRun) {
        console.log("── Task List (DRY RUN) ──────────────────────────\n");
        for (const task of tasks) {
            const status = progress.tasks[task.taskKey]?.status || "pending";
            const icon = status === "completed" ? "✓" : status === "failed" ? "✗" : "○";
            const extra = task.emailProvider ? ` [${task.emailProvider}]` : "";
            console.log(`  ${icon} ${task.channel.padEnd(10)} ${task.clientName}${extra} (${status})`);
        }

        const estimatedWrites = pendingTasks.length * countDaysInRange(START_DATE, endDate);
        const klaviyoTasks = pendingTasks.filter(t => t.emailProvider === "klaviyo");
        const ga4Tasks = pendingTasks.filter(t => t.channel === "GA4");
        const estimatedKlaviyoCalls = klaviyoTasks.length * monthRanges.length * 2;
        const estimatedGA4Queries = ga4Tasks.length * monthRanges.length * 5;

        console.log(`\n── Estimates ──────────────────────────────────────`);
        console.log(`  Writes:        ~${estimatedWrites} (budget: ${MAX_WRITES_PER_RUN}/run)`);
        console.log(`  Klaviyo calls: ~${estimatedKlaviyoCalls} (budget: ${MAX_KLAVIYO_CALLS_PER_RUN}/run)`);
        console.log(`  GA4 queries:   ~${estimatedGA4Queries} (budget: ${MAX_GA4_QUERIES_PER_RUN}/run)`);
        console.log(`  Est. runs:     ${Math.ceil(estimatedWrites / MAX_WRITES_PER_RUN)}`);
        if (klaviyoTasks.length > 0) {
            console.log(`  Klaviyo time:  ~${Math.ceil(estimatedKlaviyoCalls * 31 / 60)} min`);
        }
        return;
    }

    // Process tasks
    let tasksCompleted = 0;
    let tasksFailed = 0;
    let tasksSkipped = 0;

    for (const task of pendingTasks) {
        // Budget checks
        if (budget.writes <= 0) {
            console.log(`\n⚠️  Write budget exhausted. Run again tomorrow to continue.`);
            break;
        }

        if (task.channel === "GA4" && budget.ga4Queries <= 0) {
            console.log(`  ⏭  Skipping GA4 for ${task.clientName} — GA4 query budget exhausted`);
            tasksSkipped++;
            continue;
        }

        if (task.emailProvider === "klaviyo" && budget.klaviyoCalls <= 0) {
            console.log(`  ⏭  Skipping Klaviyo for ${task.clientName} — Klaviyo call budget exhausted`);
            tasksSkipped++;
            continue;
        }

        const extra = task.emailProvider ? ` [${task.emailProvider}]` : "";
        console.log(`\n── ${task.channel}${extra}: ${task.clientName} ──────────────────────`);

        // Initialize task progress
        if (!progress.tasks[task.taskKey]) {
            progress.tasks[task.taskKey] = { status: "pending", daysWritten: 0 };
        }
        progress.tasks[task.taskKey].status = "in_progress";

        const lastMonth = progress.tasks[task.taskKey].lastCompletedMonth;
        let taskDaysWritten = progress.tasks[task.taskKey].daysWritten || 0;
        let taskFailed = false;

        for (const month of monthRanges) {
            // Skip already-completed months
            if (lastMonth && month.label <= lastMonth) continue;

            // Budget check mid-task
            if (budget.writes <= 0) {
                console.log(`  ⚠️  Write budget exhausted mid-task.`);
                break;
            }

            const estimatedDays = countDaysInRange(month.start, month.end);
            process.stdout.write(`  ${month.label} (${month.start} → ${month.end})... `);

            try {
                let daysWritten = 0;

                switch (task.channel) {
                    case "META":
                        daysWritten = await processMetaMonth(task.clientId, task.client.metaAdAccountId!, month.start, month.end);
                        break;
                    case "GOOGLE":
                        daysWritten = await processGoogleMonth(task.clientId, task.client.googleAdsId!, month.start, month.end);
                        break;
                    case "GA4":
                        daysWritten = await processGA4Month(task.clientId, task.client.ga4PropertyId!, month.start, month.end);
                        budget.ga4Queries -= 5; // 5 parallel queries per sync
                        break;
                    case "ECOMMERCE":
                        daysWritten = await processEcommerceMonth(task.clientId, task.client, month.start, month.end);
                        break;
                    case "EMAIL":
                        daysWritten = await processEmailMonth(task.clientId, task.client, month.start, month.end);
                        if (task.emailProvider === "klaviyo") {
                            budget.klaviyoCalls -= 2; // 2 reporting calls per sync (campaigns + flows)
                        }
                        break;
                }

                taskDaysWritten += daysWritten;
                budget.writes -= daysWritten || estimatedDays;
                progress.tasks[task.taskKey].lastCompletedMonth = month.label;
                progress.tasks[task.taskKey].daysWritten = taskDaysWritten;
                progress.totalWritesUsed += daysWritten || estimatedDays;

                console.log(`${daysWritten} days`);

                // Save progress after each month
                progress.lastRunAt = new Date().toISOString();
                await saveProgress(progress);

            } catch (err: any) {
                console.log(`FAILED: ${err.message}`);
                progress.tasks[task.taskKey].status = "failed";
                progress.tasks[task.taskKey].error = err.message;
                await saveProgress(progress);
                taskFailed = true;
                tasksFailed++;
                break;
            }
        }

        if (!taskFailed && budget.writes > 0) {
            progress.tasks[task.taskKey].status = "completed";
            progress.tasks[task.taskKey].completedAt = new Date().toISOString();
            progress.tasks[task.taskKey].daysWritten = taskDaysWritten;
            await saveProgress(progress);
            tasksCompleted++;
            console.log(`  ✓ Complete (${taskDaysWritten} days total)`);
        }
    }

    // Summary
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║                    SUMMARY                       ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(`  Completed this run: ${tasksCompleted}`);
    console.log(`  Failed this run:    ${tasksFailed}`);
    console.log(`  Skipped (budget):   ${tasksSkipped}`);
    console.log(`  Budget remaining:   ${budget.writes} writes, ${budget.klaviyoCalls} Klaviyo, ${budget.ga4Queries} GA4`);

    const allTaskKeys = tasks.map(t => t.taskKey);
    const remaining = allTaskKeys.filter(k => progress.tasks[k]?.status !== "completed");
    if (remaining.length > 0) {
        console.log(`\n  ⚠️  ${remaining.length} tasks remaining. Run again to continue.`);
        console.log(`     npx tsx --require ./scripts/load-env.cjs scripts/massive-backfill.ts`);
    } else {
        console.log(`\n  ✅ ALL TASKS COMPLETED!`);
    }
}

main().catch(err => {
    console.error("\nFatal error:", err);
    process.exit(1);
});
