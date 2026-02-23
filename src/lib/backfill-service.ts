import { db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { ClientSnapshotService } from "@/lib/client-snapshot-service";
import { BackfillTask, BackfillStats } from "@/types/backfill";
import { Client } from "@/types";

export class BackfillService {
    /**
     * Enqueue tasks for a client for the last N days
     */
    static async enqueueClient(clientId: string, days: number = 60) {
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) throw new Error("Client not found");

        const tasks: BackfillTask[] = [];
        const today = new Date();

        for (let i = 1; i <= days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split("T")[0];

            const taskId = `${clientId}_${dateStr}`;
            tasks.push({
                id: taskId,
                clientId,
                date: dateStr,
                status: 'pending',
                attempts: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                priority: i
            });
        }

        const batch = db.batch();
        for (const task of tasks) {
            batch.set(db.collection("backfill_queue").doc(task.id), task, { merge: true });
        }
        await batch.commit();

        console.log(`[Backfill] Enqueued ${tasks.length} tasks for client ${clientId}`);
        return tasks.length;
    }

    /**
     * Process a small batch of pending tasks
     */
    static async processBatch(limit: number = 5) {
        const tasksSnap = await db.collection("backfill_queue")
            .where("status", "==", "pending")
            .limit(limit)
            .get();

        if (tasksSnap.empty) {
            // Check for failed tasks that might need retry
            const retrySnap = await db.collection("backfill_queue")
                .where("status", "==", "failed")
                .where("attempts", "<", 3)
                .limit(limit)
                .get();

            if (retrySnap.empty) return [];

            // Mark retries as pending for next run
            const batch = db.batch();
            retrySnap.docs.forEach(d => batch.update(d.ref, { status: 'pending' }));
            await batch.commit();
            return [{ status: 'retries_requeued', count: retrySnap.size }];
        }

        const results = [];
        for (const doc of tasksSnap.docs) {
            const task = doc.data() as BackfillTask;

            // Mark as processing immediately to prevent concurrent runs
            await doc.ref.update({ status: 'processing', updatedAt: new Date().toISOString() });

            try {
                const clientDoc = await db.collection("clients").doc(task.clientId).get();
                const client = clientDoc.data() as Client;

                if (!client || !client.metaAdAccountId) {
                    throw new Error(`Client ${task.clientId} has no Meta account configured`);
                }

                console.log(`[Backfill] Processing ${task.id} (${task.date})...`);

                // 1. Sync raw data for that specific day
                await PerformanceService.syncAllLevels(task.clientId, client.metaAdAccountId, {
                    since: task.date,
                    until: task.date
                });

                // 2. Compute snapshots for that day (ensure historical continuity)
                // We pass the task date to ensure the snapshot represents that specific point in time
                await ClientSnapshotService.computeAndStore(task.clientId, task.date);

                await doc.ref.update({
                    status: 'completed',
                    updatedAt: new Date().toISOString()
                });

                results.push({ id: task.id, status: 'success' });
            } catch (e: any) {
                console.error(`[Backfill] Failed task ${task.id}:`, e.message);
                await doc.ref.update({
                    status: 'failed',
                    attempts: (task.attempts || 0) + 1,
                    lastError: e.message,
                    updatedAt: new Date().toISOString()
                });
                results.push({ id: task.id, status: 'failed', error: e.message });
            }
        }

        return results;
    }

    /**
     * Get aggregate statistics of the queue
     */
    static async getStats(): Promise<BackfillStats> {
        const snap = await db.collection("backfill_queue").get();
        const stats = { total: snap.size, pending: 0, completed: 0, failed: 0, processing: 0 };

        snap.docs.forEach(d => {
            const s = d.data().status as keyof BackfillStats;
            if (stats[s] !== undefined) stats[s]++;
        });

        return stats as BackfillStats;
    }

    /**
     * Delete processed tasks to keep the queue clean
     */
    static async cleanup() {
        const completedDocs = await db.collection("backfill_queue")
            .where("status", "==", "completed")
            .limit(500)
            .get();

        if (completedDocs.empty) return 0;

        const batch = db.batch();
        completedDocs.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return completedDocs.size;
    }
}
