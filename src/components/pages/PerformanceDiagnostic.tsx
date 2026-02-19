"use client";
import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { EntityRollingMetrics, ConceptRollingMetrics } from "@/types/performance-snapshots";
import { EntityClassification, FinalDecision } from "@/types/classifications";
import { Alert } from "@/types";

import { RecommendationDoc } from "@/types/ai-recommendations";

export default function PerformanceDiagnostic() {
    const { selectedClientId: clientId } = useClient();
    const [rollingMetrics, setRollingMetrics] = useState<EntityRollingMetrics[]>([]);
    const [conceptMetrics, setConceptMetrics] = useState<ConceptRollingMetrics[]>([]);
    const [classifications, setClassifications] = useState<EntityClassification[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<FinalDecision | "ALL">("ALL");

    // Recommendation Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<{ id: string, level: string, decision: FinalDecision } | null>(null);
    const [recommendation, setRecommendation] = useState<RecommendationDoc | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/performance?clientId=${clientId}`);
            const data = await res.json();
            setRollingMetrics(data.rolling || []);
            setConceptMetrics(data.concepts || []);
            setAlerts(data.alerts || []);
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

    const handleTakeAction = async (entityId: string, level: string, decision: FinalDecision) => {
        setSelectedEntity({ id: entityId, level, decision });
        setIsDrawerOpen(true);
        setRecommendation(null);

        // Try fetching existing
        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch(`/api/recommendations/detail?clientId=${clientId}&level=${level}&entityId=${entityId}&rangeStart=${today}&rangeEnd=${today}`);
            const data = await res.json();
            if (data.status === 'success') {
                setRecommendation(data.recommendation);
            }
        } catch (e) {
            console.error("Error fetching recommendation:", e);
        }
    };

    const generateRecommendation = async () => {
        if (!selectedEntity || !clientId) return;
        setIsGenerating(true);
        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch('/api/recommendations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    range: { start: today, end: today },
                    level: selectedEntity.level,
                    entityId: selectedEntity.id
                })
            });
            const data = await res.json();
            if (data.status === 'generated' || data.status === 'cached') {
                setRecommendation(data.recommendation);
            } else {
                alert(data.message || "Error generating recommendation");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredRolling = rollingMetrics.filter(m => {
        if (m.level !== "ad") return false;
        if (filter === "ALL") return true;
        const cl = classifications.find(c => c.entityId === m.entityId);
        return cl?.finalDecision === filter;
    });

    const lastUpdateDate = rollingMetrics[0]?.lastUpdate;
    const dateRangeLabel = React.useMemo(() => {
        if (!lastUpdateDate) return "";
        const end = new Date(lastUpdateDate + "T12:00:00Z");
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        const formatDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        return `${formatDate(start)} - ${formatDate(end)}`;
    }, [lastUpdateDate]);

    if (isLoading) return <AppLayout><div className="p-12 text-center text-text-muted">Cargando Diagnóstico Pro...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="flex flex-col gap-8 h-[calc(100vh-200px)]">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-stellar/50 p-6 rounded-xl border border-argent/50 gap-4 flex-shrink-0">
                    <div>
                        <h1 className="text-display font-black text-text-primary uppercase tracking-tighter">Matriz de Decisión GEM</h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Nivel: Motor de Optimización Probabilística • {dateRangeLabel && <span className="text-classic">{dateRangeLabel}</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-text-muted uppercase">Filtrar por Decisión:</span>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="bg-stellar border border-argent rounded-lg px-3 py-1.5 text-[11px] font-bold text-text-primary outline-none focus:border-classic"
                        >
                            <option value="ALL">TODAS LAS ENTIDADES</option>
                            <option value="SCALE">🚀 ESCALAR</option>
                            <option value="ROTATE_CONCEPT">🔥 ROTAR</option>
                            <option value="CONSOLIDATE">🧩 CONSOLIDAR</option>
                            <option value="KILL_RETRY">💀 ELIMINAR</option>
                            <option value="HOLD">🟡 MANTENER</option>
                        </select>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-argent/50 pr-2 -mr-2 space-y-8 pb-20">
                    {/* Main Grid: Decisions-First Column */}
                    <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredRolling.slice(0, 15).map(ad => {
                            const cl = classifications.find(c => c.entityId === ad.entityId && c.level === ad.level);
                            return (
                                <div key={ad.entityId} className="card group hover:border-classic transition-all relative overflow-hidden flex flex-col">
                                    {/* Impact Score Ribbon */}
                                    {cl && (
                                        <div className="absolute top-0 right-0 p-2">
                                            <div className="text-[9px] font-black text-text-muted uppercase bg-argent/10 px-2 py-0.5 rounded">
                                                Impacto: {cl.impactScore}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex flex-col gap-1">
                                            <DecisionBadge classification={cl} />
                                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Ad ID: {ad.entityId.slice(0, 8)}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 mb-6">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-text-muted uppercase">Estado de Aprendizaje</p>
                                            <StateBadge value={cl?.learningState || "DESCONOCIDO"} type="LEARNING" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-text-muted uppercase">Estado de Fatiga</p>
                                            <StateBadge value={cl?.fatigueState || "NONE"} type="FATIGUE" />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-argent/50 flex-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-text-muted uppercase">Etapa {cl?.intentStage || "TOFU"}</span>
                                                <span className="text-[18px] font-black text-text-primary leading-tight">${ad.rolling.spend_7d?.toFixed(0)} <span className="text-[11px] text-text-muted">Gasto 7d</span></span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black text-text-muted uppercase">Confianza</span>
                                                <p className="text-small font-black text-synced">{((cl?.confidenceScore || 0) * 100).toFixed(0)}%</p>
                                            </div>
                                        </div>

                                        {/* Intent Progress Bar */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] font-black text-text-muted uppercase">
                                                <span>Reconocimiento</span>
                                                <span>Conversión</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-silver/20 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${cl?.intentStage === 'BOFU' ? 'bg-special' : cl?.intentStage === 'MOFU' ? 'bg-classic' : 'bg-silver'}`}
                                                    style={{ width: `${(cl?.intentScore || 0) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {cl && cl.finalDecision !== "HOLD" && (
                                        <button
                                            onClick={() => handleTakeAction(ad.entityId, ad.level, cl.finalDecision)}
                                            className="mt-6 w-full bg-classic text-special text-[11px] font-black py-2.5 uppercase tracking-widest transition-all hover:brightness-110"
                                        >
                                            Tomar Acción
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </section>

                    {/* Drawer Overlay */}
                    {isDrawerOpen && (
                        <div className="fixed inset-0 z-50 flex justify-end">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
                            <div className="relative w-full max-w-xl bg-stellar h-full shadow-2xl border-l border-argent animate-in slide-in-from-right duration-300 overflow-y-auto">
                                <div className="p-8 space-y-8">
                                    <header className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">GEM Playbook</span>
                                            <h2 className="text-display font-black text-text-primary uppercase leading-tight">Acción Estratégica</h2>
                                            <div className="mt-2">
                                                <span className={`text-[12px] font-black px-3 py-1 bg-classic text-special`}>
                                                    {selectedEntity?.decision}
                                                </span>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsDrawerOpen(false)} className="text-text-muted hover:text-text-primary text-2xl font-bold">×</button>
                                    </header>

                                    {!recommendation ? (
                                        <div className="space-y-6 py-12 text-center">
                                            <div className="w-16 h-16 bg-silver/10 rounded-full flex items-center justify-center mx-auto">
                                                <span className="text-3xl">🤖</span>
                                            </div>
                                            <div>
                                                <h3 className="text-subheader font-black text-text-primary uppercase">No hay recomendación generada</h3>
                                                <p className="text-small text-text-muted mt-2">El motor de IA necesita analizar la evidencia para construir el playbook operativo.</p>
                                            </div>
                                            <button
                                                onClick={generateRecommendation}
                                                disabled={isGenerating}
                                                className="bg-special text-white font-black px-8 py-4 rounded-xl uppercase tracking-widest hover:scale-105 transition-all text-small disabled:opacity-50"
                                            >
                                                {isGenerating ? "Procesando con Gemini..." : "Generar Recomendación AI"}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-8 pb-12">
                                            {/* Evidence */}
                                            <section className="space-y-4">
                                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-widest border-b border-argent pb-2">Evidencia con Números</h4>
                                                <ul className="space-y-2">
                                                    {recommendation.evidence.map((ev, i) => (
                                                        <li key={i} className="flex gap-3 text-small text-text-primary font-medium">
                                                            <span className="text-synced">✓</span> {ev}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>

                                            {/* Actions */}
                                            <section className="space-y-4">
                                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-widest border-b border-argent pb-2">Playbook Operativo</h4>
                                                <div className="space-y-3">
                                                    {recommendation.actions.map((act, i) => (
                                                        <div key={i} className="bg-stellar border border-argent p-4 rounded-xl flex gap-3 items-start">
                                                            <input type="checkbox" className="mt-1" />
                                                            <span className="text-small text-text-primary leading-tight">{act}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>

                                            {/* Experiments */}
                                            {recommendation.experiments.length > 0 && (
                                                <section className="space-y-4">
                                                    <h4 className="text-[11px] font-black text-text-muted uppercase tracking-widest border-b border-argent pb-2">Próximos Experimentos</h4>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {recommendation.experiments.map((exp, i) => (
                                                            <div key={i} className="p-4 bg-special/5 border border-special/20 rounded-xl">
                                                                <p className="text-small font-bold text-text-primary italic">"{exp}"</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}

                                            {/* Creative Brief */}
                                            {recommendation.creativeBrief && (
                                                <section className="space-y-4">
                                                    <h4 className="text-[11px] font-black text-text-muted uppercase tracking-widest border-b border-argent pb-2">Creative Brief Rápido</h4>
                                                    <div className="bg-stellar border border-argent p-6 rounded-xl">
                                                        <p className="text-small text-text-secondary leading-relaxed whitespace-pre-wrap">{recommendation.creativeBrief}</p>
                                                    </div>
                                                </section>
                                            )}

                                            {/* Footer Stats */}
                                            <div className="pt-8 grid grid-cols-2 gap-4">
                                                <div className="text-center p-4 bg-argent/10 rounded-xl">
                                                    <p className="text-[10px] font-black text-text-muted uppercase">Confianza</p>
                                                    <p className="text-subheader font-black text-synced">{(recommendation.confidence * 100).toFixed(0)}%</p>
                                                </div>
                                                <div className="text-center p-4 bg-argent/10 rounded-xl">
                                                    <p className="text-[10px] font-black text-text-muted uppercase">Impacto Estimado</p>
                                                    <p className="text-subheader font-black text-special">{recommendation.impactScore}/100</p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={generateRecommendation}
                                                disabled={isGenerating}
                                                className="w-full border border-argent text-text-muted text-[10px] font-black py-2 rounded uppercase hover:text-text-primary transition-all"
                                            >
                                                {isGenerating ? "Generando..." : "Regenerar Recomendación"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Alerts / Smart Digest */}
                    <section className="bg-stellar/30 p-8 rounded-2xl border border-argent/50">
                        <h2 className="text-subheader font-black text-text-primary uppercase tracking-widest mb-6 flex items-center gap-3">
                            <span className="w-2 h-8 bg-special rounded-full"></span>
                            Alertas de Prioridad Estratégica
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {alerts.filter(a => a.severity !== "INFO").map(alert => (
                                <div key={alert.id} className={`p-5 rounded-xl border flex gap-4 transition-all hover:scale-[1.01] ${alert.severity === "CRITICAL" ? "bg-red-500/5 border-red-500/20 shadow-lg shadow-red-500/5" : "bg-stellar border-argent"}`}>
                                    <div className="text-2xl mt-1">{alert.severity === "CRITICAL" ? "🔥" : "🧩"}</div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${alert.severity === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>{alert.severity}</span>
                                            <p className="font-black text-text-primary uppercase text-small">{alert.title}</p>
                                        </div>
                                        <p className="text-small text-text-primary font-medium leading-relaxed opacity-90">{alert.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

function DecisionBadge({ classification }: { classification?: EntityClassification }) {
    const decision = classification?.finalDecision || "HOLD";

    const styles: Record<FinalDecision, string> = {
        SCALE: "bg-synced text-stellar",
        ROTATE_CONCEPT: "bg-red-500 text-white",
        CONSOLIDATE: "bg-yellow-500 text-white",
        INTRODUCE_BOFU_VARIANTS: "bg-classic text-special",
        KILL_RETRY: "bg-red-800 text-white",
        HOLD: "bg-argent text-text-secondary"
    };

    const labels: Record<FinalDecision, string> = {
        SCALE: "🚀 ESCALAR",
        ROTATE_CONCEPT: "🔥 ROTAR",
        CONSOLIDATE: "🧩 CONSOLIDAR",
        INTRODUCE_BOFU_VARIANTS: "💡 UPSELL",
        KILL_RETRY: "💀 ELIMINAR",
        HOLD: "🟡 MANTENER"
    };

    return (
        <span className={`${styles[decision]} text-[11px] font-black px-3 py-1 rounded shadow-md uppercase tracking-tight`}>
            {labels[decision]}
        </span>
    );
}

function StateBadge({ value, type }: { value: string, type: 'LEARNING' | 'FATIGUE' }) {
    const learningColors: Record<string, string> = {
        EXPLORATION: "text-blue-500",
        STABILIZING: "text-purple-500",
        EXPLOITATION: "text-synced",
        UNSTABLE: "text-yellow-600 bg-yellow-500/10 px-1.5 rounded",
        EXPLORACIÓN: "text-blue-500",
        ESTABILIZANDO: "text-purple-500",
        EXPLOTACIÓN: "text-synced",
        INESTABLE: "text-yellow-600 bg-yellow-500/10 px-1.5 rounded"
    };

    const fatigueColors: Record<string, string> = {
        REAL: "text-red-500 font-bold",
        CONCEPT_DECAY: "text-red-600 font-black",
        DECAIMIENTO_DE_CONCEPTO: "text-red-600 font-black",
        HEALTHY_REPETITION: "text-synced/70",
        REPETICIÓN_SALUDABLE: "text-synced/70",
        NONE: "text-text-muted",
        NINGUNA: "text-text-muted"
    };

    const labelMap: Record<string, string> = {
        EXPLORATION: "EXPLORACIÓN",
        STABILIZING: "ESTABILIZANDO",
        EXPLOITATION: "EXPLOTACIÓN",
        UNSTABLE: "INESTABLE",
        REAL: "REAL",
        CONCEPT_DECAY: "DECAIMIENTO DE CONCEPTO",
        HEALTHY_REPETITION: "REPETICIÓN SALUDABLE",
        NONE: "NINGUNA",
        DESCONOCIDO: "DESCONOCIDO" // Added for the "UNKNOWN" case
    };

    const color = type === 'LEARNING' ? learningColors[value] : fatigueColors[value];
    const label = labelMap[value] || value;

    return (
        <span className={`text-small font-bold uppercase tracking-tight ${color || 'text-text-muted'}`}>
            {label.replace('_', ' ')}
        </span>
    );
}
