import { ClassificationEntry, EntitySnapshotEntry } from "@/types/client-snapshot";
import { EntityRollingMetrics } from "@/types/performance-snapshots";

/**
 * Creative Category — classifies each ad into one of 6 strategic categories
 * based on its performance, classification, and relative position in the account.
 */
export type CreativeCategory =
    | "DOMINANT_SCALABLE"
    | "WINNER_SATURATING"
    | "HIDDEN_BOFU"
    | "INEFFICIENT_TOFU"
    | "ZOMBIE"
    | "NEW_INSUFFICIENT_DATA";

export interface CreativeCategoryResult {
    entityId: string;
    category: CreativeCategory;
    reasoning: string;
}

export class CreativeClassifier {

    /**
     * Classify all ads in an account into strategic categories.
     *
     * @param ads - Ad-level entity snapshot entries with rolling metrics
     * @param classifications - Ad-level classification entries
     * @param accountSpend7d - Total account spend in last 7 days (for concentration calc)
     * @param targetCpa - Client's target CPA (optional)
     */
    static classifyAll(
        ads: EntitySnapshotEntry[],
        classifications: ClassificationEntry[],
        accountSpend7d: number,
        targetCpa?: number
    ): CreativeCategoryResult[] {
        const results: CreativeCategoryResult[] = [];

        // Calculate P25 spend for "hidden" threshold
        const spends = ads.map(a => a.rolling.spend_7d || 0).filter(s => s > 0).sort((a, b) => a - b);
        const p25Spend = spends.length > 0 ? spends[Math.floor(spends.length * 0.25)] : 0;

        for (const ad of ads) {
            const classif = classifications.find(c => c.entityId === ad.entityId && c.level === "ad");
            const spend7d = ad.rolling.spend_7d || 0;
            const impressions = ad.rolling.impressions_7d || 0;
            const daysActive = ad.rolling.days_active || 0;

            // Get conversion metric based on what's available
            const conversions7d = (ad.rolling.purchases_7d || 0)
                + (ad.rolling.leads_7d || 0)
                + (ad.rolling.whatsapp_7d || 0)
                + (ad.rolling.installs_7d || 0);

            const spendPct = accountSpend7d > 0 ? (spend7d / accountSpend7d) * 100 : 0;
            const cpa7d = conversions7d > 0 ? spend7d / conversions7d : Infinity;

            const category = this.classifyAd({
                entityId: ad.entityId,
                spend7d,
                spendPct,
                impressions,
                conversions7d,
                cpa7d,
                daysActive,
                p25Spend,
                targetCpa,
                classif,
            });

            results.push(category);
        }

        return results;
    }

    private static classifyAd(params: {
        entityId: string;
        spend7d: number;
        spendPct: number;
        impressions: number;
        conversions7d: number;
        cpa7d: number;
        daysActive: number;
        p25Spend: number;
        targetCpa?: number;
        classif?: ClassificationEntry;
    }): CreativeCategoryResult {
        const {
            entityId, spend7d, spendPct, impressions, conversions7d,
            cpa7d, daysActive, p25Spend, targetCpa, classif
        } = params;

        const isBOFU = classif?.intentStage === "BOFU";
        const isScale = classif?.finalDecision === "SCALE";
        const hasFatigue = classif?.fatigueState === "REAL" || classif?.fatigueState === "AUDIENCE_SATURATION";

        // 1. NEW / INSUFFICIENT DATA
        if (daysActive < 4 && impressions < 2000) {
            return {
                entityId,
                category: "NEW_INSUFFICIENT_DATA",
                reasoning: `Activo hace ${daysActive} días con ${impressions} impresiones — datos insuficientes.`
            };
        }

        // 2. ZOMBIE — spending but zero conversions
        if (spend7d > 50 && conversions7d === 0) {
            return {
                entityId,
                category: "ZOMBIE",
                reasoning: `$${spend7d.toFixed(0)} gastados en 7d con 0 conversiones.`
            };
        }

        // 3. DOMINANT SCALABLE — BOFU + SCALE + high spend concentration
        if (isBOFU && (isScale || (targetCpa && cpa7d <= targetCpa)) && spendPct > 30) {
            return {
                entityId,
                category: "DOMINANT_SCALABLE",
                reasoning: `BOFU con ${spendPct.toFixed(0)}% del gasto total. CPA: $${cpa7d.toFixed(2)}.`
            };
        }

        // 4. WINNER SATURATING — BOFU with real fatigue or audience saturation
        if (isBOFU && hasFatigue) {
            return {
                entityId,
                category: "WINNER_SATURATING",
                reasoning: `BOFU con fatiga ${classif?.fatigueState}. Necesita rotación de concepto.`
            };
        }

        // 5. HIDDEN BOFU — BOFU but underfunded (spend < P25)
        if (isBOFU && spend7d < p25Spend && conversions7d > 0) {
            return {
                entityId,
                category: "HIDDEN_BOFU",
                reasoning: `BOFU sub-presupuestado ($${spend7d.toFixed(0)} < P25 $${p25Spend.toFixed(0)}).`
            };
        }

        // 6. INEFFICIENT TOFU — TOFU with high CPA and significant spend
        const isTOFU = classif?.intentStage === "TOFU";
        if (isTOFU && targetCpa && cpa7d > targetCpa * 1.5 && spend7d > 100) {
            return {
                entityId,
                category: "INEFFICIENT_TOFU",
                reasoning: `TOFU con CPA $${cpa7d.toFixed(2)} (${((cpa7d / targetCpa) * 100).toFixed(0)}% del target). Gasto: $${spend7d.toFixed(0)}.`
            };
        }

        // Default: check for zombie with lower threshold or return NEW if doesn't fit
        if (conversions7d === 0 && spend7d > 30) {
            return {
                entityId,
                category: "ZOMBIE",
                reasoning: `Sin conversiones con $${spend7d.toFixed(0)} de gasto.`
            };
        }

        // Doesn't match a strong category — return based on most likely
        if (isBOFU && spendPct > 15) {
            return {
                entityId,
                category: "DOMINANT_SCALABLE",
                reasoning: `BOFU con buen rendimiento. ${spendPct.toFixed(0)}% del gasto.`
            };
        }

        return {
            entityId,
            category: "NEW_INSUFFICIENT_DATA",
            reasoning: `No cumple criterios claros para categorización. Datos limitados.`
        };
    }
}
