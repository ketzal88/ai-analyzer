/**
 * Gap Detection Service
 *
 * Detects missing channel_snapshots for active clients.
 * Used by the fill-gaps cron to automatically retry failed daily syncs.
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { BackfillChannel } from "@/lib/channel-backfill-service";

export interface GapInfo {
    clientId: string;
    clientName: string;
    channel: BackfillChannel;
    missingDates: string[];
}

function generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start + "T12:00:00Z");
    const last = new Date(end + "T12:00:00Z");
    while (current <= last) {
        dates.push(current.toISOString().split("T")[0]);
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
}

function getConfiguredChannels(client: Client): BackfillChannel[] {
    const channels: BackfillChannel[] = [];
    if (client.integraciones?.meta && client.metaAdAccountId) channels.push("META");
    if (client.integraciones?.google && client.googleAdsId) channels.push("GOOGLE");
    if (client.integraciones?.ecommerce) channels.push("ECOMMERCE");
    if (client.integraciones?.email) channels.push("EMAIL");
    return channels;
}

export class GapDetectionService {
    /**
     * Detect missing channel_snapshots for the last `lookbackDays` days.
     * Returns only client+channel combos that have gaps.
     */
    static async detectGaps(lookbackDays = 7): Promise<GapInfo[]> {
        // Build expected date range: [today - lookbackDays, ..., yesterday]
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);

        const startStr = startDate.toISOString().split("T")[0];
        const endStr = yesterday.toISOString().split("T")[0];
        const expectedDates = generateDateRange(startStr, endStr);

        if (expectedDates.length === 0) return [];

        // Fetch all active clients
        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const gaps: GapInfo[] = [];

        for (const doc of clientsSnap.docs) {
            const client = { id: doc.id, ...doc.data() } as Client;
            const channels = getConfiguredChannels(client);

            for (const channel of channels) {
                const prefix = `${client.id}__${channel}__`;

                // Query existing snapshots in the date range
                const snapshotsSnap = await db.collection("channel_snapshots")
                    .where("__name__", ">=", prefix + startStr)
                    .where("__name__", "<=", prefix + endStr)
                    .select() // Only need doc IDs, not data
                    .get();

                const foundDates = new Set<string>();
                for (const snap of snapshotsSnap.docs) {
                    const parts = snap.id.split("__");
                    const date = parts[parts.length - 1];
                    foundDates.add(date);
                }

                const missingDates = expectedDates.filter(d => !foundDates.has(d));

                if (missingDates.length > 0) {
                    gaps.push({
                        clientId: client.id,
                        clientName: client.name,
                        channel,
                        missingDates,
                    });
                }
            }
        }

        return gaps;
    }
}
