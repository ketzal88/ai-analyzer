"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { useParams, useRouter } from "next/navigation";
import { ConceptBriefDoc } from "@/types/concept-ai-brief";

export default function ConceptDetail() {
    const { conceptId } = useParams();
    const { selectedClientId: clientId } = useClient();
    const router = useRouter();

    const [detail, setDetail] = useState<any>(null);
    const [brief, setBrief] = useState<ConceptBriefDoc | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchData = async () => {
        if (!clientId || !conceptId) return;
        setIsLoading(true);
        try {
            const today = new Date();
            const rangeEnd = today.toISOString().split("T")[0];
            const rangeStart = new Date(today.setDate(today.getDate() - 14)).toISOString().split("T")[0];

            const res = await fetch(`/api/concepts/${conceptId}?clientId=${clientId}&rangeStart=${rangeStart}&rangeEnd=${rangeEnd}`);
            const data = await res.json();
            setDetail(data);

            // Check if brief exists
            const briefRes = await fetch(`/api/concepts/${conceptId}/brief`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, range: { start: rangeStart, end: rangeEnd }, dryRun: true })
            });
            const briefData = await briefRes.json();
            if (briefData.status === 'cached') setBrief(briefData.brief);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId, conceptId]);

    const generateBrief = async () => {
        setIsGenerating(true);
        try {
            const today = new Date();
            const rangeEnd = today.toISOString().split("T")[0];
            const rangeStart = new Date(today.setDate(today.getDate() - 14)).toISOString().split("T")[0];
            const res = await fetch(`/api/concepts/${conceptId}/brief`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, range: { start: rangeStart, end: rangeEnd } })
            });
            const data = await res.json();
            if (data.status === 'generated' || data.status === 'cached') {
                setBrief(data.brief);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) return <AppLayout><div className="p-12 text-center text-text-muted">Cargando Detalle de Concepto...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 pb-32">
                <header className="flex justify-between items-end bg-stellar/50 p-8 rounded-2xl border border-argent/50">
                    <div>
                        <button onClick={() => router.back()} className="text-[10px] font-black text-text-muted uppercase tracking-widest hover:text-classic transition-all mb-4">← Volver a Librería</button>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block">Análisis Profundo de Concepto</span>
                        <h1 className="text-display font-black text-text-primary uppercase leading-none tracking-tighter">{conceptId}</h1>
                    </div>
                    <button
                        onClick={generateBrief}
                        disabled={isGenerating}
                        className="bg-special hover:bg-special-dark text-white font-black px-8 py-4 rounded-xl uppercase tracking-widest transition-all shadow-xl shadow-special/20 disabled:opacity-50"
                    >
                        {isGenerating ? "Generando Brief..." : brief ? "Actualizar Brief AI" : "Generar Creative Brief AI"}
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Metrics Sidebar */}
                    <div className="space-y-6">
                        <section className="bg-stellar border border-argent rounded-2xl p-6">
                            <h3 className="text-[11px] font-black text-text-muted uppercase tracking-widest mb-6 border-b border-argent/50 pb-2">Evidencia Real</h3>
                            {detail?.error ? (
                                <div className="text-small text-red-400 font-bold p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                                    Error: {detail.error}
                                </div>
                            ) : !detail?.evidenceFacts ? (
                                <div className="text-small text-text-muted italic">No hay evidencia disponible.</div>
                            ) : (
                                <ul className="space-y-4">
                                    {detail.evidenceFacts.map((fact: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-small text-text-primary font-bold">
                                            <span className="text-synced">▶</span> {fact}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="bg-stellar border border-argent rounded-2xl p-6">
                            <h3 className="text-[11px] font-black text-text-muted uppercase tracking-widest mb-6 border-b border-argent/50 pb-2">Distribución de Intención</h3>
                            {!detail?.intentMix ? (
                                <div className="text-small text-text-muted italic">No hay datos de intención.</div>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(detail.intentMix).map(([stage, pct]: any) => (
                                        <div key={stage} className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-black">
                                                <span className="text-text-muted uppercase">{stage}</span>
                                                <span className="text-text-primary">{Math.round(pct * 100)}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-argent/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-classic" style={{ width: `${pct * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Main Brief Area */}
                    <div className="lg:col-span-2">
                        {!brief ? (
                            <div className="bg-stellar border-2 border-dashed border-argent/50 rounded-3xl p-20 text-center flex flex-col items-center justify-center space-y-6">
                                <div className="text-6xl">📝</div>
                                <div>
                                    <h2 className="text-subheader font-black text-text-primary uppercase tracking-widest">Esperando Brief Estratégico</h2>
                                    <p className="text-small text-text-muted mt-2 max-w-sm mx-auto">Gemini generará un documento operativo basado en el rendimiento histórico de este concepto.</p>
                                </div>
                                <button
                                    onClick={generateBrief}
                                    className="bg-classic text-special font-black px-10 py-5 uppercase tracking-widest hover:scale-105 transition-all text-small"
                                >
                                    Generar Ahora
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <div className="bg-stellar border border-argent shadow-2xl rounded-3xl overflow-hidden">
                                    <div className="bg-stellar p-8 border-b border-argent">
                                        <h2 className="text-subheader font-black text-text-primary uppercase tracking-widest mb-4">Contexto y Diagnóstico</h2>
                                        <p className="text-body text-text-secondary leading-relaxed font-medium">{brief.context}</p>
                                    </div>

                                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">Plan de Rotación (Diferenciación)</h4>
                                            <div className="space-y-3">
                                                {Object.entries(brief.rotationPlan).map(([key, val]) => (
                                                    <div key={key} className="flex gap-3 items-start">
                                                        <span className="text-classic font-black uppercase text-[10px] w-16 pt-0.5">{key}:</span>
                                                        <p className="text-small text-text-primary font-bold italic">{val}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-special p-6 rounded-2xl border border-argent/50">
                                            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">Diagnóstico IA</h4>
                                            <p className="text-small text-text-secondary italic leading-relaxed">{brief.diagnosis}</p>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-stellar/30 border-t border-argent">
                                        <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-6">Entregables de Producción</h4>
                                        <div className="space-y-6">
                                            {brief.deliverables.map((item, i) => (
                                                <div key={i} className="bg-special border border-argent/50 p-6 rounded-2xl shadow-sm">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <h5 className="text-small font-black text-text-primary">Idea {i + 1}: {item.title}</h5>
                                                        <span className="text-[8px] font-black px-2 py-0.5 bg-stellar text-text-muted rounded uppercase">{item.proofType}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <p className="text-[9px] font-black text-text-muted uppercase mb-1">Hooks</p>
                                                                <ul className="space-y-2">
                                                                    {item.hooks.map((h, j) => <li key={j} className="text-small font-bold italic text-classic border-l-2 border-classic pl-3">"{h}"</li>)}
                                                                </ul>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-black text-text-muted uppercase mb-1">CTA</p>
                                                                <p className="text-small font-bold text-text-primary uppercase tracking-tight">{item.cta}</p>
                                                            </div>
                                                        </div>
                                                        <div className="bg-stellar p-4 rounded-xl">
                                                            <p className="text-[9px] font-black text-text-muted uppercase mb-2">Visual / Guion</p>
                                                            <p className="text-small text-text-secondary leading-tight mb-3 font-medium">{item.visual}</p>
                                                            <div className="bg-special p-3 rounded border border-argent/20">
                                                                <p className="text-[10px] text-text-primary font-bold italic leading-relaxed">{item.script}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
