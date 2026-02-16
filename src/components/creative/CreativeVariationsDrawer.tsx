"use client";

import React, { useState, useEffect } from "react";
import { CreativeVariation, CreativeVariationsReport } from "@/types/creative-analysis";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    adId: string;
    range: { start: string; end: string } | string;
}

export default function CreativeVariationsDrawer({ isOpen, onClose, clientId, adId, range }: Props) {
    const [objective, setObjective] = useState("Explorar nuevos hooks");
    const [quantity, setQuantity] = useState(5);
    const [report, setReport] = useState<CreativeVariationsReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);

    const steps = [
        "Analizando contexto...",
        "Explorando variaciones...",
        "Estructurando resultados..."
    ];

    // Auto-fetch if cached on open
    useEffect(() => {
        if (isOpen) {
            checkCache();
        }
    }, [isOpen]);

    const checkCache = async () => {
        // We call the same API, the service handles caching
        // If it's fast (< 500ms), it was likely a cache hit
        const start = Date.now();
        setIsLoading(true);
        try {
            const res = await fetch("/api/creative/variations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, adId, range, objective, checkOnly: true })
            });
            const data = await res.json();
            if (data.report && !data.report.error) {
                setReport(data.report);
            }
        } catch (e) {
            console.error("Cache check failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setReport(null);
        setLoadingStep(0);

        const stepInterval = setInterval(() => {
            setLoadingStep(prev => (prev < 2 ? prev + 1 : prev));
        }, 2000);

        try {
            const res = await fetch("/api/creative/variations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, adId, range, objective, quantity })
            });
            const data = await res.json();
            if (data.report && !data.report.error) {
                setReport(data.report);
            } else {
                alert("Error: " + (data.error || "No se pudieron generar variaciones"));
            }
        } catch (error) {
            alert("Error de conexión");
        } finally {
            clearInterval(stepInterval);
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Simple toast would be better but keeping it minimal as requested
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />

            {/* Drawer */}
            <div className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-stellar border-l border-argent z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="p-6 border-b border-argent bg-special/50 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">Exploración de Variaciones Copy (GEM)</h2>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                            Generación basada en performance observada | {typeof range === 'string' ? range : `${range.start} - ${range.end}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-argent/20 rounded-full transition-colors">
                        <span className="text-xl">✕</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Setup Section */}
                    {!report && !isLoading && (
                        <div className="card space-y-6">
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Objetivo de Exploración</span>
                                    <select
                                        value={objective}
                                        onChange={(e) => setObjective(e.target.value)}
                                        className="w-full bg-special border border-argent rounded-xl px-4 py-3 text-body focus:border-classic outline-none transition-all"
                                    >
                                        <option>Mejorar escala</option>
                                        <option>Explorar nuevos hooks</option>
                                        <option>Variar ángulo de mensaje</option>
                                        <option>Iterar sobre lo que ya funciona</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Cantidad de Variaciones</span>
                                    <select
                                        value={quantity}
                                        onChange={(e) => setQuantity(Number(e.target.value))}
                                        className="w-full bg-special border border-argent rounded-xl px-4 py-3 text-body focus:border-classic outline-none"
                                    >
                                        <option value={3}>3 Variaciones</option>
                                        <option value={5}>5 Variaciones</option>
                                        <option value={8}>8 Variaciones</option>
                                    </select>
                                </label>
                            </div>

                            <button
                                onClick={handleGenerate}
                                className="w-full py-4 bg-classic text-special font-black uppercase tracking-widest transition-all active:scale-[0.98] hover:brightness-110"
                            >
                                Generar Variaciones con GEM ✨
                            </button>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-6">
                            <div className="w-12 h-12 border-4 border-classic border-t-transparent rounded-full animate-spin" />
                            <div className="text-center">
                                <p className="text-subheader font-black text-text-primary animate-pulse uppercase tracking-widest">
                                    {steps[loadingStep]}
                                </p>
                                <p className="text-[10px] text-text-muted mt-2 font-bold uppercase">Esto puede tomar unos segundos</p>
                            </div>
                        </div>
                    )}

                    {/* Results Render */}
                    {report && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="px-3 py-1 bg-classic/10 text-classic text-[10px] font-black rounded-full uppercase tracking-widest">
                                    creative_role: exploration
                                </span>
                                {new Date().getTime() - new Date(report.metadata.generatedAt).getTime() < 60000 && (
                                    <span className="text-[9px] font-bold text-synced uppercase">Resultado cacheado</span>
                                )}
                            </div>

                            <div className="space-y-8">
                                {report.variations.map((v, i) => (
                                    <div key={i} className="card bg-special border-argent p-6 space-y-4 hover:border-classic/30 transition-all group">
                                        <header className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <h4 className="text-body font-black text-classic uppercase">{v.concept_name}</h4>
                                                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Eje: {v.difference_axis}</p>
                                            </div>
                                            <button className="text-text-muted hover:text-yellow-500 transition-colors">⭐</button>
                                        </header>

                                        <div className="space-y-4">
                                            <div className="p-3 bg-stellar/50 rounded-lg border border-argent/50">
                                                <span className="text-[9px] font-bold text-text-muted uppercase block mb-1">Hook / Gancho</span>
                                                <p className="text-small italic">"{v.hooks?.[0] || v.target_context || "Variación estratégica"}"</p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-text-muted uppercase">Primary Copy</span>
                                                    <button onClick={() => copyToClipboard(v.copy_variations?.[0] || "")} className="text-[9px] font-black text-classic hover:underline">COPIAR</button>
                                                </div>
                                                <p className="text-small text-text-primary leading-relaxed">{v.copy_variations?.[0] || "No se generó el texto principal."}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-text-muted uppercase">Headline</span>
                                                    <button onClick={() => copyToClipboard(v.headline_variations?.[0] || "")} className="text-[9px] font-black text-classic hover:underline">COPIAR</button>
                                                </div>
                                                <p className="text-small font-bold text-text-primary">{v.headline_variations?.[0] || "Headline sugerido"}</p>
                                            </div>

                                            {v.visual_context && (
                                                <div className="p-3 border border-classic/10 bg-classic/5 rounded-xl">
                                                    <span className="text-[9px] font-bold text-classic uppercase block mb-1">Visual Context / Shot Suggestion</span>
                                                    <p className="text-[10px] text-text-secondary leading-snug">{v.visual_context}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button onClick={() => setReport(null)} className="w-full py-3 border border-argent text-text-muted text-[10px] font-black uppercase rounded-xl hover:bg-argent/10 transition-all mt-10">
                                Volver a Parámetros
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
}
