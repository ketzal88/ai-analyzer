import { db } from "../src/lib/firebase-admin";
import { ClientSnapshotService } from "../src/lib/client-snapshot-service";
import { SlackService } from "../src/lib/slack-service";
import { EngineConfigService } from "../src/lib/engine-config-service";

async function run() {
    const clientId = "LO4ob4dUxOggwTSlm07v";
    console.log(`🎯 Triggering Analysis for Blunua (${clientId})...`);

    try {
        // 1. Compute Latest Snapshot
        console.log("🛠 Calling ClientSnapshotService.computeAndStore...");
        const result = await ClientSnapshotService.computeAndStore(clientId);
        const main = result.main;
        console.log(`✅ Snapshot computed. Alerts: ${main.alerts.length}`);

        // 2. Fetch Config
        const config = await EngineConfigService.getEngineConfig(clientId);

        // 3. Send to Slack (Simulation of Daily Digest)
        const kpis = SlackService.buildSnapshotFromClientSnapshot(main.accountSummary);
        const todayStr = new Date().toISOString().split("T")[0];
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        const dateRange = { start: startOfMonth, end: todayStr };

        console.log("📤 Sending Daily Snapshot to Slack...");
        await SlackService.sendDailySnapshot(clientId, "Blunua", dateRange, kpis, config.dailySnapshotTitle);

        console.log("📤 Sending Alert Digest to Slack...");
        if (main.alerts.length > 0) {
            await SlackService.sendDigest(clientId, "Blunua", main.alerts);
        } else {
            console.log("No alerts found to send.");
        }

        console.log("🚀 Done!");
    } catch (e: any) {
        console.error("❌ Fatal Error in trigger script:", e);
    }
}

run().catch(console.error);
