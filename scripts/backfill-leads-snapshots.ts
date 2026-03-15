/**
 * Backfill leads → channel_snapshots for Worker & Shallpass.
 *
 * After CSV imports, leads exist in Firestore `leads` collection but
 * channel_snapshots (which the dashboard reads) are missing.
 * This script calls LeadsService.syncToChannelSnapshots() for the full date range.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/backfill-leads-snapshots.ts
 *   npx tsx --require ./scripts/load-env.cjs scripts/backfill-leads-snapshots.ts --dry-run
 */

import { LeadsService } from "../src/lib/leads-service";
import { db } from "../src/lib/firebase-admin";

const CLIENTS = [
    { id: "Xztaf4I2sWkpfQcpUiel", name: "Worker" },
    { id: "0gHtT6hFp1VxgefXUdru", name: "Shallpass" },
];

// Wide range — sync will only write days that have actual leads
const START_DATE = "2024-01-01";
const END_DATE = new Date().toISOString().slice(0, 10); // today

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
    console.log(`\n🔄 Leads → channel_snapshots backfill`);
    console.log(`   📅 Range: ${START_DATE} → ${END_DATE}`);
    if (DRY_RUN) console.log("   ⚠️  DRY RUN — no writes\n");

    for (const client of CLIENTS) {
        console.log(`\n📋 ${client.name} (${client.id})`);

        // Count leads (simple query, no orderBy needed)
        const leadsCount = await db.collection("leads")
            .where("clientId", "==", client.id)
            .count()
            .get();
        const total = leadsCount.data().count;
        console.log(`   📊 Total leads in collection: ${total}`);

        if (total === 0) {
            console.log("   ❌ No leads found, skipping");
            continue;
        }

        // Count existing LEADS snapshots
        const existingSnap = await db.collection("channel_snapshots")
            .where("clientId", "==", client.id)
            .where("channel", "==", "LEADS")
            .count()
            .get();
        console.log(`   📊 Existing LEADS snapshots: ${existingSnap.data().count}`);

        if (DRY_RUN) {
            console.log("   🔍 Would sync leads for full range");
            continue;
        }

        console.log("   ⏳ Syncing...");
        const result = await LeadsService.syncToChannelSnapshots(
            client.id,
            START_DATE,
            END_DATE
        );

        console.log(`   ✅ Wrote ${result.daysWritten} daily snapshots from ${result.totalLeads} leads`);
    }

    console.log("\n🏁 Done!\n");
}

main().catch((err) => {
    console.error("❌ Fatal:", err);
    process.exit(1);
});
