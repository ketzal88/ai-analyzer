/**
 * Backfill Google Ads data for a client.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/sync-google-backfill.ts [clientId]
 *
 * Reads the client's googleAdsId from Firestore and syncs
 * campaign data for Jan, Feb, and Mar 2026 into channel_snapshots.
 */

import { db } from "@/lib/firebase-admin";
import { GoogleAdsService } from "@/lib/google-ads-service";
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
        if (client.googleAdsId && client.integraciones?.google) {
            return { id: doc.id, client };
        }
    }
    throw new Error("No active client with googleAdsId found");
}

async function main() {
    console.log("Finding client with Google Ads integration...\n");
    const { id, client } = await findClient();
    console.log(`Client: ${client.name} (${id})`);
    console.log(`Google Ads ID: ${client.googleAdsId}\n`);

    const months = [
        { name: "January 2026", start: "2026-01-01", end: "2026-01-31" },
        { name: "February 2026", start: "2026-02-01", end: "2026-02-28" },
        { name: "March 2026 (to date)", start: "2026-03-01", end: "2026-03-04" },
    ];

    let grandTotalDays = 0;
    let grandTotalSpend = 0;

    for (const month of months) {
        console.log(`Syncing ${month.name} (${month.start} -> ${month.end})...`);
        try {
            const result = await GoogleAdsService.syncToChannelSnapshots(
                id,
                client.googleAdsId!,
                month.start,
                month.end
            );
            console.log(`  ${result.daysWritten} days written, $${result.totalSpend.toFixed(2)} total spend`);
            grandTotalDays += result.daysWritten;
            grandTotalSpend += result.totalSpend;
        } catch (err: any) {
            console.error(`  Error: ${err.message}`);
        }
    }

    console.log(`\nBackfill complete!`);
    console.log(`Total days written: ${grandTotalDays}`);
    console.log(`Total spend: $${grandTotalSpend.toFixed(2)}`);

    // Verify
    console.log(`\nVerifying channel_snapshots in Firestore...`);
    const snapshotsSnap = await db.collection("channel_snapshots")
        .where("clientId", "==", id)
        .where("channel", "==", "GOOGLE")
        .orderBy("date", "desc")
        .limit(20)
        .get();

    console.log(`Found ${snapshotsSnap.size} GOOGLE snapshots for ${client.name}:\n`);
    for (const doc of snapshotsSnap.docs) {
        const data = doc.data();
        const m = data.metrics || {};
        console.log(`  ${data.date} | spend: $${(m.spend || 0).toFixed(2)} | conv: ${(m.conversions || 0).toFixed(0)} | roas: ${(m.roas || 0).toFixed(2)}x | clicks: ${m.clicks || 0} | ctr: ${(m.ctr || 0).toFixed(2)}%`);
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
