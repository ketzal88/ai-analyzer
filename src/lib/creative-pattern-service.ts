import { EntitySnapshotEntry, ClassificationEntry } from "@/types/client-snapshot";
import { CreativeCategory, CreativeCategoryResult } from "@/lib/creative-classifier";

/**
 * Winning Patterns — extracted from DOMINANT_SCALABLE and HIDDEN_BOFU creatives.
 * Used to inform concept briefs with data-driven creative direction.
 */
export interface WinningPatterns {
    totalWinners: number;
    dominantFormat: "IMAGE" | "VIDEO" | "CAROUSEL" | "MIXED";
    dominantFunnelStage: "TOFU" | "MOFU" | "BOFU";
    avgCPA: number;
    avgROAS: number;
    avgSpendPct: number;
    topHooks: string[];
    patterns: PatternInsight[];
}

export interface PatternInsight {
    label: string;
    value: string;
    frequency: number; // % of winners with this pattern
}

export class CreativePatternService {

    /**
     * Analyze winning creatives to extract common patterns.
     * Winners = DOMINANT_SCALABLE + HIDDEN_BOFU categories.
     */
    static extractPatterns(
        ads: EntitySnapshotEntry[],
        classifications: ClassificationEntry[],
        categories: CreativeCategoryResult[],
        accountSpend7d: number
    ): WinningPatterns {
        const winnerCategories: CreativeCategory[] = ["DOMINANT_SCALABLE", "HIDDEN_BOFU"];
        const winnerIds = new Set(
            categories
                .filter(c => winnerCategories.includes(c.category))
                .map(c => c.entityId)
        );

        const winners = ads.filter(a => winnerIds.has(a.entityId));
        const winnerClassifs = classifications.filter(c => winnerIds.has(c.entityId));

        if (winners.length === 0) {
            return {
                totalWinners: 0,
                dominantFormat: "MIXED",
                dominantFunnelStage: "BOFU",
                avgCPA: 0,
                avgROAS: 0,
                avgSpendPct: 0,
                topHooks: [],
                patterns: [],
            };
        }

        // Compute averages
        let totalSpend = 0;
        let totalConversions = 0;
        let totalRevenue = 0;

        for (const w of winners) {
            const r = w.rolling;
            totalSpend += r.spend_7d || 0;
            totalConversions += (r.purchases_7d || 0) + (r.leads_7d || 0) + (r.whatsapp_7d || 0) + (r.installs_7d || 0);
            totalRevenue += (r.roas_7d || 0) * (r.spend_7d || 0);
        }

        const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
        const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        const avgSpendPct = accountSpend7d > 0 ? (totalSpend / accountSpend7d) * 100 / winners.length : 0;

        // Dominant funnel stage
        const intentCounts = { TOFU: 0, MOFU: 0, BOFU: 0 };
        for (const c of winnerClassifs) {
            const stage = c.intentStage as keyof typeof intentCounts;
            if (stage in intentCounts) intentCounts[stage]++;
        }
        const dominantFunnelStage = (Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "BOFU") as "TOFU" | "MOFU" | "BOFU";

        // Extract hook patterns from ad names (common naming convention includes hooks/angles)
        const topHooks = this.extractHooksFromNames(winners);

        // Build pattern insights
        const patterns: PatternInsight[] = [];

        // High-frequency winners (frequency > 3)
        const highFreqCount = winners.filter(w => (w.rolling.frequency_7d || 0) > 3).length;
        if (highFreqCount > 0) {
            patterns.push({
                label: "Alta Frecuencia",
                value: `${highFreqCount} de ${winners.length} ganadores tienen freq > 3`,
                frequency: Math.round((highFreqCount / winners.length) * 100)
            });
        }

        // Concentration pattern
        const highSpendWinners = winners.filter(w => {
            const pct = accountSpend7d > 0 ? ((w.rolling.spend_7d || 0) / accountSpend7d) * 100 : 0;
            return pct > 20;
        });
        if (highSpendWinners.length > 0) {
            patterns.push({
                label: "Alta Concentración",
                value: `${highSpendWinners.length} creativos concentran > 20% del gasto cada uno`,
                frequency: Math.round((highSpendWinners.length / winners.length) * 100)
            });
        }

        // Scale decision pattern
        const scaleCount = winnerClassifs.filter(c => c.finalDecision === "SCALE").length;
        if (scaleCount > 0) {
            patterns.push({
                label: "Listos para Escalar",
                value: `${scaleCount} de ${winners.length} con decisión SCALE`,
                frequency: Math.round((scaleCount / winners.length) * 100)
            });
        }

        return {
            totalWinners: winners.length,
            dominantFormat: "MIXED", // Would need creative metadata for format detection
            dominantFunnelStage,
            avgCPA,
            avgROAS,
            avgSpendPct,
            topHooks,
            patterns,
        };
    }

    /**
     * Extract common naming patterns/hooks from winner ad names.
     * Many teams encode hooks, angles, or variants in ad names
     * (e.g., "hook-urgency_video_v2", "testimonial_carousel").
     */
    private static extractHooksFromNames(winners: EntitySnapshotEntry[]): string[] {
        const tokenCounts = new Map<string, number>();

        for (const w of winners) {
            if (!w.name) continue;
            // Split by common separators and extract meaningful tokens
            const tokens = w.name
                .toLowerCase()
                .split(/[_\-|>/\s]+/)
                .filter(t => t.length > 2 && !t.match(/^(ad|v\d|copy|img|vid|act|set)\d*$/));

            for (const token of tokens) {
                tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
            }
        }

        // Return tokens that appear in more than 1 winner, sorted by frequency
        return [...tokenCounts.entries()]
            .filter(([_, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([token]) => token);
    }
}
