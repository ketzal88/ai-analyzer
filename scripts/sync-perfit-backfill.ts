/**
 * Backfill Perfit email data for a client.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/sync-perfit-backfill.ts
 *
 * Reads the client's perfitApiKey from Firestore and syncs
 * campaign data for Jan, Feb, and Mar 2026 into channel_snapshots.
 */

import { db } from "@/lib/firebase-admin";
import { PerfitService } from "@/lib/perfit-service";
import { Client } from "@/types";

// ── Config ────────────────────────────────────
const TARGET_CLIENT_ID = process.argv[2] || ""; // pass as CLI arg, or we find Blackhorn

async function findClient(): Promise<{ id: string; client: Client }> {
    if (TARGET_CLIENT_ID) {
        const doc = await db.collection("clients").doc(TARGET_CLIENT_ID).get();
        if (!doc.exists) throw new Error(`Client ${TARGET_CLIENT_ID} not found`);
        return { id: doc.id, client: doc.data() as Client };
    }

    // Find first active client with perfitApiKey
    const snap = await db.collection("clients")
        .where("active", "==", true)
        .get();

    for (const doc of snap.docs) {
        const client = doc.data() as Client;
        if (client.perfitApiKey && client.integraciones?.email === "perfit") {
            return { id: doc.id, client };
        }
    }
    throw new Error("No active client with perfitApiKey found");
}

async function main() {
    console.log("🔍 Finding client with Perfit integration...\n");
    const { id, client } = await findClient();
    console.log(`✅ Client: ${client.name} (${id})`);
    console.log(`   API Key: ${client.perfitApiKey!.substring(0, 10)}...`);

    const accountId = PerfitService.extractAccountId(client.perfitApiKey!);
    console.log(`   Account ID: ${accountId}\n`);

    // ── Step 1: Verify API connectivity ────────────
    console.log("📡 Step 1: Verifying Perfit API connectivity...");
    const campaigns = await PerfitService.fetchCampaigns(accountId, client.perfitApiKey!);
    console.log(`   Found ${campaigns.length} sent campaigns total\n`);

    if (campaigns.length === 0) {
        console.log("⚠️  No sent campaigns found. Nothing to sync.");
        return;
    }

    // Show date range of available campaigns
    const dates = campaigns
        .map(c => c.launchDate?.split("T")[0])
        .filter(Boolean)
        .sort();
    console.log(`   Campaign date range: ${dates[0]} → ${dates[dates.length - 1]}\n`);

    // ── Step 2: Sync month by month ────────────────
    const months = [
        { name: "January 2026", start: "2026-01-01", end: "2026-01-31" },
        { name: "February 2026", start: "2026-02-01", end: "2026-02-28" },
        { name: "March 2026 (to date)", start: "2026-03-01", end: "2026-03-04" },
    ];

    let grandTotalDays = 0;
    let grandTotalSent = 0;

    for (const month of months) {
        console.log(`📅 Syncing ${month.name} (${month.start} → ${month.end})...`);
        try {
            const result = await PerfitService.syncToChannelSnapshots(
                id,
                client.perfitApiKey!,
                month.start,
                month.end
            );
            console.log(`   ✅ ${result.daysWritten} days written, ${result.totalSent} emails sent`);
            grandTotalDays += result.daysWritten;
            grandTotalSent += result.totalSent;
        } catch (err: any) {
            console.error(`   ❌ Error: ${err.message}`);
        }
    }

    console.log(`\n🎉 Backfill complete!`);
    console.log(`   Total days written: ${grandTotalDays}`);
    console.log(`   Total emails sent: ${grandTotalSent}`);

    // ── Step 3: Verify what's in Firestore ─────────
    console.log(`\n🔎 Verifying channel_snapshots in Firestore...`);
    const snapshotsSnap = await db.collection("channel_snapshots")
        .where("clientId", "==", id)
        .where("channel", "==", "EMAIL")
        .orderBy("date", "desc")
        .limit(20)
        .get();

    console.log(`   Found ${snapshotsSnap.size} EMAIL snapshots for ${client.name}:\n`);
    for (const doc of snapshotsSnap.docs) {
        const data = doc.data();
        const m = data.metrics || {};
        console.log(`   ${data.date} | sent: ${m.sent || 0} | opens: ${m.opens || 0} (${(m.openRate || 0).toFixed(1)}%) | clicks: ${m.emailClicks || 0} (${(m.clickRate || 0).toFixed(1)}%) | revenue: $${(m.emailRevenue || 0).toFixed(2)}`);
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
