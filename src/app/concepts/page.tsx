"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ConceptRollup, ConceptHealth } from "@/types/concepts";
import { ConceptBriefDoc } from "@/types/concept-ai-brief";
import Link from "next/link";

export default function ConceptLibrary() {
    const { selectedClientId: clientId } = useClient();
    const [concepts, setConcepts] = useState<ConceptRollup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchConcepts = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch(`/api/concepts?clientId=${clientId}&rangeStart=${today}&rangeEnd=${today}`);
            const data = await res.json();
            setConcepts(data.concepts || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConcepts();
    }, [clientId]);

    if (isLoading) return <AppLayout><div className="p-12 text-center text-text-muted">Cargando Librería de Conceptos...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="bg-stellar/50 p-6 rounded-xl border border-argent/50">
                    <h1 className="text-display font-black text-text-primary uppercase tracking-tighter">Librería de Conceptos</h1>
                    <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">Inteligencia Creativa y Monitoreo de Fatiga</p>
                </header>

                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-special/50 p-4 rounded-xl border border-argent/50 grid grid-cols-12 text-[10px] font-black text-text-muted uppercase tracking-widest px-8">
                        <div className="col-span-4">Concepto</div>
                        <div className="col-span-2 text-center">Estado</div>
                        <div className="col-span-2 text-center">Cuota de Gasto</div>
                        <div className="col-span-2 text-center">CPA (7d vs 14d)</div>
                        <div className="col-span-2 text-right">Acción</div>
                    </div>

                    {concepts.length === 0 ? (
                        <div className="p-20 text-center bg-stellar rounded-2xl border border-dashed border-argent/50">
                            <p className="text-body font-bold text-text-muted">No se detectaron conceptos con datos suficientes.</p>
                        </div>
                    ) : (
                        concepts.map(concept => (
                            <div key={concept.conceptId} className="bg-stellar p-6 rounded-xl border border-argent/50 grid grid-cols-12 items-center px-8 hover:border-classic transition-all group">
                                <div className="col-span-4 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-argent/10 rounded-lg flex items-center justify-center font-black text-classic">
                                        {concept.conceptId[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-body font-black text-text-primary uppercase tracking-tight">{concept.conceptId}</p>
                                        <div className="flex gap-1 mt-1">
                                            {Object.entries(concept.intentMix).map(([stage, pct]) => pct > 0 && (
                                                <span key={stage} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${stage === 'BOFU' ? 'bg-special text-white' : 'bg-argent text-text-muted'}`}>
                                                    {stage} {Math.round(pct * 100)}%
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 flex justify-center">
                                    <HealthBadge health={concept.health} />
                                </div>
                                <div className="col-span-2 text-center">
                                    <p className="text-small font-black text-text-primary">{(concept.spendShare * 100).toFixed(1)}%</p>
                                    <div className="w-16 h-1 bg-silver/20 rounded-full mx-auto mt-1 overflow-hidden">
                                        <div className="h-full bg-classic" style={{ width: `${concept.spendShare * 100}%` }} />
                                    </div>
                                </div>
                                <div className="col-span-2 text-center">
                                    <p className="text-small font-black text-text-primary">${concept.cpa_7d.toFixed(1)}</p>
                                    <DeltaIndicator value={concept.cpaDelta * 100} invert />
                                </div>
                                <div className="col-span-2 text-right">
                                    <Link
                                        href={`/concepts/${concept.conceptId}`}
                                        className="inline-block bg-stellar border border-argent hover:border-classic px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Ver Detalle
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function HealthBadge({ health }: { health: ConceptHealth }) {
    const styles: Record<ConceptHealth, string> = {
        HEALTHY: "bg-synced/10 text-synced border-synced/20",
        DEGRADING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
        CRITICAL_FATIGUE: "bg-red-500/10 text-red-500 border-red-500/20"
    };

    const labelMap: Record<ConceptHealth, string> = {
        HEALTHY: "SALUDABLE",
        DEGRADING: "DEGRADÁNDOSE",
        CRITICAL_FATIGUE: "FATIGA CRÍTICA"
    };

    return (
        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${styles[health]}`}>
            {labelMap[health]}
        </span>
    );
}

function DeltaIndicator({ value, invert = false }: { value: number, invert?: boolean }) {
    const isPositive = value > 0;
    const isGood = invert ? !isPositive : isPositive;

    if (Math.abs(value) < 1) return <span className="text-[9px] font-bold text-text-muted">ESTABLE</span>;

    return (
        <div className={`flex items-center justify-center gap-1 text-[10px] font-bold ${isGood ? 'text-synced' : 'text-red-500'}`}>
            <span>{isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(value).toFixed(1)}%</span>
        </div>
    );
}
