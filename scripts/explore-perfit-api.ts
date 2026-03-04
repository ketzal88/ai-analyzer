/**
 * Explore Perfit API endpoints to discover available data.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/explore-perfit-api.ts
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";

const BASE_URL = "https://api.myperfit.com/v2";

async function apiFetch(url: string, apiKey: string): Promise<any> {
    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
    });
    if (!res.ok) {
        const text = await res.text();
        return { _error: res.status, _body: text, _url: url };
    }
    return res.json();
}

async function main() {
    // Get Blackhorn's API key
    const doc = await db.collection("clients").doc("M63c4mG4L5ub4uSg2EEZ").get();
    const client = doc.data() as Client;
    const apiKey = client.perfitApiKey!;
    const accountId = apiKey.substring(0, apiKey.indexOf('-'));

    console.log(`Account: ${accountId}\n`);

    // ── 1. Account info ──────────────────────
    console.log("═══ 1. ACCOUNT INFO ═══");
    const account = await apiFetch(`${BASE_URL}/${accountId}`, apiKey);
    console.log(JSON.stringify(account, null, 2));

    // ── 2. Campaign list (first 3, full detail) ──
    console.log("\n═══ 2. CAMPAIGNS (first 3 sent, full fields) ═══");
    const campaigns = await apiFetch(`${BASE_URL}/${accountId}/campaigns?limit=3&sortby=launchDate&sortdir=desc`, apiKey);
    console.log(JSON.stringify(campaigns, null, 2));

    // ── 3. Single campaign detail ──────────────
    const sentCampaigns = (campaigns.data || []).filter((c: any) => c.state === "SENT");
    if (sentCampaigns.length > 0) {
        const cId = sentCampaigns[0].id;
        console.log(`\n═══ 3. SINGLE CAMPAIGN DETAIL (id=${cId}) ═══`);
        const detail = await apiFetch(`${BASE_URL}/${accountId}/campaigns/${cId}`, apiKey);
        console.log(JSON.stringify(detail, null, 2));

        // ── 3b. Campaign stats/metrics endpoint ──
        console.log(`\n═══ 3b. CAMPAIGN STATS (id=${cId}) ═══`);
        const stats = await apiFetch(`${BASE_URL}/${accountId}/campaigns/${cId}/stats`, apiKey);
        console.log(JSON.stringify(stats, null, 2));

        // ── 3c. Campaign actions ──
        console.log(`\n═══ 3c. CAMPAIGN ACTIONS (id=${cId}) ═══`);
        const actions = await apiFetch(`${BASE_URL}/${accountId}/campaigns/${cId}/actions?limit=5`, apiKey);
        console.log(JSON.stringify(actions, null, 2));
    }

    // ── 4. Automations ───────────────────────
    console.log("\n═══ 4. AUTOMATIONS ═══");
    const automations = await apiFetch(`${BASE_URL}/${accountId}/automations`, apiKey);
    console.log(JSON.stringify(automations, null, 2));

    // ── 5. Automation detail (if any) ────────
    const autoList = automations.data || automations;
    if (Array.isArray(autoList) && autoList.length > 0) {
        const aId = autoList[0].id;
        console.log(`\n═══ 5. AUTOMATION DETAIL (id=${aId}) ═══`);
        const autoDetail = await apiFetch(`${BASE_URL}/${accountId}/automations/${aId}`, apiKey);
        console.log(JSON.stringify(autoDetail, null, 2));

        console.log(`\n═══ 5b. AUTOMATION STATS (id=${aId}) ═══`);
        const autoStats = await apiFetch(`${BASE_URL}/${accountId}/automations/${aId}/stats`, apiKey);
        console.log(JSON.stringify(autoStats, null, 2));
    }

    // ── 6. Lists/contacts ────────────────────
    console.log("\n═══ 6. LISTS ═══");
    const lists = await apiFetch(`${BASE_URL}/${accountId}/lists`, apiKey);
    console.log(JSON.stringify(lists, null, 2));

    // ── 7. Stats/reporting endpoints ─────────
    console.log("\n═══ 7. ACCOUNT STATS ═══");
    const accountStats = await apiFetch(`${BASE_URL}/${accountId}/stats`, apiKey);
    console.log(JSON.stringify(accountStats, null, 2));

    // ── 8. Ecommerce / conversions ───────────
    console.log("\n═══ 8. ECOMMERCE ═══");
    const ecommerce = await apiFetch(`${BASE_URL}/${accountId}/ecommerce`, apiKey);
    console.log(JSON.stringify(ecommerce, null, 2));

    // ── 9. Try /reports endpoint ─────────────
    console.log("\n═══ 9. REPORTS ═══");
    const reports = await apiFetch(`${BASE_URL}/${accountId}/reports`, apiKey);
    console.log(JSON.stringify(reports, null, 2));

    // ── 10. Try /activity endpoint ───────────
    console.log("\n═══ 10. ACTIVITY ═══");
    const activity = await apiFetch(`${BASE_URL}/${accountId}/activity`, apiKey);
    console.log(JSON.stringify(activity, null, 2));
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
