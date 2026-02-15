import { db } from "@/lib/firebase-admin";
import { ConceptRollup, ConceptHealth } from "@/types/concepts";
import { ConceptRollingMetrics, DailyEntitySnapshot, EntityRollingMetrics } from "@/types/performance-snapshots";
import { EntityClassification } from "@/types/classifications";

export class ConceptService {

    static async listConcepts(clientId: string, range?: { start: string; end: string }): Promise<ConceptRollup[]> {
        // 1. Fetch Concept Rolling Metrics (primary source)
        const rollingSnap = await db.collection("concept_rolling_metrics")
            .where("clientId", "==", clientId)
            .get();

        // 2. Fetch Account-level spend for Share calculation
        const accountRollingSnap = await db.collection("entity_rolling_metrics")
            .where("clientId", "==", clientId)
            .where("level", "==", "account")
            .limit(1)
            .get();

        const accountRolling = accountRollingSnap.empty ? null : accountRollingSnap.docs[0].data() as EntityRollingMetrics;
        const totalAccountSpend7d = accountRolling?.rolling.spend_7d || 1; // avoid div by zero

        // 3. Fetch Classifications to compute Intent Mix
        const classSnap = await db.collection("entity_classifications")
            .where("clientId", "==", clientId)
            .where("level", "==", "ad")
            .get();

        const classifications = classSnap.docs.map(d => d.data() as EntityClassification);

        // 4. Fetch additional performance (ROAS etc) from daily snapshots for these concepts
        // (Simplified: we use what we have in Rolling or approximate)

        const rollups: ConceptRollup[] = [];

        for (const doc of rollingSnap.docs) {
            const rm = doc.data() as ConceptRollingMetrics;
            const conceptAdsClass = classifications.filter(c => c.conceptId === rm.conceptId);

            const totalAds = Math.max(1, conceptAdsClass.length);
            const intentMix = {
                TOFU: conceptAdsClass.filter(c => c.intentStage === 'TOFU').length / totalAds,
                MOFU: conceptAdsClass.filter(c => c.intentStage === 'MOFU').length / totalAds,
                BOFU: conceptAdsClass.filter(c => c.intentStage === 'BOFU').length / totalAds
            };

            const health = this.computeConceptHealth(
                rm.rolling.frequency_7d || 0,
                rm.rolling.avg_cpa_7d,
                rm.rolling.avg_cpa_14d,
                rm.rolling.hook_rate_delta,
                rm.rolling.spend_concentration_top1
            );

            rollups.push({
                clientId: rm.clientId,
                conceptId: rm.conceptId,
                health,
                spend_7d: 0,
                spendShare: rm.rolling.spend_concentration_top1,
                cpa_7d: rm.rolling.avg_cpa_7d,
                cpa_14d: rm.rolling.avg_cpa_14d,
                roas_7d: 0,
                frequency_7d: rm.rolling.frequency_7d || 0,
                hookRateDelta: rm.rolling.hook_rate_delta,
                cpaDelta: rm.rolling.avg_cpa_14d > 0 ? (rm.rolling.avg_cpa_7d / rm.rolling.avg_cpa_14d) - 1 : 0,
                intentMix,
                dominantFormat: "VIDEO",
                lastUpdate: rm.lastUpdate
            });
        }

        return rollups.sort((a, b) => b.spend_7d - a.spend_7d);
    }

    static computeConceptHealth(
        freq7d: number,
        cpa7d: number,
        cpa14d: number,
        hookDelta: number,
        spendShare: number
    ): ConceptHealth {
        if (freq7d > 4 && cpa7d > cpa14d * 1.25 && hookDelta < -0.2 && spendShare > 0.6) {
            return 'CRITICAL_FATIGUE';
        }
        if (cpa7d > cpa14d * 1.15 || hookDelta < -0.1) {
            return 'DEGRADING';
        }
        return 'HEALTHY';
    }

    static async getConceptDetail(clientId: string, conceptId: string, range: { start: string; end: string }) {
        // Fetch all ads belonging to this concept
        const adSnaps = await db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .where("level", "==", "ad")
            .where("meta.conceptId", "==", conceptId)
            .where("date", ">=", range.start)
            .where("date", "<=", range.end)
            .get();

        const ads = adSnaps.docs.map(d => d.data() as DailyEntitySnapshot);

        // Aggregate local performance
        const spend = ads.reduce((sum, a) => sum + a.performance.spend, 0);
        const purchases = ads.reduce((sum, a) => sum + (a.performance.purchases || 0), 0);
        const revenue = ads.reduce((sum, a) => sum + (a.performance.revenue || 0), 0);

        // Intent Mix calculation
        // We need to fetch classifications for these ads
        const adIds = [...new Set(ads.map(a => a.entityId))];
        let intentMix = { TOFU: 0, MOFU: 0, BOFU: 0 };

        if (adIds.length > 0) {
            const classSnaps = await db.collection("entity_classifications")
                .where("clientId", "==", clientId)
                .where("entityId", "in", adIds.slice(0, 10)) // limit for demo/safety
                .get();

            const counts = { TOFU: 0, MOFU: 0, BOFU: 0 };
            classSnaps.forEach(d => {
                const c = d.data() as EntityClassification;
                counts[c.intentStage]++;
            });
            const total = Math.max(1, classSnaps.size);
            intentMix = {
                TOFU: counts.TOFU / total,
                MOFU: counts.MOFU / total,
                BOFU: counts.BOFU / total
            };
        }

        return {
            conceptId,
            performance: { spend, purchases, revenue, cpa: purchases > 0 ? spend / purchases : 0, roas: spend > 0 ? revenue / spend : 0 },
            intentMix,
            topAds: ads.sort((a, b) => b.performance.spend - a.performance.spend).slice(0, 5),
            evidenceFacts: [
                `Spend total en rango: $${spend.toFixed(2)}`,
                `CPA promedio: $${(purchases > 0 ? spend / purchases : 0).toFixed(2)}`,
                `Mix de intención: ${Math.round(intentMix.BOFU * 100)}% BOFU`
            ]
        };
    }
}
