/**
 * Explore Klaviyo API to discover available metrics, valid statistics, etc.
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/explore-klaviyo-api.ts
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";

const BASE_URL = "https://a.klaviyo.com/api";
const REVISION = "2025-04-15";

async function findClient(): Promise<{ id: string; client: Client }> {
    const snap = await db.collection("clients").where("active", "==", true).get();
    for (const doc of snap.docs) {
        const client = doc.data() as Client;
        if (client.klaviyoApiKey && client.integraciones?.email === "klaviyo") {
            return { id: doc.id, client };
        }
    }
    throw new Error("No client with klaviyoApiKey found");
}

async function klaviyoFetch(url: string, apiKey: string, options: { method?: string; body?: any } = {}) {
    const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
            "Authorization": `Klaviyo-API-Key ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "revision": REVISION,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`  HTTP ${response.status}: ${text.substring(0, 500)}`);
        return null;
    }
    return response.json();
}

async function main() {
    const { id, client } = await findClient();
    const apiKey = client.klaviyoApiKey!;
    console.log(`Client: ${client.name} (${id})\n`);

    // 1. List all metrics to find IDs
    console.log("=== METRICS ===");
    const metricsResult = await klaviyoFetch(`${BASE_URL}/metrics`, apiKey);
    if (metricsResult) {
        const metrics = metricsResult.data || [];
        console.log(`Found ${metrics.length} metrics:\n`);
        for (const m of metrics) {
            const name = m.attributes?.name || "";
            const integration = m.attributes?.integration?.name || "custom";
            console.log(`  ${m.id} | ${name} | ${integration}`);
        }

        // Find "Placed Order" metric for conversion_metric_id
        const placedOrder = metrics.find((m: any) => m.attributes?.name?.toLowerCase().includes("placed order"));
        if (placedOrder) {
            console.log(`\n*** Placed Order metric ID: ${placedOrder.id} ***`);
        }
    }

    // 2. Try campaign-values-report with minimal stats
    console.log("\n\n=== CAMPAIGN VALUES REPORT (minimal test) ===");

    // Try with known-good stats first
    const testStats = [
        ["recipients", "opens", "open_rate", "clicks", "click_rate"],
        ["delivered", "bounced", "bounce_rate"],
        ["unsubscribes", "unsubscribe_rate"],
        ["conversion_value", "conversions", "average_order_value"],
        ["revenue_per_recipient"],
    ];

    // Find a conversion metric ID
    const placedOrder = (metricsResult?.data || []).find((m: any) =>
        m.attributes?.name?.toLowerCase().includes("placed order")
    );
    const convMetricId = placedOrder?.id || "UNKNOWN";
    console.log(`Using conversion_metric_id: ${convMetricId}\n`);

    for (const stats of testStats) {
        console.log(`Testing stats: [${stats.join(", ")}]`);
        const result = await klaviyoFetch(`${BASE_URL}/campaign-values-reports/`, apiKey, {
            method: "POST",
            body: {
                data: {
                    type: "campaign-values-report",
                    attributes: {
                        timeframe: { key: "last_30_days" },
                        conversion_metric_id: convMetricId,
                        statistics: stats,
                    },
                },
            },
        });
        if (result) {
            const results = result.data?.attributes?.results || [];
            console.log(`  OK! ${results.length} results`);
            if (results.length > 0) {
                console.log(`  Sample stats keys: ${Object.keys(results[0].statistics || {}).join(", ")}`);
                console.log(`  Sample groupings: ${JSON.stringify(results[0].groupings || {})}`);
            }
        }
        // Pause to respect rate limits
        await new Promise(r => setTimeout(r, 31_000));
    }

    // 3. Try flow-values-report
    console.log("\n\n=== FLOW VALUES REPORT (test) ===");
    const flowResult = await klaviyoFetch(`${BASE_URL}/flow-values-reports/`, apiKey, {
        method: "POST",
        body: {
            data: {
                type: "flow-values-report",
                attributes: {
                    timeframe: { key: "last_30_days" },
                    conversion_metric_id: convMetricId,
                    statistics: ["recipients", "opens", "clicks", "conversion_value"],
                },
            },
        },
    });
    if (flowResult) {
        const results = flowResult.data?.attributes?.results || [];
        console.log(`  OK! ${results.length} flow results`);
        if (results.length > 0) {
            console.log(`  Sample: ${JSON.stringify(results[0])}`);
        }
    }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
