import { db } from "@/lib/firebase-admin";
import { ConceptRollup, ConceptHealth } from "@/types/concepts";
import { ConceptRollingMetrics, DailyEntitySnapshot, EntityRollingMetrics } from "@/types/performance-snapshots";
import { EntityClassification } from "@/types/classifications";
import { ClientSnapshot, ClientSnapshotAds } from "@/types/client-snapshot";

export class ConceptService {

    static async listConcepts(clientId: string, range?: { start: string; end: string }): Promise<ConceptRollup[]> {
        // Read from pre-computed snapshot (1 read instead of 3 collection scans)
        const snapshotDoc = await db.collection("client_snapshots").doc(clientId).get();

        if (!snapshotDoc.exists) return [];

        const snapshot = snapshotDoc.data() as ClientSnapshot;
        const totalAccountSpend7d = snapshot.accountSummary.rolling.spend_7d || 1;

        // Get ad-level classifications from ads snapshot for intent mix
        const adsDoc = await db.collection("client_snapshots_ads").doc(clientId).get();
        const adsSnapshot = adsDoc.exists ? adsDoc.data() as ClientSnapshotAds : null;
        const adClassifications = adsSnapshot?.classifications || [];

        const rollups: ConceptRollup[] = [];

        for (const concept of snapshot.concepts) {
            const conceptAdsClass = adClassifications.filter(c => c.conceptId === concept.conceptId);

            const totalAds = Math.max(1, conceptAdsClass.length);
            const intentMix = {
                TOFU: conceptAdsClass.filter(c => c.intentStage === 'TOFU').length / totalAds,
                MOFU: conceptAdsClass.filter(c => c.intentStage === 'MOFU').length / totalAds,
                BOFU: conceptAdsClass.filter(c => c.intentStage === 'BOFU').length / totalAds
            };

            const health = this.computeConceptHealth(
                concept.rolling.frequency_7d || 0,
                concept.rolling.avg_cpa_7d,
                concept.rolling.avg_cpa_14d,
                concept.rolling.hook_rate_delta,
                concept.rolling.spend_concentration_top1
            );

            rollups.push({
                clientId,
                conceptId: concept.conceptId,
                health,
                spend_7d: 0,
                spendShare: concept.rolling.spend_concentration_top1,
                cpa_7d: concept.rolling.avg_cpa_7d,
                cpa_14d: concept.rolling.avg_cpa_14d,
                roas_7d: 0,
                frequency_7d: concept.rolling.frequency_7d || 0,
                hookRateDelta: concept.rolling.hook_rate_delta,
                cpaDelta: concept.rolling.avg_cpa_14d > 0 ? (concept.rolling.avg_cpa_7d / concept.rolling.avg_cpa_14d) - 1 : 0,
                intentMix,
                dominantFormat: "VIDEO",
                lastUpdate: snapshot.computedDate
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
        // This method still needs raw daily_entity_snapshots for time-range queries
        const adSnaps = await db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .where("level", "==", "ad")
            .where("meta.conceptId", "==", conceptId)
            .where("date", ">=", range.start)
            .where("date", "<=", range.end)
            .get();

        const ads = adSnaps.docs.map(d => d.data() as DailyEntitySnapshot);

        const spend = ads.reduce((sum, a) => sum + a.performance.spend, 0);
        const purchases = ads.reduce((sum, a) => sum + (a.performance.purchases || 0), 0);
        const revenue = ads.reduce((sum, a) => sum + (a.performance.revenue || 0), 0);

        // Get intent mix and creative categories from snapshot
        const adIds = [...new Set(ads.map(a => a.entityId))];
        let intentMix = { TOFU: 0, MOFU: 0, BOFU: 0 };
        const creativeCategoryMix: Record<string, number> = {};

        if (adIds.length > 0) {
            const adsDoc = await db.collection("client_snapshots_ads").doc(clientId).get();
            if (adsDoc.exists) {
                const adsSnapshot = adsDoc.data() as ClientSnapshotAds;
                const relevantClassifications = (adsSnapshot.classifications || []).filter(c => adIds.includes(c.entityId));

                const counts = { TOFU: 0, MOFU: 0, BOFU: 0 };
                relevantClassifications.forEach(c => {
                    const stage = c.intentStage as keyof typeof counts;
                    if (stage in counts) counts[stage]++;
                    // Collect creative categories
                    if (c.creativeCategory) {
                        creativeCategoryMix[c.creativeCategory] = (creativeCategoryMix[c.creativeCategory] || 0) + 1;
                    }
                });
                const total = Math.max(1, relevantClassifications.length);
                intentMix = {
                    TOFU: counts.TOFU / total,
                    MOFU: counts.MOFU / total,
                    BOFU: counts.BOFU / total
                };
            }
        }

        // Compute additional numerical context
        const impressions = ads.reduce((sum, a) => sum + (a.performance.impressions || 0), 0);
        const clicks = ads.reduce((sum, a) => sum + (a.performance.clicks || 0), 0);
        const leads = ads.reduce((sum, a) => sum + (a.performance.leads || 0), 0);
        const cpa = purchases > 0 ? spend / purchases : 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const roas = spend > 0 ? revenue / spend : 0;

        return {
            conceptId,
            performance: { spend, purchases, revenue, cpa, roas, impressions, clicks, leads, ctr, cpc },
            intentMix,
            creativeCategoryMix,
            topAds: ads.sort((a, b) => b.performance.spend - a.performance.spend).slice(0, 5),
            numericContext: {
                uniqueAds: adIds.length,
                daysInRange: ads.length > 0 ? new Set(ads.map(a => a.date)).size : 0,
                avgDailySpend: ads.length > 0 ? spend / new Set(ads.map(a => a.date)).size : 0,
                avgCPCvsAccount: cpc, // placeholder — client can compare
            },
            evidenceFacts: [
                `Spend total en rango: $${spend.toFixed(2)}`,
                `CPA promedio: $${cpa.toFixed(2)}`,
                `ROAS: ${roas.toFixed(2)}x`,
                `CTR: ${ctr.toFixed(2)}%`,
                `Impresiones: ${impressions.toLocaleString()}`,
                `Creativos activos: ${adIds.length}`,
                `Mix de intención: ${Math.round(intentMix.BOFU * 100)}% BOFU, ${Math.round(intentMix.MOFU * 100)}% MOFU, ${Math.round(intentMix.TOFU * 100)}% TOFU`,
                Object.keys(creativeCategoryMix).length > 0
                    ? `Categorías: ${Object.entries(creativeCategoryMix).map(([k, v]) => `${k}(${v})`).join(', ')}`
                    : null
            ].filter(Boolean)
        };
    }
}
