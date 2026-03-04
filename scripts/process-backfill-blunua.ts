import { db } from "../src/lib/firebase-admin";
import { PerformanceService } from "../src/lib/performance-service";
import { ClientSnapshotService } from "../src/lib/client-snapshot-service";

async function processBlunuaOnly() {
    const clientId = "LO4ob4dUxOggwTSlm07v";
    console.log(`��� Starting EXCLUSIVE Backfill for Blunua (${clientId})...`);

    const tasksSnap = await db.collection("backfill_queue")
        .where("clientId", "==", clientId)
        .where("status", "==", "pending")
        .get();

    if (tasksSnap.empty) {
        console.log("No pending tasks for Blunua.");
        return;
    }

    // Sort tasks by date DESCENDING to go newest first (better for rolling metrics)
    const docs = tasksSnap.docs.sort((a, b) => b.data().date.localeCompare(a.data().date));

    console.log(`Found ${docs.length} pending tasks.`);

    const clientDoc = await db.collection("clients").doc(clientId).get();
    const client = clientDoc.data();

    if (!client || !client.metaAdAccountId) {
        console.error("Blunua has no Meta account configured!");
        return;
    }

    let i = 0;
    for (const doc of docs) {
        i++;
        const task = doc.data();
        console.log(`[${i}/${docs.length}] Processing ${task.date}...`);

        try {
            // 1. Sync
            await PerformanceService.syncAllLevels(clientId, client.metaAdAccountId, {
                since: task.date,
                until: task.date
            });

            // 2. Snapshot
            await ClientSnapshotService.computeAndStore(clientId, task.date);

            // 3. Complete
            await doc.ref.update({
                status: 'completed',
                updatedAt: new Date().toISOString()
            });

            // Sleep 2s
            await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
            console.error(`❌ Error on ${task.date}: ${e.message}`);
            await doc.ref.update({
                status: 'failed',
                lastError: e.message,
                updatedAt: new Date().toISOString()
            });
        }
    }

    console.log("✅ Blunua Backfill Finished.");
}

processBlunuaOnly().catch(console.error);
