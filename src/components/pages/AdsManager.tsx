"use client";
import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { EntityRollingMetrics, EntityLevel } from "@/types/performance-snapshots";
import { EntityClassification, FinalDecision, IntentStage, LearningState, FatigueState } from "@/types/classifications";
import { RecommendationDoc } from "@/types/ai-recommendations";

export default function AdsManager() {
    const { selectedClientId: clientId } = useClient();
    const [level, setLevel] = useState<EntityLevel>("ad");
    const [rollingMetrics, setRollingMetrics] = useState<EntityRollingMetrics[]>([]);
    const [classifications, setClassifications] = useState<EntityClassification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [recommendation, setRecommendation] = useState<RecommendationDoc | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/performance?clientId=${clientId}`);
            const data = await res.json();
            setRollingMetrics(data.rolling || []);
            setClassifications(data.classifications || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId]);

    const filteredRolling = useMemo(() => {
        return rollingMetrics.filter(m => m.level === level);
    }, [rollingMetrics, level]);

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
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.25em] pl-5">Nivel de Control Operativo GEM v2.0</p>
                    </div>

                    <div className="flex bg-second/80 backdrop-blur-md border border-argent/40 p-1 rounded-2xl shadow-xl">
                        {(['account', 'campaign', 'adset', 'ad'] as EntityLevel[]).map((l) => (
                            <button
                                key={l}
                                onClick={() => setLevel(l)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${level === l ? 'bg-classic text-white shadow-[0_8px_20px_-5px_rgba(var(--classic-rgb),0.4)] scale-[1.05]' : 'text-text-muted hover:text-text-primary hover:bg-argent/10'}`}
                            >
                                {l === 'ad' ? 'Anuncios' : l === 'adset' ? 'Conjuntos' : l === 'campaign' ? 'Campañas' : 'Cuenta'}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Main Table View - NOW DARK TO MATCH THEME */}
                <div className="relative group/table">
                    <div className="absolute -inset-1 bg-gradient-to-r from-classic/20 to-special/20 rounded-[2rem] blur-2xl opacity-20 group-hover/table:opacity-40 transition-opacity duration-1000" />

                    <div className="relative bg-second/40 backdrop-blur-xl border border-argent/30 rounded-[1.5rem] overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-argent/50">
                            <table className="w-full text-left border-collapse min-w-[1200px]">
                                <thead>
                                    <tr className="bg-special/80 border-b border-argent/50">
                                        <th className="p-6 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] sticky left-0 bg-special/95 z-30 shadow-[4px_0_15px_rgba(0,0,0,0.2)] border-r border-argent/20">Entidad</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right">Inversión (7d)</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right">Imps</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right">CTR</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right">Hook Rate</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right whitespace-nowrap">Intention (FitR)</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right">CPA (7d)</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-right">ROAS (7d)</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-center">Fase</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-center">Fatiga</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em]">Decisión GEM</th>
                                        <th className="p-4 font-black text-[10px] text-text-muted uppercase tracking-[0.2em] text-center">Impacto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRolling.map((m) => {
                                        const cl = classifications.find(c => c.entityId === m.entityId && c.level === m.level);
                                        return (
                                            <tr
                                                key={m.entityId}
                                                onClick={() => handleRowClick(m.entityId)}
                                                className="group/row border-b border-argent/10 hover:bg-classic/[0.05] cursor-pointer transition-all duration-200"
                                            >
                                                <td className="p-6 sticky left-0 bg-second/90 group-hover/row:bg-second z-20 transition-colors shadow-[4px_0_15px_rgba(0,0,0,0.2)] border-r border-argent/20">
                                                    <div className="flex flex-col min-w-[180px]">
                                                        <span className="text-small font-black text-text-primary truncate transition-all group-hover/row:text-classic">{m.entityId}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[8px] font-black bg-argent/30 text-text-secondary px-1.5 py-0.5 rounded leading-none uppercase">{level}</span>
                                                            {cl?.conceptId && <span className="text-[8px] font-black text-classic uppercase truncate max-w-[100px]">{cl.conceptId}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right tabular-nums">
                                                    <span className="text-small font-bold text-text-primary">${m.rolling.spend_7d?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}</span>
                                                </td>
                                                <td className="p-4 text-right tabular-nums text-text-secondary text-[11px] font-medium">
                                                    {m.rolling.impressions_7d?.toLocaleString() || "-"}
                                                </td>
                                                <td className="p-4 text-right tabular-nums text-small font-bold text-text-secondary">
                                                    {m.rolling.ctr_7d ? `${m.rolling.ctr_7d.toFixed(2)}%` : "-"}
                                                </td>
                                                <td className="p-4 text-right tabular-nums">
                                                    <div className="flex flex-col items-end leading-none">
                                                        <span className="text-small font-black text-text-primary">{m.rolling.hook_rate_7d ? `${m.rolling.hook_rate_7d.toFixed(1)}%` : "-"}</span>
                                                        <DeltaTag val={m.rolling.hook_rate_delta_pct} />
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right tabular-nums">
                                                    <div className="flex flex-col items-end leading-none gap-1">
                                                        <span className="text-small font-bold text-text-primary">{m.rolling.fitr_7d ? `${m.rolling.fitr_7d.toFixed(2)}%` : "-"}</span>
                                                        <IntentBadge stage={cl?.intentStage} />
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right tabular-nums">
                                                    <span className="text-small font-black text-text-primary">${m.rolling.cpa_7d?.toFixed(2) || "0.00"}</span>
                                                </td>
                                                <td className="p-4 text-right tabular-nums">
                                                    <span className={`text-small font-black ${(m.rolling.roas_7d || 0) > 2 ? 'text-synced' : 'text-text-primary'}`}>
                                                        {m.rolling.roas_7d ? `${m.rolling.roas_7d.toFixed(2)}x` : "-"}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <PhaseTag state={cl?.learningState} />
                                                </td>
                                                <td className="p-4 text-center">
                                                    <FatigueTag state={cl?.fatigueState} />
                                                </td>
                                                <td className="p-4">
                                                    <DecisionTag decision={cl?.finalDecision} confidence={cl?.confidenceScore} />
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-small font-black text-white drop-shadow-[0_0_10px_rgba(var(--special-rgb),0.5)]">{cl?.impactScore || 0}</span>
                                                        <div className="w-8 h-1 bg-argent/20 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-synced shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${cl?.impactScore || 0}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Drawer - ALSO DARK */}
            {isDrawerOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-stellar/80 backdrop-blur-md transition-opacity duration-300" onClick={() => setIsDrawerOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-second h-full shadow-[-30px_0_80px_rgba(0,0,0,0.5)] border-l border-argent/30 animate-in slide-in-from-right duration-500 ease-out flex flex-col">
                        <header className="p-10 border-b border-argent/20 bg-special/40 flex justify-between items-start">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 bg-classic text-white text-[9px] font-black rounded-full uppercase tracking-[0.2em] shadow-lg">{level}</span>
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Diagnóstico Operativo</span>
                                </div>
                                <div>
                                    <h2 className="text-4xl font-black text-text-primary uppercase tracking-tighter leading-tight break-all">{selectedEntityId}</h2>
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
                                    className="w-full bg-white text-black hover:bg-classic hover:text-white font-black py-6 rounded-3xl uppercase tracking-[0.3em] transition-all duration-500 ease-in-out flex items-center justify-center gap-6 group shadow-2xl hover:shadow-classic/40 disabled:opacity-50"
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
                                            {recommendation.actions.map((act, i) => (
                                                <div key={i} className="flex gap-5 p-5 bg-white/[0.03] rounded-2xl border border-argent/10 group/item hover:border-classic/40 transition-all">
                                                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-argent/20 border border-argent/20 shadow-sm flex items-center justify-center text-[10px] font-black text-text-secondary group-hover/item:bg-classic group-hover/item:text-white transition-colors">0{i + 1}</span>
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

// Subcomponents with Visual Polish
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
        SCALE: "bg-synced shadow-synced/30 text-white",
        ROTATE_CONCEPT: "bg-red-500 shadow-red-500/30 text-white",
        CONSOLIDATE: "bg-yellow-500 shadow-yellow-500/30 text-black",
        INTRODUCE_BOFU_VARIANTS: "bg-classic shadow-classic/30 text-white",
        KILL_RETRY: "bg-red-900 shadow-red-900/40 text-white",
        HOLD: "bg-argent/20 text-text-muted"
    };
    return (
        <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-tighter shadow-lg transition-transform hover:scale-[1.05] ${styles[decision]}`}>
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
