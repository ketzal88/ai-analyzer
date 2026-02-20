"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { SystemEvent, CronExecution, AccountHealth } from "@/types/system-events";

type Tab = "events" | "cron" | "health" | "accounts";

export default function AdminSystemPage() {
    const [activeTab, setActiveTab] = useState<Tab>("events");
    const [events, setEvents] = useState<SystemEvent[]>([]);
    const [cronHistory, setCronHistory] = useState<CronExecution[]>([]);
    const [health, setHealth] = useState<any>(null);
    const [accountHealth, setAccountHealth] = useState<AccountHealth[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [serviceFilter, setServiceFilter] = useState<string>("all");
    const [expandedCron, setExpandedCron] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [activeTab, severityFilter, serviceFilter]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === "events") {
                const params = new URLSearchParams();
                if (severityFilter !== "all") params.set("severity", severityFilter);
                if (serviceFilter !== "all") params.set("service", serviceFilter);
                const res = await fetch(`/api/admin/system-events?${params}`);
                if (res.ok) setEvents(await res.json());
            } else if (activeTab === "cron") {
                const res = await fetch("/api/admin/cron-history");
                if (res.ok) setCronHistory(await res.json());
            } else if (activeTab === "health") {
                const res = await fetch("/api/health");
                setHealth(await res.json());
            } else if (activeTab === "accounts") {
                const res = await fetch("/api/admin/account-health");
                if (res.ok) setAccountHealth(await res.json());
            }
        } catch (err) {
            console.error("Failed to load data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const severityBadge = (severity: string) => {
        const cls = severity === "critical"
            ? "bg-red-500/10 text-red-500 border-red-500/20"
            : severity === "warning"
                ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                : "bg-blue-500/10 text-blue-500 border-blue-500/20";
        return <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border ${cls}`}>{severity}</span>;
    };

    const statusBadge = (status: string) => {
        const cls = status === "ok" || status === "success"
            ? "text-emerald-500"
            : status === "degraded" || status === "skipped"
                ? "text-yellow-500"
                : "text-red-500";
        return (
            <span className={`inline-flex items-center gap-1 text-tiny font-bold uppercase tracking-wider ${cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status === "ok" || status === "success" ? "bg-emerald-500" : status === "degraded" || status === "skipped" ? "bg-yellow-500" : "bg-red-500"}`} />
                {status}
            </span>
        );
    };

    const spendCapBadge = (level: string) => {
        const cls = level === "imminent"
            ? "bg-red-500/10 text-red-500 border-red-500/20"
            : level === "critical"
                ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                : level === "warning"
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        return <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border ${cls}`}>{level}</span>;
    };

    const accountStatusBadge = (statusName: string) => {
        const isActive = statusName === "ACTIVE";
        const cls = isActive
            ? "text-emerald-500"
            : "text-red-500";
        return (
            <span className={`inline-flex items-center gap-1 text-tiny font-bold uppercase tracking-wider ${cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                {statusName}
            </span>
        );
    };

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        } catch { return iso; }
    };

    const fmtCurrency = (n: number) => {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
        return `$${n.toFixed(0)}`;
    };

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto space-y-6 pb-20">
                {/* Header */}
                <div className="border-b border-argent pb-6">
                    <h1 className="text-hero text-text-primary mb-1">Sistema</h1>
                    <p className="text-body text-text-secondary">Eventos, historial de cron, estado del sistema y salud de cuentas Meta.</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-stellar border border-argent p-1">
                    {([
                        { id: "events" as Tab, label: "Eventos", count: events.length },
                        { id: "cron" as Tab, label: "Historial Cron", count: cronHistory.length },
                        { id: "accounts" as Tab, label: "Account Health", count: accountHealth.length },
                        { id: "health" as Tab, label: "Estado", count: null },
                    ]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 px-4 py-2.5 text-small font-bold uppercase tracking-wider transition-all ${activeTab === tab.id
                                ? "bg-classic text-stellar"
                                : "text-text-muted hover:text-text-primary"
                            }`}
                        >
                            {tab.label}
                            {tab.count !== null && activeTab === tab.id && (
                                <span className="ml-2 text-[10px] opacity-70">({tab.count})</span>
                            )}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center min-h-[300px]">
                        <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* EVENTS TAB */}
                        {activeTab === "events" && (
                            <div className="space-y-4">
                                {/* Filters */}
                                <div className="flex gap-3">
                                    <select
                                        value={severityFilter}
                                        onChange={e => setSeverityFilter(e.target.value)}
                                        className="bg-stellar border border-argent px-3 py-2 text-small outline-none focus:border-classic"
                                    >
                                        <option value="all">Todas las severidades</option>
                                        <option value="critical">Critical</option>
                                        <option value="warning">Warning</option>
                                        <option value="info">Info</option>
                                    </select>
                                    <select
                                        value={serviceFilter}
                                        onChange={e => setServiceFilter(e.target.value)}
                                        className="bg-stellar border border-argent px-3 py-2 text-small outline-none focus:border-classic"
                                    >
                                        <option value="all">Todos los servicios</option>
                                        <option value="meta">Meta</option>
                                        <option value="firestore">Firestore</option>
                                        <option value="slack">Slack</option>
                                        <option value="gemini">Gemini</option>
                                        <option value="cron">Cron</option>
                                    </select>
                                    <button
                                        onClick={loadData}
                                        className="px-4 py-2 border border-argent text-text-muted text-small font-bold uppercase tracking-wider hover:border-classic transition-colors"
                                    >
                                        Refrescar
                                    </button>
                                </div>

                                {events.length === 0 ? (
                                    <div className="bg-special border border-argent p-12 text-center">
                                        <p className="text-text-muted text-small">No hay eventos registrados.</p>
                                    </div>
                                ) : (
                                    <div className="bg-special border border-argent overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-argent bg-stellar/50">
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-36">Fecha</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-20">Severidad</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-20">Servicio</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest">Mensaje</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-32">Cliente</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {events.map((e) => (
                                                    <tr key={e.id} className="border-b border-argent/30 hover:bg-stellar/30 transition-colors">
                                                        <td className="px-3 py-2.5 text-tiny text-text-muted font-mono">{formatTime(e.timestamp)}</td>
                                                        <td className="px-3 py-2.5">{severityBadge(e.severity)}</td>
                                                        <td className="px-3 py-2.5 text-tiny text-text-muted uppercase">{e.service}</td>
                                                        <td className="px-3 py-2.5 text-small text-text-primary max-w-md truncate">{e.message}</td>
                                                        <td className="px-3 py-2.5 text-tiny text-text-muted">{e.clientName || e.clientId || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CRON HISTORY TAB */}
                        {activeTab === "cron" && (
                            <div className="space-y-4">
                                <button
                                    onClick={loadData}
                                    className="px-4 py-2 border border-argent text-text-muted text-small font-bold uppercase tracking-wider hover:border-classic transition-colors"
                                >
                                    Refrescar
                                </button>

                                {cronHistory.length === 0 ? (
                                    <div className="bg-special border border-argent p-12 text-center">
                                        <p className="text-text-muted text-small">No hay ejecuciones registradas.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {cronHistory.map((exec) => (
                                            <div key={exec.id} className="bg-special border border-argent">
                                                <button
                                                    onClick={() => setExpandedCron(expandedCron === exec.id ? null : (exec.id || null))}
                                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-stellar/30 transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-tiny font-black text-classic uppercase">{exec.cronType}</span>
                                                        <span className="text-tiny text-text-muted font-mono">{formatTime(exec.startedAt)}</span>
                                                        <span className="text-tiny text-text-muted">{(exec.durationMs / 1000).toFixed(1)}s</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {exec.summary.failed > 0 && (
                                                            <span className="text-tiny font-bold text-red-500">{exec.summary.failed} fallidos</span>
                                                        )}
                                                        <span className="text-tiny font-bold text-emerald-500">{exec.summary.success}/{exec.summary.total}</span>
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${exec.triggeredBy === "manual" ? "border-classic/30 text-classic" : "border-argent text-text-muted"}`}>
                                                            {exec.triggeredBy}
                                                        </span>
                                                        <svg className={`w-4 h-4 text-text-muted transition-transform ${expandedCron === exec.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </button>

                                                {expandedCron === exec.id && exec.results && (
                                                    <div className="border-t border-argent/50 px-4 py-3">
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr>
                                                                    <th className="px-2 py-1.5 text-[10px] font-black text-text-muted uppercase">Cliente</th>
                                                                    <th className="px-2 py-1.5 text-[10px] font-black text-text-muted uppercase">Estado</th>
                                                                    <th className="px-2 py-1.5 text-[10px] font-black text-text-muted uppercase">Error</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {exec.results.map((r, i) => (
                                                                    <tr key={i} className="border-t border-argent/20">
                                                                        <td className="px-2 py-1.5 text-tiny text-text-primary">{r.clientName || r.clientId}</td>
                                                                        <td className="px-2 py-1.5">{statusBadge(r.status)}</td>
                                                                        <td className="px-2 py-1.5 text-tiny text-red-400 max-w-xs truncate">{r.error || "—"}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ACCOUNT HEALTH TAB */}
                        {activeTab === "accounts" && (
                            <div className="space-y-4">
                                <button
                                    onClick={loadData}
                                    className="px-4 py-2 border border-argent text-text-muted text-small font-bold uppercase tracking-wider hover:border-classic transition-colors"
                                >
                                    Refrescar
                                </button>

                                {accountHealth.length === 0 ? (
                                    <div className="bg-special border border-argent p-12 text-center">
                                        <p className="text-text-muted text-small">No hay datos de account health. Ejecuta el cron de account-health primero.</p>
                                    </div>
                                ) : (
                                    <div className="bg-special border border-argent overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-argent bg-stellar/50">
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest">Cliente</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-24">Cuenta</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-28">Estado Meta</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-28">Spend Cap</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-20">Nivel</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-20">Días rest.</th>
                                                    <th className="px-3 py-2.5 text-[10px] font-black text-text-muted uppercase tracking-widest w-32">Última verif.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {accountHealth.map((ah) => (
                                                    <tr key={ah.clientId} className="border-b border-argent/30 hover:bg-stellar/30 transition-colors">
                                                        <td className="px-3 py-2.5 text-small text-text-primary font-bold">{ah.clientName}</td>
                                                        <td className="px-3 py-2.5 text-tiny text-text-muted font-mono">{ah.metaAccountId.replace("act_", "")}</td>
                                                        <td className="px-3 py-2.5">{accountStatusBadge(ah.accountStatusName)}</td>
                                                        <td className="px-3 py-2.5 text-tiny text-text-muted">
                                                            {ah.spendCap && ah.amountSpent !== undefined ? (
                                                                <span>
                                                                    {fmtCurrency(ah.amountSpent)} / {fmtCurrency(ah.spendCap)}
                                                                    <span className="ml-1 text-text-primary font-bold">({ah.spendCapPct?.toFixed(0)}%)</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-text-muted">Sin cap</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5">{spendCapBadge(ah.spendCapAlertLevel)}</td>
                                                        <td className="px-3 py-2.5 text-tiny text-text-muted text-center">
                                                            {ah.projectedCutoffDays !== undefined ? `~${ah.projectedCutoffDays}d` : "—"}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-tiny text-text-muted font-mono">{formatTime(ah.lastChecked)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* HEALTH TAB */}
                        {activeTab === "health" && health && (
                            <div className="space-y-6">
                                <div className="bg-special border border-argent p-8">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className={`w-12 h-12 flex items-center justify-center border ${health.status === "ok" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                                            {health.status === "ok" ? (
                                                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-subheader text-text-primary">
                                                {health.status === "ok" ? "Sistema Operativo" : "Sistema Degradado"}
                                            </h2>
                                            <p className="text-tiny text-text-muted font-mono">{health.timestamp}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {Object.entries(health.checks || {}).map(([key, value]) => (
                                            <div key={key} className="bg-stellar border border-argent p-4">
                                                <p className="text-tiny text-text-muted uppercase tracking-widest font-bold mb-2">{key}</p>
                                                {statusBadge(value as string)}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={loadData}
                                    className="px-4 py-2 border border-argent text-text-muted text-small font-bold uppercase tracking-wider hover:border-classic transition-colors"
                                >
                                    Re-verificar
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
