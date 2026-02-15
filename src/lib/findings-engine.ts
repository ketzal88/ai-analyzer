import { DiagnosticFinding, InsightDaily } from "@/types";

export function runDiagnosticRules(
    clientId: string,
    currentStats: any,
    previousStats: any,
    campaignStats: any[], // { id, name, spend, purchases, purchaseValue, clicks, impressions }
    allInsights: any[],
    currentDates: string[]
): DiagnosticFinding[] {
    const findings: DiagnosticFinding[] = [];
    const createdAt = new Date().toISOString();

    // Helper for generating IDs
    const genId = () => `f_${Math.random().toString(36).substr(2, 9)}`;

    // 1. CPA_SPIKE
    if (previousStats.cpa > 0) {
        const delta = (currentStats.cpa / previousStats.cpa) - 1;
        if (delta > 0.25) {
            findings.push({
                id: genId(), clientId,
                type: "CPA_SPIKE",
                title: "Pico Crítico en el Costo por Adquisición",
                description: `El CPA ha aumentado un ${Math.round(delta * 100)}% vs periodo anterior. La eficiencia está cayendo.`,
                severity: "CRITICAL",
                status: "ATTENTION",
                entities: [],
                evidence: { current: currentStats.cpa, previous: previousStats.cpa, delta: delta * 100, threshold: 25 },
                version: 1, createdAt
            });
        }
    }

    // 2. ROAS_DROP
    if (previousStats.roas > 0) {
        const delta = (currentStats.roas / previousStats.roas) - 1;
        if (delta < -0.15) {
            findings.push({
                id: genId(), clientId,
                type: "ROAS_DROP",
                title: "Caída en la Eficiencia de Ingresos (ROAS)",
                description: `El ROAS ha caído un ${Math.abs(Math.round(delta * 100))}% WoW. El retorno de inversión se está deteriorando.`,
                severity: "CRITICAL",
                status: "ATTENTION",
                entities: [],
                evidence: { current: currentStats.roas, previous: previousStats.roas, delta: delta * 100, threshold: -15 },
                version: 1, createdAt
            });
        }
    }

    // 3. CVR_DROP (Stable CTR, Falling CVR)
    if (previousStats.cvr > 0 && previousStats.ctr > 0) {
        const ctrDelta = Math.abs((currentStats.ctr / previousStats.ctr) - 1);
        const cvrDelta = (currentStats.cvr / previousStats.cvr) - 1;
        if (ctrDelta < 0.05 && cvrDelta < -0.15) {
            findings.push({
                id: genId(), clientId,
                type: "CVR_DROP",
                title: "Caída de Conversión en Web",
                description: `El tráfico es estable (CTR igual) pero la conversión en web cayó un ${Math.abs(Math.round(cvrDelta * 100))}%. Revisa landing page o stock.`,
                severity: "WARNING",
                status: "ATTENTION",
                entities: [],
                evidence: { current: currentStats.cvr, previous: previousStats.cvr, delta: cvrDelta * 100, threshold: -15 },
                version: 1, createdAt
            });
        }
    }

    // 4. CTR_DROP
    if (previousStats.ctr > 0) {
        const delta = (currentStats.ctr / previousStats.ctr) - 1;
        if (delta < -0.15) {
            findings.push({
                id: genId(), clientId,
                type: "CTR_DROP",
                title: "Fatiga de Anuncios (CTR)",
                description: `El CTR cayó un ${Math.abs(Math.round(delta * 100))}%. Tus anuncios están perdiendo relevancia o la audiencia está saturada.`,
                severity: "WARNING",
                status: "ATTENTION",
                entities: [],
                evidence: { current: currentStats.ctr, previous: previousStats.ctr, delta: delta * 100, threshold: -15 },
                version: 1, createdAt
            });
        }
    }

    // 5. SPEND_CONCENTRATION
    // Sort campaigns by spend
    const sortedCampaigns = [...campaignStats].sort((a, b) => b.spend - a.spend);
    const totalSpend = currentStats.spend;

    if (sortedCampaigns.length > 0) {
        const top20Count = Math.max(1, Math.round(sortedCampaigns.length * 0.2));
        const topSpend = sortedCampaigns.slice(0, top20Count).reduce((s, c) => s + c.spend, 0);

        if (totalSpend > 0 && (topSpend / totalSpend) > 0.8 && sortedCampaigns.length > 3) {
            findings.push({
                id: genId(), clientId,
                type: "SPEND_CONCENTRATION",
                title: "Alta Concentración de Presupuesto",
                description: `El ${(topSpend / totalSpend * 100).toFixed(0)}% del gasto está en solo ${top20Count} campañas. Riesgo de dependencia.`,
                severity: "WARNING",
                status: "ATTENTION",
                entities: sortedCampaigns.slice(0, top20Count).map(c => c.name),
                evidence: { current: (topSpend / totalSpend) * 100, previous: 0, delta: 0, threshold: 80 },
                version: 1, createdAt
            });
        }

        // 6. NO_CONVERSIONS_HIGH_SPEND
        const avgCPA = currentStats.cpa || 50;
        const bleedingCampaigns = sortedCampaigns.filter(c => c.purchases === 0 && c.spend > (avgCPA * 2));

        if (bleedingCampaigns.length > 0) {
            findings.push({
                id: genId(), clientId,
                type: "NO_CONVERSIONS_HIGH_SPEND",
                title: "Fuga de Presupuesto (Cero Ventas)",
                description: `${bleedingCampaigns.length} campañas han gastado >2x CPA sin ninguna conversión. Pausar inmediatamente.`,
                severity: "CRITICAL",
                status: "ATTENTION",
                entities: bleedingCampaigns.map(c => c.name),
                evidence: { current: bleedingCampaigns.reduce((s, c) => s + c.spend, 0), previous: 0, delta: 0, threshold: avgCPA * 2 },
                version: 1, createdAt
            });
        }

        // 7. UNDERFUNDED_WINNERS
        const winners = sortedCampaigns.filter(c =>
            c.spend > 0 &&
            c.purchases > 0 &&
            (c.spend / c.purchases) < (currentStats.cpa * 0.8) && // Better CPA
            (c.spend < (totalSpend / sortedCampaigns.length))     // Low spend
        );

        if (winners.length > 0) {
            findings.push({
                id: genId(), clientId,
                type: "UNDERFUNDED_WINNERS",
                title: "Oportunidad de Escalamiento",
                description: `${winners.length} campañas tienen excelente CPA (20% mejor que avg) pero bajo presupuesto. Aumentar inversión.`,
                severity: "HEALTHY",
                status: "OPTIMAL",
                entities: winners.map(c => c.name),
                evidence: { current: winners.length, previous: 0, delta: 0, threshold: 0 },
                version: 1, createdAt
            });
        }
    }

    // 8. VOLATILITY
    // Adapt to support both InsightDaily (flat) and DailyEntitySnapshot (nested performance)
    const dailyCPAs = allInsights
        .filter(i => {
            const p = i.performance || i;
            const purchases = p.purchases || 0;
            return currentDates.includes(i.date) && purchases > 0;
        })
        .map(i => {
            const p = i.performance || i;
            return (p.spend || 0) / (p.purchases || 1);
        });

    if (dailyCPAs.length > 3) {
        const mean = dailyCPAs.reduce((a, b) => a + b, 0) / dailyCPAs.length;
        const variance = dailyCPAs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyCPAs.length;
        const stdDev = Math.sqrt(variance);

        if (mean > 0 && (stdDev / mean) > 0.5) {
            findings.push({
                id: genId(), clientId,
                type: "VOLATILITY",
                title: "Inestabilidad Extrema",
                description: "El CPA diario fluctúa más del 50%. El algoritmo no logra estabilizarse.",
                severity: "WARNING",
                status: "ATTENTION",
                entities: [],
                evidence: { current: (stdDev / mean) * 100, previous: 0, delta: 0, threshold: 50 },
                version: 1, createdAt
            });
        }
    }

    return findings;
}
