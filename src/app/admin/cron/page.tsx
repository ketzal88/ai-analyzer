"use client";

import React, { useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";

interface CronResult {
    clientId: string;
    clientName: string;
    status: "success" | "skipped" | "failed";
    error?: string;
}

interface CronResponse {
    success: boolean;
    summary: {
        total: number;
        success: number;
        skipped: number;
        failed: number;
    };
    results: CronResult[];
    error?: string;
}

export default function AdminCronPage() {
    const [showModal, setShowModal] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [response, setResponse] = useState<CronResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState<number | null>(null);

    const handleRunCron = async () => {
        setShowModal(false);
        setIsRunning(true);
        setResponse(null);
        setError(null);
        const start = Date.now();
        setStartedAt(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        try {
            const res = await fetch("/api/admin/trigger-cron", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cronType: "data-sync" }),
            });

            const data = await res.json();
            setElapsed(Math.round((Date.now() - start) / 1000));

            if (!res.ok) {
                setError(data.error || `HTTP ${res.status}`);
                return;
            }

            setResponse(data);
        } catch (err: any) {
            setElapsed(Math.round((Date.now() - start) / 1000));
            setError(err.message || "Error de red");
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                {/* Header */}
                <div className="border-b border-argent pb-6">
                    <h1 className="text-hero text-text-primary mb-1">Cron Manual</h1>
                    <p className="text-body text-text-secondary">Ejecuta manualmente los procesos de sincronizacion y computo de datos.</p>
                </div>

                {/* Data Sync Card */}
                <div className="bg-special border border-argent p-8 space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-classic/10 border border-classic/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-classic" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-subheader text-text-primary">Data Sync Completo</h2>
                                    <p className="text-tiny text-text-muted uppercase tracking-widest">CRON: /api/cron/data-sync</p>
                                </div>
                            </div>
                            <p className="text-small text-text-secondary max-w-xl">
                                Ejecuta el pipeline completo para <strong>todos los clientes activos</strong>: sincroniza datos de Meta API, computa snapshots pre-calculados (rolling metrics, clasificaciones, alertas) y limpia snapshots antiguos.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowModal(true)}
                            disabled={isRunning}
                            className={`px-6 py-3 font-bold text-small uppercase tracking-wider transition-all flex items-center gap-2 ${isRunning
                                    ? "bg-argent/20 border border-argent text-text-muted cursor-not-allowed"
                                    : "bg-classic hover:bg-classic-hover text-stellar border border-classic"
                                }`}
                        >
                            {isRunning ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
                                    <span>Ejecutando...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Ejecutar Ahora</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Pipeline Steps Info */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-argent/50">
                        {[
                            { step: "01", label: "Sync Meta API", desc: "Descarga datos raw de cada ad account" },
                            { step: "02", label: "Compute Snapshots", desc: "Rolling metrics, clasificaciones, alertas" },
                            { step: "03", label: "Cleanup", desc: "Elimina snapshots raw > 35 dias" },
                        ].map(s => (
                            <div key={s.step} className="flex items-start gap-3">
                                <span className="text-tiny font-black text-classic">{s.step}</span>
                                <div>
                                    <p className="text-small font-bold text-text-primary">{s.label}</p>
                                    <p className="text-tiny text-text-muted">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Running Indicator */}
                {isRunning && (
                    <div className="bg-classic/5 border border-classic/20 p-6 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin" />
                            <div>
                                <p className="text-small font-bold text-text-primary">Pipeline en ejecucion...</p>
                                <p className="text-tiny text-text-muted">Iniciado a las {startedAt}. Esto puede tomar varios minutos dependiendo de la cantidad de clientes.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-6 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-small font-bold text-red-500">Error Fatal</p>
                                <p className="text-tiny text-red-400">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results */}
                {response && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* Summary */}
                        <div className="grid grid-cols-4 gap-4">
                            {[
                                { label: "Total", value: response.summary.total, color: "text-text-primary" },
                                { label: "Exitosos", value: response.summary.success, color: "text-emerald-500" },
                                { label: "Omitidos", value: response.summary.skipped, color: "text-yellow-500" },
                                { label: "Fallidos", value: response.summary.failed, color: response.summary.failed > 0 ? "text-red-500" : "text-text-muted" },
                            ].map(s => (
                                <div key={s.label} className="bg-special border border-argent p-5 text-center">
                                    <p className={`text-display font-black ${s.color}`}>{s.value}</p>
                                    <p className="text-tiny text-text-muted uppercase tracking-widest font-bold mt-1">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Elapsed */}
                        {elapsed !== null && (
                            <p className="text-tiny text-text-muted text-center">
                                Completado en <span className="font-bold text-text-primary">{elapsed}s</span> — {new Date().toLocaleTimeString("es-AR")}
                            </p>
                        )}

                        {/* Detail Table */}
                        <div className="bg-special border border-argent overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-argent bg-stellar/50">
                                        <th className="px-4 py-3 text-tiny font-black text-text-muted uppercase tracking-widest">Cliente</th>
                                        <th className="px-4 py-3 text-tiny font-black text-text-muted uppercase tracking-widest">ID</th>
                                        <th className="px-4 py-3 text-tiny font-black text-text-muted uppercase tracking-widest">Estado</th>
                                        <th className="px-4 py-3 text-tiny font-black text-text-muted uppercase tracking-widest">Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {response.results.map((r) => (
                                        <tr key={r.clientId} className="border-b border-argent/30 hover:bg-stellar/30 transition-colors">
                                            <td className="px-4 py-3 text-small font-bold text-text-primary">{r.clientName}</td>
                                            <td className="px-4 py-3 text-tiny text-text-muted font-mono">{r.clientId}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 text-tiny font-bold uppercase tracking-wider ${r.status === "success" ? "text-emerald-500" :
                                                        r.status === "skipped" ? "text-yellow-500" :
                                                            "text-red-500"
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${r.status === "success" ? "bg-emerald-500" :
                                                            r.status === "skipped" ? "bg-yellow-500" :
                                                                "bg-red-500"
                                                        }`} />
                                                    {r.status === "success" ? "OK" : r.status === "skipped" ? "OMITIDO" : "FALLO"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-tiny text-red-400 max-w-xs truncate">{r.error || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stellar/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-special border border-argent shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-argent">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-subheader text-text-primary">Confirmar Ejecucion</h3>
                                    <p className="text-tiny text-text-muted">Data Sync Completo</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-small text-text-secondary">
                                Esto ejecutara el pipeline completo de sincronizacion para <strong className="text-text-primary">todos los clientes activos</strong>:
                            </p>
                            <ul className="space-y-2 text-small text-text-secondary">
                                <li className="flex items-center gap-2">
                                    <span className="w-1 h-1 bg-classic rounded-full" />
                                    Descarga de datos desde Meta API
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1 h-1 bg-classic rounded-full" />
                                    Computo de snapshots y metricas rolling
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1 h-1 bg-classic rounded-full" />
                                    Generacion de clasificaciones y alertas
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1 h-1 bg-classic rounded-full" />
                                    Limpieza de datos antiguos (&gt;35 dias)
                                </li>
                            </ul>
                            <div className="bg-yellow-500/5 border border-yellow-500/20 p-3">
                                <p className="text-tiny text-yellow-500 font-bold">
                                    Este proceso puede tardar varios minutos y consume llamadas a la Meta API.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-argent flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 border border-argent text-text-secondary text-small font-bold uppercase tracking-wider hover:border-text-muted transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRunCron}
                                className="px-5 py-2.5 bg-classic hover:bg-classic-hover text-stellar text-small font-bold uppercase tracking-wider border border-classic transition-colors"
                            >
                                Si, Ejecutar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
