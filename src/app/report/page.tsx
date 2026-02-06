"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useClient } from "@/contexts/ClientContext";
import AppLayout from "@/components/layouts/AppLayout";
import GemReportRenderer from "@/components/report/GemReportRenderer";
import { GemReportV1 } from "@/types/gem-report";
import { useSearchParams } from "next/navigation";

import { DateRangeOption } from "@/components/pages/Dashboard";

function ReportContent() {
    const { selectedClientId } = useClient();
    const [reportData, setReportData] = useState<GemReportV1 | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<DateRangeOption>("last_14d");

    // Allow overriding clientId via URL for sharing/direct access
    const searchParams = useSearchParams();
    const queryClientId = searchParams.get("clientId");
    const activeClientId = queryClientId || selectedClientId;

    const generateReport = async () => {
        if (!activeClientId) return;
        setIsLoading(true);
        setError(null);
        try {
            // Use unified Analyze Endpoint
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: activeClientId,
                    currentRangePreset: range,
                    compareMode: "previous_period",
                    flags: {
                        runLLM: true // Trigger Gemini
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to generate report");
            }

            const data = await res.json();
            if (data.report) {
                setReportData(data.report as GemReportV1);
            } else {
                throw new Error("No report generated. Try again.");
            }
        } catch (err: any) {
            console.error("Report generation error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // No auto-fetch on mount anymore (Mission 21)

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <div className="w-12 h-12 border-4 border-classic border-t-transparent rounded-full animate-spin"></div>
                <p className="text-body font-bold text-text-muted animate-pulse">
                    Analizando con Inteligencia Artificial...
                </p>
                <p className="text-[12px] text-text-muted/50">Esto puede tomar hasta 30 segundos.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <h3 className="text-subheader font-bold text-red-500 mb-2">Error al Generar Reporte</h3>
                    <p className="text-body text-text-secondary">{error}</p>
                    <button
                        onClick={generateReport}
                        className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-small font-bold hover:bg-red-600 transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    if (!activeClientId) {
        return (
            <div className="text-center p-10 text-text-muted">
                Seleccione un cliente para iniciar el análisis estratégico y operativo.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Control Bar */}
            <div className="flex justify-end items-center gap-4 bg-stellar/30 p-4 rounded-xl border border-argent/50">
                <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Rango de Análisis</span>
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value as DateRangeOption)}
                        className="bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-bold text-text-primary focus:border-classic outline-none min-w-[160px]"
                    >
                        <option value="last_7d">Últimos 7 días</option>
                        <option value="last_14d">Últimos 14 días</option>
                        <option value="last_30d">Últimos 30 días</option>
                        <option value="last_90d">Últimos 90 días</option>
                        <option value="this_month">Este Mes</option>
                        <option value="last_month">Mes Pasado</option>
                    </select>
                </div>

                <button
                    onClick={generateReport}
                    className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-classic/20 hover:shadow-classic/40 active:scale-95 transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    GENERAR REPORTE IA
                </button>
            </div>

            {reportData ? (
                <GemReportRenderer report={reportData} />
            ) : (
                <div className="text-center p-12 border-2 border-dashed border-argent rounded-xl opacity-50">
                    <p className="text-subheader text-text-muted">Configure el rango y genere el reporte para ver el análisis.</p>
                </div>
            )}
        </div>
    );
}

export default function ReportPage() {
    return (
        <AppLayout>
            <div>
                <Suspense fallback={<div>Cargando parámetros...</div>}>
                    <ReportContent />
                </Suspense>
            </div>
        </AppLayout>
    );
}
