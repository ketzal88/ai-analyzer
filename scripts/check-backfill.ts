import { db } from "../src/lib/firebase-admin";

async function checkBackfill() {
    const clientId = "LO4ob4dUxOggwTSlm07v";
    const snap = await db.collection("backfill_queue")
        .where("clientId", "==", clientId)
        .get();
        
    const stats = {
        total: snap.size,
        pending: 0,
        completed: 0,
        failed: 0,
        processing: 0
    };

    snap.docs.forEach(d => {
        const s = d.data().status;
        if (s === 'pending') stats.pending++;
        else if (s === 'completed') stats.completed++;
        else if (s === 'failed') stats.failed++;
        else if (s === 'processing') stats.processing++;
    });

    console.log("Backfill Stats for Blunua:");
    console.log(JSON.stringify(stats, null, 2));
}

checkBackfill().catch(console.error);
