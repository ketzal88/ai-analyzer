/**
 * Backfill Klaviyo email data for a client.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/sync-klaviyo-backfill.ts [clientId]
 *
 * Reads the client's klaviyoApiKey from Firestore and syncs
 * campaign + flow data for Jan, Feb, and Mar 2026 into channel_snapshots.
 *
 * Note: Klaviyo Reporting API rate limits are tight (2/min, 225/day).
 * Each month requires 2 API calls (campaigns + flows) with a 31s pause between.
 * Total: ~6 reporting calls for 3 months = ~3 minutes.
 */

import { db } from "@/lib/firebase-admin";
import { KlaviyoService } from "@/lib/klaviyo-service";
import { Client } from "@/types";

const TARGET_CLIENT_ID = process.argv[2] || "";

async function findClient(): Promise<{ id: string; client: Client }> {
    if (TARGET_CLIENT_ID) {
        const doc = await db.collection("clients").doc(TARGET_CLIENT_ID).get();
        if (!doc.exists) throw new Error(`Client ${TARGET_CLIENT_ID} not found`);
        return { id: doc.id, client: doc.data() as Client };
    }

    const snap = await db.collection("clients")
        .where("active", "==", true)
        .get();

    for (const doc of snap.docs) {
        const client = doc.data() as Client;
        if (client.klaviyoApiKey && client.integraciones?.email === "klaviyo") {
            return { id: doc.id, client };
        }
    }
    throw new Error("No active client with klaviyoApiKey found");
}

async function main() {
    console.log("Finding client with Klaviyo integration...\n");
    const { id, client } = await findClient();
    console.log(`Client: ${client.name} (${id})`);
    console.log(`API Key: ${client.klaviyoApiKey!.substring(0, 12)}...\n`);

    // Step 1: Verify API connectivity by listing campaigns
    console.log("Step 1: Verifying Klaviyo API connectivity...");
    try {
        const campaigns = await KlaviyoService.fetchCampaigns(client.klaviyoApiKey!);
        console.log(`  Found ${campaigns.length} email campaigns`);
        if (campaigns.length > 0) {
            console.log(`  Most recent: "${campaigns[0].name}" (${campaigns[0].status})`);
        }
    } catch (err: any) {
        console.error(`  API verification failed: ${err.message}`);
        return;
    }

    // Step 2: List flows
    console.log("\nStep 2: Listing flows...");
    try {
        const flows = await KlaviyoService.fetchFlows(client.klaviyoApiKey!);
        console.log(`  Found ${flows.length} flows`);
        for (const f of flows) {
            console.log(`    - ${f.name} (${f.status})`);
        }
    } catch (err: any) {
        console.error(`  Flows listing failed: ${err.message}`);
    }

    // Step 3: Sync month by month
    console.log("\nStep 3: Syncing data month by month...");
    console.log("  (Note: 31s pause between reporting calls due to rate limits)\n");

    const months = [
        { name: "January 2026", start: "2026-01-01", end: "2026-01-31" },
        { name: "February 2026", start: "2026-02-01", end: "2026-02-28" },
        { name: "March 2026 (to date)", start: "2026-03-01", end: "2026-03-04" },
    ];

    let grandTotalSent = 0;

    for (const month of months) {
        console.log(`Syncing ${month.name} (${month.start} -> ${month.end})...`);
        try {
            const result = await KlaviyoService.syncToChannelSnapshots(
                id,
                client.klaviyoApiKey!,
                month.start,
                month.end
            );
            console.log(`  ${result.totalSent} emails sent`);
            grandTotalSent += result.totalSent;
        } catch (err: any) {
            console.error(`  Error: ${err.message}`);
        }

        // Extra pause between months to respect rate limits
        if (month !== months[months.length - 1]) {
            console.log("  Waiting 31s for rate limit...");
            await new Promise(r => setTimeout(r, 31_000));
        }
    }

    console.log(`\nBackfill complete!`);
    console.log(`Total emails sent: ${grandTotalSent}`);

    // Verify
    console.log(`\nVerifying channel_snapshots in Firestore...`);
    const snapshotsSnap = await db.collection("channel_snapshots")
        .where("clientId", "==", id)
        .where("channel", "==", "EMAIL")
        .orderBy("date", "desc")
        .limit(10)
        .get();

    console.log(`Found ${snapshotsSnap.size} EMAIL snapshots for ${client.name}:\n`);
    for (const doc of snapshotsSnap.docs) {
        const data = doc.data();
        const m = data.metrics || {};
        const source = data.rawData?.source || "unknown";
        console.log(`  ${data.date} [${source}] | sent: ${m.sent || 0} | opens: ${m.opens || 0} (${(m.openRate || 0).toFixed(1)}%) | clicks: ${m.emailClicks || 0} (${(m.clickRate || 0).toFixed(1)}%) | revenue: $${(m.emailRevenue || 0).toFixed(2)}`);
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
