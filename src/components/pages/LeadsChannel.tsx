"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, formatRangeLabel, getComparisonRange } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import KPICard, { calcDelta } from "@/components/ui/KPICard";
import { useAnalyst } from "@/contexts/AnalystContext";
import FunnelCalculator from "@/components/leads/FunnelCalculator";
import { LeadsFunnelStage, LeadsCloserBreakdown, LeadsUtmBreakdown } from "@/types/leads";
import { Client } from "@/types";

function formatNumber(value: number | undefined, decimals = 0): string {
    if (value === undefined || value === null) return "—";
    return value.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return "—";
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
}

function formatPct(value: number | undefined): string {
    if (value === undefined || value === null) return "—";
    return `${value.toFixed(1)}%`;
}

export default function LeadsChannel() {
    const { selectedClientId: clientId, activeClients } = useClient();
    const { openAnalyst } = useAnalyst();
    const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [prevSnapshots, setPrevSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [range, setRange] = useState<UnifiedDateRange>(() => resolvePreset("mtd"));
    const [showCalculator, setShowCalculator] = useState(false);

    const client = activeClients.find((c: Client) => c.id === clientId);
    const isFullFunnel = client?.leadsConfig?.mode !== "whatsapp_simple";

    useEffect(() => {
        if (!clientId) return;
        setLoading(true);

        const { start, end } = range;
        const compRange = getComparisonRange(range);
        const { start: prevStart, end: prevEnd } = compRange;

        Promise.all([
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=LEADS&startDate=${start}&endDate=${end}`).then((r) => r.json()),
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=LEADS&startDate=${prevStart}&endDate=${prevEnd}`).then((r) => r.json()),
        ])
            .then(([current, prev]) => {
                setSnapshots(current.snapshots || []);
                setPrevSnapshots(prev.snapshots || []);
            })
            .finally(() => setLoading(false));
    }, [clientId, range]);

    // Aggregate current period
    const totals = snapshots.reduce(
        (acc, s) => ({
            totalLeads: acc.totalLeads + (s.metrics.totalLeads || 0),
            qualifiedLeads: acc.qualifiedLeads + (s.metrics.qualifiedLeads || 0),
            attendedCalls: acc.attendedCalls + (s.metrics.attendedCalls || 0),
            noShows: acc.noShows + (s.metrics.noShows || 0),
            newClients: acc.newClients + (s.metrics.newClients || 0),
            followUps: acc.followUps + (s.metrics.followUps || 0),
            revenue: acc.revenue + (s.metrics.leadRevenue || s.metrics.revenue || 0),
            spamLeads: acc.spamLeads + (s.metrics.spamLeads || 0),
        }),
        { totalLeads: 0, qualifiedLeads: 0, attendedCalls: 0, noShows: 0, newClients: 0, followUps: 0, revenue: 0, spamLeads: 0 }
    );

    const prevTotals = prevSnapshots.reduce(
        (acc, s) => ({
            totalLeads: acc.totalLeads + (s.metrics.totalLeads || 0),
            qualifiedLeads: acc.qualifiedLeads + (s.metrics.qualifiedLeads || 0),
            attendedCalls: acc.attendedCalls + (s.metrics.attendedCalls || 0),
            newClients: acc.newClients + (s.metrics.newClients || 0),
            revenue: acc.revenue + (s.metrics.leadRevenue || s.metrics.revenue || 0),
        }),
        { totalLeads: 0, qualifiedLeads: 0, attendedCalls: 0, newClients: 0, revenue: 0 }
    );

    // Compute rates
    const qualRate = totals.totalLeads > 0 ? (totals.qualifiedLeads / totals.totalLeads) * 100 : 0;
    const scheduled = totals.attendedCalls + totals.noShows;
    const attendRate = scheduled > 0 ? (totals.attendedCalls / scheduled) * 100 : 0;
    const closeRate = totals.attendedCalls > 0 ? (totals.newClients / totals.attendedCalls) * 100 : 0;

    // Cost metrics (aggregate from rawData.metaSpend)
    const totalMetaSpend = snapshots.reduce((sum, s) => sum + ((s.rawData?.metaSpend as number) || 0), 0);
    const totalMetaImpressions = snapshots.reduce((sum, s) => sum + ((s.rawData?.metaImpressions as number) || 0), 0);
    const totalMetaClicks = snapshots.reduce((sum, s) => sum + ((s.rawData?.metaClicks as number) || 0), 0);
    const cpl = totals.totalLeads > 0 ? totalMetaSpend / totals.totalLeads : 0;
    const cpql = totals.qualifiedLeads > 0 ? totalMetaSpend / totals.qualifiedLeads : 0;
    const cac = totals.newClients > 0 ? totalMetaSpend / totals.newClients : 0;

    // Ads KPIs
    const metaCpm = totalMetaImpressions > 0 ? (totalMetaSpend / totalMetaImpressions) * 1000 : 0;
    const metaCpc = totalMetaClicks > 0 ? totalMetaSpend / totalMetaClicks : 0;
    const metaCtr = totalMetaImpressions > 0 ? (totalMetaClicks / totalMetaImpressions) * 100 : 0;
    const impPerMeeting = totals.totalLeads > 0 && totalMetaImpressions > 0 ? totalMetaImpressions / totals.totalLeads : 0;
    const costPerAttendance = totals.attendedCalls > 0 && totalMetaSpend > 0 ? totalMetaSpend / totals.attendedCalls : 0;
    const costPerClose = totals.newClients > 0 && totalMetaSpend > 0 ? totalMetaSpend / totals.newClients : 0;

    // Monthly report data — group snapshots by YYYY-MM
    const monthlyData = React.useMemo(() => {
        const byMonth = new Map<string, {
            impressions: number; clicks: number; spend: number;
            totalLeads: number; qualifiedLeads: number; attendedCalls: number; noShows: number;
            newClients: number; revenue: number;
        }>();

        for (const s of snapshots) {
            const month = s.date.slice(0, 7); // YYYY-MM
            const existing = byMonth.get(month) || {
                impressions: 0, clicks: 0, spend: 0,
                totalLeads: 0, qualifiedLeads: 0, attendedCalls: 0, noShows: 0,
                newClients: 0, revenue: 0,
            };
            existing.impressions += (s.rawData?.metaImpressions as number) || 0;
            existing.clicks += (s.rawData?.metaClicks as number) || 0;
            existing.spend += (s.rawData?.metaSpend as number) || 0;
            existing.totalLeads += s.metrics.totalLeads || 0;
            existing.qualifiedLeads += s.metrics.qualifiedLeads || 0;
            existing.attendedCalls += s.metrics.attendedCalls || 0;
            existing.noShows += s.metrics.noShows || 0;
            existing.newClients += s.metrics.newClients || 0;
            existing.revenue += s.metrics.leadRevenue || s.metrics.revenue || 0;
            byMonth.set(month, existing);
        }

        return Array.from(byMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, d]) => {
                const scheduled = d.attendedCalls + d.noShows;
                return {
                    month,
                    label: new Date(month + "-15").toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
                    alcance: d.impressions,
                    cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
                    cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
                    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
                    agendas: d.totalLeads,
                    calificadas: d.qualifiedLeads,
                    asistencia: d.attendedCalls,
                    pctAsistencia: scheduled > 0 ? (d.attendedCalls / scheduled) * 100 : 0,
                    cierres: d.newClients,
                    pctCierre: d.attendedCalls > 0 ? (d.newClients / d.attendedCalls) * 100 : 0,
                    inversion: d.spend,
                    cplMonth: d.totalLeads > 0 ? d.spend / d.totalLeads : 0,
                    cpqlMonth: d.qualifiedLeads > 0 ? d.spend / d.qualifiedLeads : 0,
                    costoAsistencia: d.attendedCalls > 0 ? d.spend / d.attendedCalls : 0,
                    costoCierre: d.newClients > 0 ? d.spend / d.newClients : 0,
                    cashGenerado: d.revenue,
                    impReunion: d.totalLeads > 0 ? d.impressions / d.totalLeads : 0,
                };
            });
    }, [snapshots]);

    // Aggregate rawData breakdowns across snapshots
    const allClosers = new Map<string, LeadsCloserBreakdown>();
    const allUtm = new Map<string, LeadsUtmBreakdown>();

    for (const s of snapshots) {
        const closers = (s.rawData?.byCloser as LeadsCloserBreakdown[]) || [];
        for (const c of closers) {
            const existing = allClosers.get(c.closer);
            if (existing) {
                existing.totalLeads += c.totalLeads;
                existing.qualified += c.qualified;
                existing.attended += c.attended;
                existing.newClients += c.newClients;
                existing.revenue += c.revenue;
            } else {
                allClosers.set(c.closer, { ...c });
            }
        }

        const utms = (s.rawData?.byUtmCampaign as LeadsUtmBreakdown[]) || [];
        for (const u of utms) {
            const existing = allUtm.get(u.campaign);
            if (existing) {
                existing.totalLeads += u.totalLeads;
                existing.qualified += u.qualified;
                existing.revenue += u.revenue;
            } else {
                allUtm.set(u.campaign, { ...u });
            }
        }
    }

    // Recompute rates for aggregated closers
    const closerBreakdown = Array.from(allClosers.values()).map((c) => ({
        ...c,
        qualificationRate: c.totalLeads > 0 ? (c.qualified / c.totalLeads) * 100 : 0,
        closeRate: c.attended > 0 ? (c.newClients / c.attended) * 100 : 0,
    })).sort((a, b) => b.newClients - a.newClients);

    const utmBreakdown = Array.from(allUtm.values()).map((u) => ({
        ...u,
        qualificationRate: u.totalLeads > 0 ? (u.qualified / u.totalLeads) * 100 : 0,
    })).sort((a, b) => b.totalLeads - a.totalLeads);

    if (!clientId) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-[60vh]">
                    <p className="text-text-muted">Seleccioná un cliente para ver el canal de Leads.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-header text-text-primary">Leads</h1>
                        <p className="text-small text-text-muted mt-1">
                            Funnel de ventas y métricas CRM &middot; {formatRangeLabel(range)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCalculator(!showCalculator)}
                            className="px-3 py-1.5 text-small font-bold text-classic border border-classic rounded hover:bg-classic/10 transition-colors"
                        >
                            Calculadora
                        </button>
                        <button
                            onClick={() => openAnalyst("leads")}
                            className="px-3 py-1.5 text-small font-bold text-classic border border-classic rounded hover:bg-classic/10 transition-colors"
                        >
                            Analizar con IA
                        </button>
                        <DateRangePicker value={range} onChange={setRange} />
                    </div>
                </div>

                {/* Calculator (collapsible) */}
                {showCalculator && clientId && (
                    <FunnelCalculator clientId={clientId} />
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-classic" />
                    </div>
                ) : snapshots.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-text-muted text-body">No hay datos de leads para este período.</p>
                        <p className="text-text-muted text-small mt-2">Configurá el webhook de GHL o creá leads manualmente en el CRM.</p>
                    </div>
                ) : (
                    <>
                        {/* KPI Row 1 — Volume */}
                        <div className={`grid ${isFullFunnel ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
                            <KPICard label="Total Leads" value={formatNumber(totals.totalLeads)} delta={calcDelta(totals.totalLeads, prevTotals.totalLeads)} subtitle={`${formatPct(qualRate)} calif.`} />
                            <KPICard label="Calificados" value={formatNumber(totals.qualifiedLeads)} delta={calcDelta(totals.qualifiedLeads, prevTotals.qualifiedLeads)} />
                            {isFullFunnel && (
                                <KPICard label="Asistieron" value={formatNumber(totals.attendedCalls)} delta={calcDelta(totals.attendedCalls, prevTotals.attendedCalls)} subtitle={`${formatPct(attendRate)} asist.`} />
                            )}
                            <KPICard label="Nuevos Clientes" value={formatNumber(totals.newClients)} delta={calcDelta(totals.newClients, prevTotals.newClients)} subtitle={`${formatPct(closeRate)} close`} />
                        </div>

                        {/* KPI Row 2 — Cost */}
                        {totalMetaSpend > 0 && (
                            <div className="grid grid-cols-4 gap-4">
                                <KPICard label="CPL" value={formatCurrency(cpl)} subtitle="Costo por Lead" />
                                <KPICard label="CPQL" value={formatCurrency(cpql)} subtitle="Costo por Calificado" />
                                <KPICard label="CAC" value={formatCurrency(cac)} subtitle="Costo de Adquisición" />
                                <KPICard label="Revenue" value={formatCurrency(totals.revenue)} delta={calcDelta(totals.revenue, prevTotals.revenue)} />
                            </div>
                        )}

                        {/* KPI Row 3 — Ads Metrics */}
                        {totalMetaImpressions > 0 && (
                            <div className="grid grid-cols-7 gap-3">
                                <KPICard label="Alcance" value={formatNumber(totalMetaImpressions)} />
                                <KPICard label="CPM" value={formatCurrency(metaCpm)} />
                                <KPICard label="CPC" value={formatCurrency(metaCpc)} />
                                <KPICard label="CTR" value={formatPct(metaCtr)} />
                                <KPICard label="Imp/Reunión" value={formatNumber(impPerMeeting, 0)} />
                                <KPICard label="Costo/Asist." value={formatCurrency(costPerAttendance)} />
                                <KPICard label="Costo/Cierre" value={formatCurrency(costPerClose)} />
                            </div>
                        )}

                        {/* Funnel Visualization */}
                        <div className="p-6 bg-special border border-argent rounded-lg">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Funnel de Conversión
                            </h2>
                            <div className="space-y-3">
                                {/* Leads bar (100%) */}
                                <FunnelBar
                                    label={isFullFunnel ? "Leads" : "Conversaciones"}
                                    count={totals.totalLeads}
                                    pct={100}
                                    color="bg-classic"
                                />
                                <FunnelBar
                                    label="Calificados"
                                    count={totals.qualifiedLeads}
                                    pct={qualRate}
                                    color="bg-classic/70"
                                />
                                {isFullFunnel && (
                                    <FunnelBar
                                        label="Asistieron"
                                        count={totals.attendedCalls}
                                        pct={totals.totalLeads > 0 ? (totals.attendedCalls / totals.totalLeads) * 100 : 0}
                                        color="bg-classic/50"
                                    />
                                )}
                                <FunnelBar
                                    label="Nuevos Clientes"
                                    count={totals.newClients}
                                    pct={totals.totalLeads > 0 ? (totals.newClients / totals.totalLeads) * 100 : 0}
                                    color="bg-synced"
                                />
                            </div>
                        </div>

                        {/* UTM Attribution Table */}
                        {utmBreakdown.length > 0 && utmBreakdown[0].campaign !== "Sin UTM" && (
                            <div className="p-6 bg-special border border-argent rounded-lg">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Atribución por Campaña / Anuncio
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-argent">
                                                <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Campaña</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Leads</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Calificados</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">% Calif.</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {utmBreakdown.slice(0, 15).map((u) => (
                                                <tr key={u.campaign} className="border-b border-argent/50 hover:bg-stellar/50">
                                                    <td className="px-3 py-2 text-small text-text-primary truncate max-w-[300px]" title={u.campaign}>
                                                        {u.campaign}
                                                    </td>
                                                    <td className="px-3 py-2 text-small text-text-primary font-mono text-right">{u.totalLeads}</td>
                                                    <td className="px-3 py-2 text-small text-synced font-mono text-right">{u.qualified}</td>
                                                    <td className="px-3 py-2 text-small text-text-muted font-mono text-right">{formatPct(u.qualificationRate)}</td>
                                                    <td className="px-3 py-2 text-small text-text-primary font-mono text-right">{formatCurrency(u.revenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Closer Performance */}
                        {closerBreakdown.length > 0 && (
                            <div className="p-6 bg-special border border-argent rounded-lg">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Performance por Closer
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-argent">
                                                <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Closer</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Leads</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Calificados</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">% Calif.</th>
                                                {isFullFunnel && (
                                                    <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">% Asist.</th>
                                                )}
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">% Close</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Clientes</th>
                                                <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {closerBreakdown.map((c) => (
                                                <tr key={c.closer} className="border-b border-argent/50 hover:bg-stellar/50">
                                                    <td className="px-3 py-2 text-small text-text-primary font-medium">{c.closer}</td>
                                                    <td className="px-3 py-2 text-small text-text-muted font-mono text-right">{c.totalLeads}</td>
                                                    <td className="px-3 py-2 text-small text-synced font-mono text-right">{c.qualified}</td>
                                                    <td className="px-3 py-2 text-small text-text-muted font-mono text-right">{formatPct(c.qualificationRate)}</td>
                                                    {isFullFunnel && (
                                                        <td className="px-3 py-2 text-small text-text-muted font-mono text-right">{formatPct(c.attendanceRate)}</td>
                                                    )}
                                                    <td className="px-3 py-2 text-small text-text-primary font-mono font-bold text-right">{formatPct(c.closeRate)}</td>
                                                    <td className="px-3 py-2 text-small text-synced font-mono font-bold text-right">{c.newClients}</td>
                                                    <td className="px-3 py-2 text-small text-text-primary font-mono text-right">{formatCurrency(c.revenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Monthly Report Table */}
                        {monthlyData.length > 1 && (
                            <div className="p-6 bg-special border border-argent rounded-lg">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Reporte Mensual
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-argent">
                                                <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold sticky left-0 bg-special z-10">Métrica</th>
                                                {monthlyData.map((m) => (
                                                    <th key={m.month} className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold whitespace-nowrap">
                                                        {m.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <MonthlyRow label="Alcance" values={monthlyData.map((m) => formatNumber(m.alcance))} />
                                            <MonthlyRow label="CPM" values={monthlyData.map((m) => m.alcance > 0 ? formatCurrency(m.cpm) : "—")} />
                                            <MonthlyRow label="CPC" values={monthlyData.map((m) => m.alcance > 0 ? formatCurrency(m.cpc) : "—")} />
                                            <MonthlyRow label="CTR" values={monthlyData.map((m) => m.alcance > 0 ? formatPct(m.ctr) : "—")} />
                                            <MonthlyRow label="Agendas" values={monthlyData.map((m) => formatNumber(m.agendas))} highlight />
                                            <MonthlyRow label="Calificadas" values={monthlyData.map((m) => formatNumber(m.calificadas))} />
                                            {isFullFunnel && (
                                                <>
                                                    <MonthlyRow label="Asistencia" values={monthlyData.map((m) => formatNumber(m.asistencia))} />
                                                    <MonthlyRow label="% Asistencia" values={monthlyData.map((m) => formatPct(m.pctAsistencia))} />
                                                </>
                                            )}
                                            <MonthlyRow label="Cierres" values={monthlyData.map((m) => formatNumber(m.cierres))} highlight />
                                            <MonthlyRow label="% Cierre" values={monthlyData.map((m) => formatPct(m.pctCierre))} />
                                            <MonthlyRow label="Inversión" values={monthlyData.map((m) => formatCurrency(m.inversion))} />
                                            <MonthlyRow label="CPL" values={monthlyData.map((m) => m.agendas > 0 ? formatCurrency(m.cplMonth) : "—")} />
                                            <MonthlyRow label="CPQL" values={monthlyData.map((m) => m.calificadas > 0 ? formatCurrency(m.cpqlMonth) : "—")} />
                                            {isFullFunnel && (
                                                <MonthlyRow label="Costo/Asist." values={monthlyData.map((m) => m.asistencia > 0 ? formatCurrency(m.costoAsistencia) : "—")} />
                                            )}
                                            <MonthlyRow label="Costo/Cierre" values={monthlyData.map((m) => m.cierres > 0 ? formatCurrency(m.costoCierre) : "—")} />
                                            <MonthlyRow label="Cash Generado" values={monthlyData.map((m) => formatCurrency(m.cashGenerado))} highlight />
                                            <MonthlyRow label="Imp/Reunión" values={monthlyData.map((m) => m.agendas > 0 && m.alcance > 0 ? formatNumber(m.impReunion, 0) : "—")} />
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}

// ── Monthly Report Row Component ──────────────────────────────

function MonthlyRow({ label, values, highlight }: { label: string; values: string[]; highlight?: boolean }) {
    return (
        <tr className={`border-b border-argent/30 ${highlight ? "bg-classic/5" : ""}`}>
            <td className="px-3 py-1.5 text-small text-text-primary font-medium sticky left-0 bg-special z-10 whitespace-nowrap">
                {label}
            </td>
            {values.map((v, i) => (
                <td key={i} className={`px-3 py-1.5 text-small font-mono text-right ${highlight ? "text-text-primary font-bold" : "text-text-muted"}`}>
                    {v}
                </td>
            ))}
        </tr>
    );
}

// ── Funnel Bar Component ──────────────────────────────

function FunnelBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-32 text-right">
                <span className="text-small text-text-muted">{label}</span>
            </div>
            <div className="flex-1 h-8 bg-argent/20 rounded overflow-hidden relative">
                <div className={`h-full ${color} rounded transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
                <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-small font-black font-mono text-text-primary">{count}</span>
                    <span className="text-[10px] text-text-muted ml-2">({pct.toFixed(1)}%)</span>
                </div>
            </div>
        </div>
    );
}
