import { db } from "@/lib/firebase-admin";
import { DecisionEngine } from "./decision-engine";
import { DailyEntitySnapshot, EntityRollingMetrics, ConceptRollingMetrics } from "@/types/performance-snapshots";
import { EntityClassification, ClientPercentiles } from "@/types/classifications";

export class ClassificationService {
    /**
     * Main entry point to classify all entities for a client and run Decision Engine
     */
    static async classifyEntitiesForClient(clientId: string, date: string) {
        // 1. Fetch data
        const [rollingSnap, dailySnap, conceptSnap] = await Promise.all([
            db.collection("entity_rolling_metrics").where("clientId", "==", clientId).get(),
            db.collection("daily_entity_snapshots")
                .where("clientId", "==", clientId)
                .where("date", "==", date)
                .get(),
            db.collection("concept_rolling_metrics").where("clientId", "==", clientId).get()
        ]);

        const rollingMetrics = rollingSnap.docs.map(d => d.data() as EntityRollingMetrics);
        const dailySnapshots = dailySnap.docs.map(d => d.data() as DailyEntitySnapshot);
        const conceptMetrics = conceptSnap.docs.map(d => d.data() as ConceptRollingMetrics);

        // Structural inputs
        const activeAdsets = rollingMetrics.filter(r => r.level === 'adset' && (r.rolling.spend_7d || 0) > 0);
        const accountRolling = rollingMetrics.find(r => r.level === 'account');
        const conversions7d = accountRolling?.rolling.conversion_velocity_7d ? accountRolling.rolling.conversion_velocity_7d * 7 : 0;

        // Filter only those with spend > 0 today
        const activeSnapshots = dailySnapshots.filter(s => s.performance.spend > 0);

        // 2. Calculate percentiles for normalization
        const percentiles = await this.calculateClientPercentiles(clientId, rollingMetrics);

        const batch = db.batch();

        for (const snap of activeSnapshots) {
            const rolling = rollingMetrics.find(r => r.entityId === snap.entityId && r.level === snap.level);
            if (!rolling) continue;

            const concept = snap.meta.conceptId ? conceptMetrics.find(c => c.conceptId === snap.meta.conceptId) : undefined;

            // CORE DECISION ENGINE CALL
            const decision = DecisionEngine.compute(
                snap,
                rolling,
                percentiles,
                concept,
                activeAdsets.length,
                conversions7d
            );

            const docId = `${clientId}__${snap.level}__${snap.entityId}`;
            const docRef = db.collection("entity_classifications").doc(docId);
            batch.set(docRef, decision, { merge: true });
        }

        await batch.commit();
        return activeSnapshots.length;
    }

    private static async calculateClientPercentiles(clientId: string, rolling: EntityRollingMetrics[]): Promise<ClientPercentiles> {
        const extract = (fn: (r: EntityRollingMetrics) => number | undefined) =>
            rolling.map(fn).filter((v): v is number => v !== undefined && v > 0);

        const getPercentile = (values: number[], p: number) => {
            if (values.length === 0) return 0;
            const sorted = [...values].sort((a, b) => a - b);
            const pos = (sorted.length - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
        };

        const cpaInverses = extract(r => r.rolling.cpa_7d ? 1 / r.rolling.cpa_7d : 0);

        return {
            fitr: { p10: 0.01, p90: 0.12 },
            convRate: { p10: 0.001, p90: 0.018 },
            cpaInv: {
                p10: getPercentile(cpaInverses, 0.1) || 0.01,
                p90: getPercentile(cpaInverses, 0.9) || 0.2
            },
            ctr: { p10: 0.7, p90: 2.8 }
        };
    }
}
