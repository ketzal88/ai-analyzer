import { db } from "../src/lib/firebase-admin";
import { generateGeminiReport } from "../src/lib/gemini-service";

async function run() {
    const clientId = "LO4ob4dUxOggwTSlm07v";
    console.log(`í´– Generating AI Report for Blunua (${clientId})...`);

    const clientDoc = await db.collection("clients").doc(clientId).get();
    const clientData = clientDoc.data();

    // Fetch findings (alerts) from the latest snapshot
    const snapshotDoc = await db.collection("client_snapshots").doc(clientId).get();
    const snapshot = snapshotDoc.data();
    
    if (!snapshot || !snapshot.alerts) {
        console.error("No alerts found to analyze!");
        return;
    }

    const report = await generateGeminiReport(
        clientId,
        clientData,
        snapshot.alerts,
        "Ãšltimos 7 dÃ­as (Datos Reprocesados)"
    );

    console.log("âœ… AI Report Generated.");
    console.log("Digest:", report.digest);
    console.log("Report Snippet:", JSON.stringify(report.report.sections?.[0]?.insights?.[0]?.observation || "N/A"));
}

run().catch(console.error);
