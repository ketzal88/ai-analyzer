"use client";
import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import Link from "next/link";
import { useClient } from "@/contexts/ClientContext";
import { EntityRollingMetrics, EntityLevel } from "@/types/performance-snapshots";
import { EntityClassification, FinalDecision, IntentStage, LearningState, FatigueState } from "@/types/classifications";
import { RecommendationDoc } from "@/types/ai-recommendations";

export default function AdsManager() {
    const {
        selectedClientId: clientId,
        activeClients,
        performanceData,
        isPerformanceLoading: isLoading,
        refreshPerformance
    } = useClient();

    const rollingMetrics = performanceData?.rolling || [];
    const classifications = performanceData?.classifications || [];
    const alerts = performanceData?.alerts || [];

    const client = useMemo(() => activeClients.find(c => c.id === clientId), [clientId, activeClients]);
    const businessType = client?.businessType || 'ecommerce';
    const [level, setLevel] = useState<EntityLevel>("ad");
    const [showAlerts, setShowAlerts] = useState(false);

    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [recommendation, setRecommendation] = useState<RecommendationDoc | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'impactScore',
        direction: 'desc'
    });

    const handleDateChange = (date: string) => {
        refreshPerformance(date === 'latest' ? undefined : date);
    };

    // Auto-refresh handled by ClientContext on clientId change

    const filteredRolling = useMemo(() => {
        const list = rollingMetrics.filter(m => m.level === level);

        return list.sort((a, b) => {
            const clA = classifications.find(c => c.entityId === a.entityId && c.level === a.level);
            const clB = classifications.find(c => c.entityId === b.entityId && c.level === b.level);

            let valA: any;
            let valB: any;

            switch (sortConfig.key) {
                case 'name': valA = a.name; valB = b.name; break;
                case 'spend_7d': valA = a.rolling.spend_7d; valB = b.rolling.spend_7d; break;
                case 'impressions_7d': valA = a.rolling.impressions_7d; valB = b.rolling.impressions_7d; break;
                case 'ctr_7d': valA = a.rolling.ctr_7d; valB = b.rolling.ctr_7d; break;
                case 'hook_rate_7d': valA = a.rolling.hook_rate_7d; valB = b.rolling.hook_rate_7d; break;
                case 'funnel': valA = clA?.intentStage; valB = clB?.intentStage; break;
                case 'fitr_7d': valA = a.rolling.fitr_7d; valB = b.rolling.fitr_7d; break;
                case 'cpa_7d': valA = a.rolling.cpa_7d; valB = b.rolling.cpa_7d; break;
                case 'roas_7d': valA = a.rolling.roas_7d; valB = b.rolling.roas_7d; break;
                case 'learningState': valA = clA?.learningState; valB = clB?.learningState; break;
                case 'fatigueState': valA = clA?.fatigueState; valB = clB?.fatigueState; break;
                case 'finalDecision': valA = clA?.finalDecision; valB = clB?.finalDecision; break;
                case 'impactScore': valA = clA?.impactScore; valB = clB?.impactScore; break;
                default: valA = 0; valB = 0;
            }

            if (valA === valB) return 0;
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;

            const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
            return valA < valB ? -1 * multiplier : 1 * multiplier;
        });
    }, [rollingMetrics, level, sortConfig, classifications]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleRowClick = async (entityId: string) => {
        setSelectedEntityId(entityId);
        setIsDrawerOpen(true);
        setRecommendation(null);

        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch(`/api/recommendations/detail?clientId=${clientId}&level=${level}&entityId=${entityId}&rangeStart=${today}&rangeEnd=${today}`);
            const data = await res.json();
            if (data.status === 'success') {
                setRecommendation(data.recommendation);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const generateRecommendation = async () => {
        if (!selectedEntityId || !clientId) return;
        setIsGenerating(true);
        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch('/api/recommendations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    range: { start: today, end: today },
                    level,
                    entityId: selectedEntityId
                })
            });
            const data = await res.json();
            if (data.status === 'generated' || data.status === 'cached') {
                setRecommendation(data.recommendation);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedMetrics = useMemo(() => rollingMetrics.find(m => m.entityId === selectedEntityId), [rollingMetrics, selectedEntityId]);
    const selectedClass = useMemo(() => classifications.find(c => c.entityId === selectedEntityId && c.level === level), [classifications, selectedEntityId, level]);
    const entityAlerts = useMemo(() => alerts.filter(a => a.entityId === selectedEntityId), [alerts, selectedEntityId]);

    // Alert counts for badges
    const criticalAlerts = alerts.filter(a => a.severity === "CRITICAL").length;
    const warningAlerts = alerts.filter(a => a.severity === "WARNING").length;

    const lastUpdateDate = rollingMetrics[0]?.lastUpdate;
    const dateRangeLabel = useMemo(() => {
        if (!lastUpdateDate) return "";
        const end = new Date(lastUpdateDate + "T12:00:00Z");
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        const formatDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        return `${formatDate(start)} - ${formatDate(end)}`;
    }, [lastUpdateDate]);

    if (isLoading && !rollingMetrics.length) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                    <div className="w-12 h-12 border-4 border-classic border-t-transparent rounded-full animate-spin" />
                    <p className="text-small font-black uppercase tracking-[0.3em] text-text-muted animate-pulse">Iniciando Motor Operativo...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-8 pb-32">
                {/* Modern Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-8 bg-classic rounded-full shadow-[0_0_15px_rgba(var(--classic-rgb),0.5)]" />
                            <h1 className="text-hero font-black text-text-primary uppercase tracking-tighter leading-none">Ads Manager</h1>
                        </div>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.25em] pl-5">
                            Nivel de Control Operativo GEM v2.0 • {dateRangeLabel && <span className="text-classic">{dateRangeLabel}</span>}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Alerts Toggle */}
                        <button
                            onClick={() => setShowAlerts(!showAlerts)}
                            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${showAlerts ? 'bg-classic/20 border-classic/40 text-classic' : 'bg-second/80 border-argent/40 text-text-muted hover:text-text-primary hover:bg-argent/10'}`}
                        >
                            <span>🔔</span>
                            <span>Alertas</span>
                            {(criticalAlerts + warningAlerts) > 0 && (
                                <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-[8px] font-black rounded-full ${criticalAlerts > 0 ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}>
                                    {criticalAlerts + warningAlerts}
                                </span>
                            )}
                        </button>

                        {/* Level Tabs */}
                        <div className="flex bg-second/80 backdrop-blur-md border border-argent/40 p-1 rounded-2xl shadow-xl">
                            {(['account', 'campaign', 'adset', 'ad'] as EntityLevel[]).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => setLevel(l)}
                                    className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${level === l ? 'bg-classic text-special scale-[1.05]' : 'text-text-muted hover:text-text-primary hover:bg-argent/10'}`}
                                >
                                    {l === 'ad' ? 'Anuncios' : l === 'adset' ? 'Conjuntos' : l === 'campaign' ? 'Campañas' : 'Cuenta'}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* Alerts Panel */}
                {showAlerts && alerts.length > 0 && (
                    <div className="relative group/alerts">
                        <div className="absolute -inset-1 bg-gradient-to-r from-red-500/10 via-yellow-500/10 to-classic/10 rounded-[2rem] blur-2xl opacity-30" />
                        <div className="relative bg-second/40 backdrop-blur-xl border border-argent/30 rounded-[1.5rem] overflow-hidden shadow-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm">🚨</span>
                                    <h3 className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em]">Smart Alerts Engine</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {criticalAlerts > 0 && (
                                        <span className="text-[8px] font-black bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                                            {criticalAlerts} CRÍTICAS
                                        </span>
                                    )}
                                    {warningAlerts > 0 && (
                                        <span className="text-[8px] font-black bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
                                            {warningAlerts} WARNING
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {[...alerts].sort((a, b) => {
                                    const sev: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
                                    return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3) || b.impactScore - a.impactScore;
                                }).slice(0, 6).map((alert) => (
                                    <div
                                        key={alert.id}
                                        onClick={() => handleRowClick(alert.entityId)}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.01] ${alert.severity === 'CRITICAL'
                                            ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                                            : alert.severity === 'WARNING'
                                                ? 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40'
                                                : 'bg-synced/5 border-synced/20 hover:border-synced/40'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${alert.severity === 'CRITICAL' ? 'bg-red-500 text-white' :
                                                alert.severity === 'WARNING' ? 'bg-yellow-500 text-black' :
                                                    'bg-synced/20 text-synced'
                                                }`}>
                                                {alert.type === 'LEARNING_RESET_RISK' ? '🟡 RESET' :
                                                    alert.type === 'SCALING_OPPORTUNITY' ? '🟢 SCALE' :
                                                        alert.type === 'ROTATE_CONCEPT' ? '🔥 ROTAR' :
                                                            alert.type === 'CONSOLIDATE' ? '🧩 CONSOLIDAR' :
                                                                alert.type === 'KILL_RETRY' ? '💀 KILL' : '💡 UPSELL'}
                                            </span>
                                            <span className="text-[9px] font-black text-text-muted">{alert.impactScore}</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-text-primary leading-snug line-clamp-2">{alert.title}</p>
                                        <p className="text-[9px] text-text-primary mt-1 line-clamp-2 opacity-90">{alert.description}</p>
                                    </div>
                                ))}
                            </div>

                            {alerts.length > 6 && (
                                <Link
                                    href="/decision-board"
                                    className="block text-[9px] font-bold text-classic hover:text-text-primary text-center pt-2 transition-colors cursor-pointer"
                                >
                                    ...y {alerts.length - 6} alertas más
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Main Table View */}
                <div className="relative group/table h-[calc(100vh-320px)]">
                    <div className="absolute -inset-1 bg-gradient-to-r from-classic/20 to-special/20 rounded-[2rem] blur-2xl opacity-20 group-hover/table:opacity-40 transition-opacity duration-1000" />

                    <div className="relative h-full bg-second/40 backdrop-blur-xl border border-argent/30 rounded-[1.5rem] overflow-hidden shadow-2xl flex flex-col">
                        <div className="overflow-auto scrollbar-thin scrollbar-thumb-argent/50 h-full">
                            <table className="w-full text-left border-collapse min-w-[1400px]">
                                <thead className="sticky top-0 z-50">
                                    <tr className="bg-special/80 border-b border-argent/50">
                                        <th onClick={() => handleSort('name')} className="p-6 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] sticky left-0 bg-special/95 z-40 shadow-[4px_0_15px_rgba(0,0,0,0.2)] border-r border-argent/20 cursor-pointer hover:text-text-primary transition-colors min-w-[280px]" title="Nombre y tipo de la entidad.">
                                            <div className="flex items-center gap-2">Entidad <SortIcon active={sortConfig.key === 'name'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('spend_7d')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right cursor-pointer hover:text-text-primary transition-colors min-w-[120px]" title="Gasto total (7d).">
                                            <div className="flex items-center justify-end gap-2">Inversión <SortIcon active={sortConfig.key === 'spend_7d'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('impressions_7d')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right cursor-pointer hover:text-text-primary transition-colors min-w-[100px]" title="Impresiones totales (7d).">
                                            <div className="flex items-center justify-end gap-2">Imps <SortIcon active={sortConfig.key === 'impressions_7d'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('ctr_7d')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right cursor-pointer hover:text-text-primary transition-colors min-w-[90px]" title="CTR% (Clicks / Imps).">
                                            <div className="flex items-center justify-end gap-2">CTR <SortIcon active={sortConfig.key === 'ctr_7d'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('hook_rate_7d')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right cursor-pointer hover:text-text-primary transition-colors min-w-[110px]" title="Hook Rate (V3s / Imps).">
                                            <div className="flex items-center justify-end gap-2">Hook Rate <SortIcon active={sortConfig.key === 'hook_rate_7d'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('funnel')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-center cursor-pointer hover:text-text-primary transition-colors min-w-[80px]" title="Etapa del Funnel (TOFU/MOFU/BOFU).">
                                            <div className="flex items-center justify-center gap-2">Funnel <SortIcon active={sortConfig.key === 'funnel'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('fitr_7d')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.1em] text-right cursor-pointer hover:text-text-primary transition-colors min-w-[110px]" title="Intención de compra (FitR) y Retención (R%).">
                                            <div className="flex items-center justify-end gap-2">Intención <SortIcon active={sortConfig.key === 'fitr_7d'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('cpa_7d')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right cursor-pointer hover:text-text-primary transition-colors min-w-[110px]" title="Costo por Adquisición (7d).">
                                            <div className="flex items-center justify-end gap-2">
                                                {businessType === 'ecommerce' ? 'CPA' : businessType === 'leads' ? 'CPL' : businessType === 'apps' ? 'CPI' : 'CPC/WA'}
                                                <SortIcon active={sortConfig.key === 'cpa_7d'} direction={sortConfig.direction} />
                                            </div>
                                        </th>
                                        {businessType === 'ecommerce' && (
                                            <th onClick={() => handleSort('roas_7d')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right cursor-pointer hover:text-text-primary transition-colors min-w-[100px]" title="ROAS (7d).">
                                                <div className="flex items-center justify-end gap-2">ROAS <SortIcon active={sortConfig.key === 'roas_7d'} direction={sortConfig.direction} /></div>
                                            </th>
                                        )}
                                        <th onClick={() => handleSort('learningState')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-center cursor-pointer hover:text-text-primary transition-colors min-w-[110px]" title="Fase de aprendizaje de Meta.">
                                            <div className="flex items-center justify-center gap-2">Fase <SortIcon active={sortConfig.key === 'learningState'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('fatigueState')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-center cursor-pointer hover:text-text-primary transition-colors min-w-[100px]" title="Nivel de fatiga creativa.">
                                            <div className="flex items-center justify-center gap-2">Fatiga <SortIcon active={sortConfig.key === 'fatigueState'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('finalDecision')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] cursor-pointer hover:text-text-primary transition-colors min-w-[140px]" title="Recomendación oficial del motor.">
                                            <div className="flex items-center gap-2">Decisión GEM <SortIcon active={sortConfig.key === 'finalDecision'} direction={sortConfig.direction} /></div>
                                        </th>
                                        <th onClick={() => handleSort('impactScore')} className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-center cursor-pointer hover:text-text-primary transition-colors min-w-[100px]" title="Puntuación de impacto (0-100).">
                                            <div className="flex items-center justify-center gap-2">Impacto <SortIcon active={sortConfig.key === 'impactScore'} direction={sortConfig.direction} /></div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRolling.length === 0 ? (
                                        <tr>
                                            <td colSpan={businessType === 'ecommerce' ? 13 : 12} className="p-20 text-center">
                                                <div className="space-y-4">
                                                    <div className="text-4xl">📡</div>
                                                    <p className="text-small font-black uppercase tracking-widest text-text-muted italic">
                                                        No se detectaron entidades activas para este nivel.
                                                    </p>
                                                    <p className="text-tiny text-text-muted max-w-xs mx-auto">
                                                        Asegúrate de haber corrido la sincronización y agregación de datos para este cliente hoy.
                                                    </p>
                                                    <button
                                                        onClick={() => refreshPerformance()}
                                                        className="px-4 py-2 border border-argent/50 rounded-lg text-tiny font-bold hover:bg-special transition-colors"
                                                    >
                                                        REINTENTAR SYNC BBDD
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRolling.map((m) => {
                                            const cl = classifications.find(c => c.entityId === m.entityId && c.level === m.level);
                                            const entityAlertCount = alerts.filter(a => a.entityId === m.entityId).length;
                                            return (
                                                <tr
                                                    key={m.entityId}
                                                    onClick={() => handleRowClick(m.entityId)}
                                                    className="group/row border-b border-argent/10 hover:bg-classic/[0.05] cursor-pointer transition-all duration-200"
                                                >
                                                    <td className="p-6 sticky left-0 bg-second/90 group-hover/row:bg-second z-20 transition-colors shadow-[4px_0_15px_rgba(0,0,0,0.2)] border-r border-argent/20 min-w-[220px]">
                                                        <div className="flex flex-col min-w-[220px]">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-small font-black text-text-primary truncate transition-all group-hover/row:text-classic" title={m.name || m.entityId}>
                                                                    {m.name || m.entityId}
                                                                </span>
                                                                {entityAlertCount > 0 && (
                                                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[8px] font-black bg-argent/30 text-text-secondary px-1.5 py-0.5 rounded leading-none uppercase">{level}</span>
                                                                <span className="text-[8px] font-medium text-text-muted select-all hover:text-text-secondary transition-colors cursor-help" title="Click para copiar ID">{m.entityId}</span>
                                                                {cl?.conceptId && <span className="text-[8px] font-black text-classic uppercase truncate max-w-[100px]">{cl.conceptId}</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right tabular-nums min-w-[100px]">
                                                        <span className="text-small font-bold text-text-primary">${m.rolling.spend_7d?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}</span>
                                                    </td>
                                                    <td className="p-4 text-right tabular-nums text-text-secondary text-[11px] font-medium min-w-[100px]">
                                                        {m.rolling.impressions_7d?.toLocaleString() || "-"}
                                                    </td>
                                                    <td className="p-4 text-right tabular-nums text-small font-bold text-text-secondary min-w-[80px]">
                                                        {m.rolling.ctr_7d ? `${m.rolling.ctr_7d.toFixed(2)}%` : "-"}
                                                    </td>
                                                    <td className="p-4 text-right tabular-nums min-w-[100px]">
                                                        <div className="flex flex-col items-end leading-none">
                                                            <span className="text-small font-black text-text-primary">{m.rolling.hook_rate_7d ? `${m.rolling.hook_rate_7d.toFixed(1)}%` : "-"}</span>
                                                            <DeltaTag val={m.rolling.hook_rate_delta_pct} />
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center min-w-[80px]">
                                                        <IntentBadge stage={cl?.intentStage} />
                                                    </td>
                                                    <td className="p-2 text-right tabular-nums w-[110px] min-w-[110px]">
                                                        <div className="flex flex-col items-end leading-none gap-1">
                                                            <span className="text-small font-bold text-text-primary">{m.rolling.fitr_7d ? `${m.rolling.fitr_7d.toFixed(2)}%` : "-"}</span>
                                                            {m.rolling.retention_rate_7d !== undefined && m.rolling.retention_rate_7d > 0 && (
                                                                <span className="text-[8px] font-black text-classic bg-classic/10 px-1 rounded border border-classic/20 leading-none py-0.5" title="Retention (V50/VPlay)">R{m.rolling.retention_rate_7d.toFixed(0)}%</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right tabular-nums min-w-[100px]">
                                                        <span className="text-small font-black text-text-primary">
                                                            {m.rolling.cpa_7d ? `$${m.rolling.cpa_7d.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "-"}
                                                        </span>
                                                    </td>
                                                    {businessType === 'ecommerce' && (
                                                        <td className="p-4 text-right tabular-nums min-w-[100px]">
                                                            <span className={`text-small font-black ${(m.rolling.roas_7d || 0) > 2 ? 'text-synced' : 'text-text-primary'}`}>
                                                                {m.rolling.roas_7d ? `${m.rolling.roas_7d.toFixed(2)}x` : "-"}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-center min-w-[100px]">
                                                        <PhaseTag state={cl?.learningState} />
                                                    </td>
                                                    <td className="p-4 text-center min-w-[100px]">
                                                        <FatigueTag state={cl?.fatigueState} />
                                                    </td>
                                                    <td className="p-4 min-w-[120px]">
                                                        <div className="flex items-center gap-2">
                                                            <DecisionTag decision={cl?.finalDecision} confidence={cl?.confidenceScore} />
                                                            <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200">
                                                                {alerts.filter(a => a.entityId === m.entityId).slice(0, 2).map(a => (
                                                                    <span key={a.id} className={`w-1.5 h-1.5 rounded-full ${a.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-yellow-500'}`} title={a.title} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 min-w-[100px]">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-small font-black text-white drop-shadow-[0_0_10px_rgba(var(--special-rgb),0.5)]">{cl?.impactScore || 0}</span>
                                                            <div className="w-8 h-1 bg-argent/20 rounded-full mt-1 overflow-hidden">
                                                                <div className="h-full bg-synced shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${cl?.impactScore || 0}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Drawer */}
            {
                isDrawerOpen && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        <div className="absolute inset-0 bg-stellar/80 backdrop-blur-md transition-opacity duration-300" onClick={() => setIsDrawerOpen(false)} />
                        <div className="relative w-full max-w-2xl bg-second h-full shadow-[-30px_0_80px_rgba(0,0,0,0.5)] border-l border-argent/30 animate-in slide-in-from-right duration-500 ease-out flex flex-col">
                            <header className="p-10 border-b border-argent/20 bg-special/40 flex justify-between items-start">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 bg-classic text-special text-[9px] font-black uppercase tracking-[0.2em]">{level}</span>
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Diagnóstico Operativo</span>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-black text-text-primary uppercase tracking-tighter leading-tight">{selectedMetrics?.name || selectedEntityId}</h2>
                                        <p className="text-[9px] font-mono text-text-muted mt-1 select-all">{selectedEntityId}</p>
                                        {selectedClass?.conceptId && (
                                            <p className="text-[12px] font-black text-classic uppercase mt-2 border-l-2 border-classic/30 pl-3">Concepto: {selectedClass.conceptId}</p>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => setIsDrawerOpen(false)} className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-argent/20 rounded-full transition-all text-3xl font-light">×</button>
                            </header>

                            <div className="flex-1 overflow-y-auto p-10 space-y-12 pb-24 scrollbar-thin scrollbar-thumb-argent/50">
                                {/* Performance Grid */}
                                <section className="grid grid-cols-2 gap-6">
                                    <MetricDetailBox
                                        label="Eficiencia de Adquisición"
                                        sub="CPA Promedio"
                                        curr={selectedMetrics?.rolling.cpa_7d}
                                        prev={selectedMetrics?.rolling.cpa_14d}
                                        prefix="$"
                                        reverse
                                    />
                                    <MetricDetailBox
                                        label="Ritmo de Escalabilidad"
                                        sub="Inversión Rolling"
                                        curr={selectedMetrics?.rolling.spend_7d}
                                        prev={selectedMetrics?.rolling.spend_14d}
                                        prefix="$"
                                    />
                                </section>

                                {/* NEW: Signal Indicators Section */}
                                <section className="space-y-4">
                                    <header className="flex items-center gap-3 border-b border-argent/20 pb-4">
                                        <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Señales Operativas</h3>
                                    </header>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <SignalCard
                                            label="Velocidad Conv"
                                            value={selectedMetrics?.rolling.conversion_velocity_7d?.toFixed(2)}
                                            suffix="/día"
                                            prev={selectedMetrics?.rolling.conversion_velocity_14d}
                                        />
                                        <SignalCard
                                            label="Frecuencia 7d"
                                            value={selectedMetrics?.rolling.frequency_7d?.toFixed(1)}
                                            warn={(selectedMetrics?.rolling.frequency_7d || 0) > 4}
                                        />
                                        <SignalCard
                                            label="Δ Budget 3d"
                                            value={selectedMetrics?.rolling.budget_change_3d_pct != null ? `${selectedMetrics.rolling.budget_change_3d_pct.toFixed(0)}%` : undefined}
                                            warn={Math.abs(selectedMetrics?.rolling.budget_change_3d_pct || 0) > 30}
                                        />
                                        <SignalCard
                                            label="Concentración"
                                            value={selectedMetrics?.rolling.spend_top1_ad_pct != null ? `${(selectedMetrics.rolling.spend_top1_ad_pct * 100).toFixed(0)}%` : undefined}
                                            warn={(selectedMetrics?.rolling.spend_top1_ad_pct || 0) > 0.6}
                                        />
                                    </div>
                                </section>

                                {/* Entity Alerts */}
                                {entityAlerts.length > 0 && (
                                    <section className="space-y-4">
                                        <header className="flex items-center justify-between border-b border-argent/20 pb-4">
                                            <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Alertas de esta Entidad</h3>
                                            <span className="text-[9px] font-black text-text-muted">{entityAlerts.length} alerta{entityAlerts.length !== 1 ? 's' : ''}</span>
                                        </header>
                                        <div className="space-y-3">
                                            {entityAlerts.map((alert) => (
                                                <div key={alert.id} className={`p-4 rounded-2xl border ${alert.severity === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' :
                                                    alert.severity === 'WARNING' ? 'bg-yellow-500/5 border-yellow-500/20' :
                                                        'bg-synced/5 border-synced/20'
                                                    }`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${alert.severity === 'CRITICAL' ? 'bg-red-500 text-white' :
                                                            alert.severity === 'WARNING' ? 'bg-yellow-500 text-black' :
                                                                'bg-synced/20 text-synced'
                                                            }`}>{alert.severity}</span>
                                                        <span className="text-[9px] font-bold text-text-primary">{alert.title}</span>
                                                    </div>
                                                    <p className="text-[10px] text-text-muted leading-relaxed">{alert.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Intent & Evidence Section */}
                                <section className="space-y-6">
                                    <header className="flex justify-between items-end border-b border-argent/20 pb-4">
                                        <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Racional de Inteligencia</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-text-secondary">Confianza:</span>
                                            <span className="text-[10px] font-black text-synced bg-synced/10 px-2 py-0.5 rounded-lg border border-synced/20">{Math.round((selectedClass?.confidenceScore || 0) * 100)}%</span>
                                        </div>
                                    </header>

                                    <div className="space-y-4">
                                        {selectedClass?.evidence?.map((fact, i) => (
                                            <div key={i} className="flex gap-4 p-5 bg-special/20 border border-argent/20 rounded-2xl hover:border-classic/30 transition-all duration-300">
                                                <div className="mt-1 w-5 h-5 bg-classic/10 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <div className="w-1.5 h-1.5 bg-classic rounded-full shadow-[0_0_8px_rgba(var(--classic-rgb),1)]" />
                                                </div>
                                                <p className="text-small font-bold text-text-primary leading-relaxed">{fact}</p>
                                            </div>
                                        ))}
                                        {!selectedClass?.evidence?.length && (
                                            <div className="p-10 text-center border-2 border-dashed border-argent/20 rounded-3xl">
                                                <p className="text-small text-text-muted font-bold italic">Esperando procesamiento de señales de bajo nivel...</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Action Section */}
                                <section className="pt-6 relative">
                                    <div className="absolute -inset-4 bg-gradient-to-r from-special/40 to-classic/20 blur-3xl opacity-30 -z-10" />
                                    <button
                                        onClick={generateRecommendation}
                                        disabled={isGenerating}
                                        className="w-full bg-second text-text-primary hover:bg-classic hover:text-special font-black py-6 uppercase tracking-[0.3em] transition-all duration-500 ease-in-out flex items-center justify-center gap-6 group hover:shadow-classic/40 disabled:opacity-50"
                                    >
                                        {isGenerating ? (
                                            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin group-hover:border-white group-hover:border-t-transparent" />
                                        ) : <span className="text-2xl group-hover:scale-125 group-hover:rotate-12 transition-transform duration-500">✨</span>}
                                        <span className="text-[12px]">{isGenerating ? "Gemini está optimizando..." : "Generar AI Operational Playbook"}</span>
                                    </button>

                                    {recommendation && (
                                        <div className="mt-10 bg-special border border-argent/30 rounded-[2rem] p-8 space-y-8 animate-in zoom-in-95 duration-700 shadow-2xl">
                                            <div className="flex items-center gap-4 border-b border-argent/20 pb-6">
                                                <div className="w-12 h-12 bg-classic/10 border border-classic/20 rounded-2xl flex items-center justify-center text-2xl shadow-inner italic text-classic">P</div>
                                                <div>
                                                    <h4 className="text-subheader font-black text-text-primary uppercase tracking-tight">Playbook Estratégico</h4>
                                                    <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mt-1">Generado por GEM High-Intelligence</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {recommendation.actions?.map((act, i) => (
                                                    <div key={i} className="flex gap-5 p-5 bg-white/[0.03] rounded-2xl border border-argent/10 group/item hover:border-classic/40 transition-all">
                                                        <span className="flex-shrink-0 w-8 h-8 bg-argent/20 border border-argent/20 flex items-center justify-center text-[10px] font-black text-text-secondary group-hover/item:bg-classic group-hover/item:text-special transition-colors">0{i + 1}</span>
                                                        <p className="text-small font-bold text-text-primary leading-relaxed pt-1">{act}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    </div>
                )}
        </AppLayout>
    );
}

// ─── Subcomponents ───────────────────────────────────────────

function SortIcon({ active, direction }: { active: boolean, direction: 'asc' | 'desc' }) {
    return (
        <div className={`flex flex-col -space-y-1 transition-opacity ${active ? 'opacity-100' : 'opacity-20'}`}>
            <span className={`text-[8px] ${active && direction === 'asc' ? 'text-classic' : ''}`}>▲</span>
            <span className={`text-[8px] ${active && direction === 'desc' ? 'text-classic' : ''}`}>▼</span>
        </div>
    );
}

function DeltaTag({ val }: { val?: number }) {
    if (val === undefined || Math.abs(val) < 0.1) return null;
    const isImproved = val > 0;
    return (
        <span className={`text-[9px] font-black ${isImproved ? 'text-synced' : 'text-red-500'} flex items-center gap-0.5`}>
            {isImproved ? '↑' : '↓'} {Math.abs(val).toFixed(0)}%
        </span>
    );
}

function IntentBadge({ stage }: { stage?: IntentStage }) {
    if (!stage) return null;
    const stages = { TOFU: 'TOP', MOFU: 'MID', BOFU: 'BTTM' };
    const styles = {
        TOFU: 'bg-argent/30 text-text-secondary border-argent/40',
        MOFU: 'bg-classic/20 text-classic border-classic/40',
        BOFU: 'bg-synced/20 text-synced border-synced/40'
    };
    return (
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${styles[stage]}`}>
            {stages[stage]}
        </span>
    );
}

function PhaseTag({ state }: { state?: LearningState }) {
    if (!state) return <span className="text-text-muted font-bold text-[10px]">---</span>;
    const config = {
        EXPLORATION: { label: 'EXPLORACIÓN', color: 'text-blue-400' },
        STABILIZING: { label: 'ESTABILIZANDO', color: 'text-purple-400' },
        EXPLOITATION: { label: 'OPTIMIZACIÓN', color: 'text-synced' },
        UNSTABLE: { label: 'INESTABLE', color: 'text-orange-500' }
    };
    return <span className={`text-[9px] font-black uppercase tracking-tighter ${config[state].color}`}>{config[state].label}</span>;
}

function FatigueTag({ state }: { state?: FatigueState }) {
    if (!state || state === 'NONE') return <span className="text-text-muted font-bold text-[10px]">OK</span>;
    const config = {
        REAL: { label: 'FATIGA', color: 'bg-red-500 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]' },
        CONCEPT_DECAY: { label: 'DECAIMIENTO', color: 'bg-orange-500 text-white' },
        AUDIENCE_SATURATION: { label: 'SATURACIÓN', color: 'bg-yellow-500 text-black shadow-[0_4px_12px_rgba(234,179,8,0.3)]' },
        HEALTHY_REPETITION: { label: 'REPETICIÓN', color: 'bg-synced/20 text-synced border border-synced/30' },
        NONE: { label: '', color: '' }
    };
    return <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${config[state].color}`}>{config[state].label}</span>;
}

function DecisionTag({ decision, confidence }: { decision?: FinalDecision, confidence?: number }) {
    if (!decision) return <span className="text-[10px] font-black text-text-muted uppercase">HOLD</span>;
    const labels = {
        SCALE: "ESCALAR",
        ROTATE_CONCEPT: "ROTAR",
        CONSOLIDATE: "CONSOLIDAR",
        INTRODUCE_BOFU_VARIANTS: "UPSELL",
        KILL_RETRY: "ELIMINAR",
        HOLD: "MANTENER"
    };
    const styles = {
        SCALE: "bg-synced shadow-synced/30 text-stellar",
        ROTATE_CONCEPT: "bg-red-500 shadow-red-500/30 text-white",
        CONSOLIDATE: "bg-yellow-500 shadow-yellow-500/30 text-black",
        INTRODUCE_BOFU_VARIANTS: "bg-classic shadow-classic/30 text-special",
        KILL_RETRY: "bg-red-900 shadow-red-900/40 text-white",
        HOLD: "bg-argent/20 text-text-muted"
    };
    return (
        <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-tighter shadow-lg ${styles[decision]}`}>
                {labels[decision]}
            </span>
            {confidence !== undefined && (
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-text-muted leading-none">AI CONF</span>
                    <span className="text-[10px] font-black text-text-primary">{Math.round(confidence * 100)}%</span>
                </div>
            )}
        </div>
    );
}

function SignalCard({ label, value, suffix, prev, warn }: { label: string, value?: string, suffix?: string, prev?: number, warn?: boolean }) {
    return (
        <div className={`p-3 rounded-xl border transition-all ${warn ? 'bg-red-500/5 border-red-500/20' : 'bg-special/20 border-argent/20'}`}>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">{label}</p>
            <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-[14px] font-black ${warn ? 'text-red-400' : 'text-text-primary'}`}>
                    {value || "-"}
                </span>
                {suffix && <span className="text-[9px] text-text-muted">{suffix}</span>}
            </div>
            {prev !== undefined && prev > 0 && value && (
                <p className="text-[8px] text-text-muted mt-0.5">prev: {prev.toFixed(2)}</p>
            )}
        </div>
    );
}

function MetricDetailBox({ label, sub, curr, prev, prefix = "", reverse = false }: any) {
    const delta = prev && prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    const isImproved = reverse ? delta < -2 : delta > 2;

    return (
        <div className="bg-special/40 border border-argent/20 p-6 rounded-[1.5rem] shadow-sm hover:shadow-xl transition-all duration-300 group/metric">
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</p>
                    <p className="text-[9px] font-bold text-classic uppercase">{sub}</p>
                </div>
                {Math.abs(delta) > 1 && (
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-sm ${isImproved ? 'bg-synced/10 text-synced' : 'bg-red-500/10 text-red-500'}`}>
                        {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}%
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-black text-text-primary tracking-tighter transition-all group-hover/metric:text-white">{prefix}{curr?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || "0"}</span>
                <span className="text-[11px] font-bold text-text-muted mb-1 italic">/ rolling</span>
            </div>
            <div className="mt-4 pt-4 border-t border-argent/10 flex justify-between">
                <div className="space-y-1">
                    <p className="text-[8px] font-black text-text-muted uppercase">Previo (14d)</p>
                    <p className="text-[11px] font-black text-text-secondary">{prefix}{prev?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || "-"}</p>
                </div>
                <div className="text-right space-y-2">
                    <p className="text-[8px] font-black text-text-muted uppercase">Trend</p>
                    <div className={`w-12 h-1 bg-argent/20 rounded-full overflow-hidden`}>
                        <div className={`h-full ${isImproved ? 'bg-synced' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.abs(delta) + 20, 100)}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
