
const CRON_SECRET = "your_random_secret_string_here";
const BASE_URL = "http://localhost:3000";

const CLIENTS = [
    { id: "0gHtT6hFp1VxgefXUdru", name: "Shallpass" },
    { id: "1tGyuVqoeMceQIxy6PiI", name: "TheMinimalCo" },
    { id: "4dGaQlT68ousWYecGDzh", name: "Carrara Design" },
    { id: "6T3sWABcp3qomb7mhQ17", name: "Paia" },
    { id: "6uPRRP6vzaWCgiExpefJ", name: "FL Indumentaria" }
];

async function runCronSimulation() {
    console.log("🚀 Starting Full Monday Cron Simulation (9:00 AM)...");
    const date = new Date().toISOString().split("T")[0];

    try {
        // 1. DATA SYNC
        console.log("\n📡 Step 1/4: Data Syncing (fetching Meta data)...");
        const syncRes = await fetch(`${BASE_URL}/api/cron/data-sync`, {
            headers: { "Authorization": `Bearer ${CRON_SECRET}` }
        });
        const syncData = await syncRes.json();
        console.log("Data Sync Result:", JSON.stringify(syncData, null, 2));

        // 2. CLASSIFY ENTITIES
        console.log("\n👥 Step 2/4: Classifying Entities (GEM Engine)...");
        for (const client of CLIENTS) {
            console.log(`\n--- Classifying Client: ${client.name} (${client.id}) ---`);
            const classifyRes = await fetch(`${BASE_URL}/api/cron/classify-entities?clientId=${client.id}&date=${date}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-cron-secret": CRON_SECRET
                }
            });
            const classifyData = await classifyRes.json();
            console.log(`Classification Result:`, JSON.stringify(classifyData, null, 2));
        }

        // 3. DAILY DIGEST (Alerts & Snapshots)
        console.log("\n✉️ Step 3/4: Daily Digest (sending Alerts & Snapshots to Slack)...");
        const digestRes = await fetch(`${BASE_URL}/api/cron/daily-digest`, {
            headers: { "Authorization": `Bearer ${CRON_SECRET}` }
        });
        const digestData = await digestRes.json();
        console.log("Daily Digest Result:", JSON.stringify(digestData, null, 2));

        // 4. WEEKLY ALERTS (Monday Special)
        console.log("\n📈 Step 4/4: Weekly Performance Highlights (Monday Special)...");
        const weeklyRes = await fetch(`${BASE_URL}/api/cron/weekly-alerts`, {
            headers: { "Authorization": `Bearer ${CRON_SECRET}` }
        });
        const weeklyData = await weeklyRes.json();
        console.log("Weekly Alerts Result:", JSON.stringify(weeklyData, null, 2));

        console.log("\n✅ FULL SIMULATION COMPLETED.");

    } catch (error) {
        console.error("❌ Simulation Failed:", error);
    }
}

runCronSimulation();
