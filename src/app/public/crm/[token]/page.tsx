"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Lead, LeadQualification, LeadPostCallStatus, LeadQualityScore } from "@/types/leads";

const QUALIFICATION_OPTIONS: { value: LeadQualification; label: string; color: string }[] = [
    { value: "pending", label: "Pendiente", color: "text-text-muted" },
    { value: "calificado", label: "Calificado", color: "text-synced" },
    { value: "no_calificado", label: "No Calificado", color: "text-[#ef4444]" },
    { value: "spam", label: "Spam", color: "text-text-muted" },
    { value: "verificando", label: "Verificando", color: "text-[#f59e0b]" },
];

const POST_CALL_OPTIONS: { value: LeadPostCallStatus; label: string; color: string }[] = [
    { value: "pendiente", label: "Pendiente", color: "bg-special" },
    { value: "nuevo_cliente", label: "Nuevo Cliente", color: "bg-synced/20" },
    { value: "seguimiento", label: "Seguimiento", color: "bg-[#f59e0b]/20" },
    { value: "reprogramado", label: "Reprogramado", color: "bg-classic/20" },
    { value: "no_asistio", label: "No Asistió", color: "bg-[#ef4444]/20" },
    { value: "cancelo", label: "Canceló", color: "bg-[#ef4444]/10" },
];

const QUALITY_OPTIONS: { value: LeadQualityScore; label: string }[] = [
    { value: null, label: "—" },
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
];

function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const day = d.getDate();
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${day} ${months[d.getMonth()]}`;
}

type PageState = "loading" | "ready" | "error";

export default function PublicCrmPage() {
    const { token } = useParams<{ token: string }>();

    const [state, setState] = useState<PageState>("loading");
    const [error, setError] = useState("");
    const [clientName, setClientName] = useState("");
    const [closers, setClosers] = useState<string[]>([]);
    const [isFullFunnel, setIsFullFunnel] = useState(true);

    const [leads, setLeads] = useState<Lead[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);

    // Filters
    const [filterCloser, setFilterCloser] = useState("");
    const [filterQualification, setFilterQualification] = useState("");
    const [filterPostCall, setFilterPostCall] = useState("");
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            start: start.toISOString().slice(0, 10),
            end: now.toISOString().slice(0, 10),
        };
    });

    // Expand row for comments
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [commentDraft, setCommentDraft] = useState("");

    const fetchLeads = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                startDate: dateRange.start,
                endDate: dateRange.end,
            });
            if (filterCloser) params.set("closer", filterCloser);
            if (filterQualification) params.set("qualification", filterQualification);
            if (filterPostCall) params.set("postCallStatus", filterPostCall);

            const res = await fetch(`/api/public/${token}/leads?${params}`);
            if (!res.ok) {
                if (res.status === 403 || res.status === 404) {
                    const data = await res.json();
                    setError(data.error || "Link inválido");
                    setState("error");
                    return;
                }
                throw new Error("Failed to fetch");
            }
            const data = await res.json();
            setLeads(data.leads || []);
            setTotal(data.total || 0);
            setClosers(data.config?.closers || []);
            setIsFullFunnel(data.config?.mode !== "whatsapp_simple");
            setClientName(data.config?.clientName || "");
            if (state === "loading") setState("ready");
        } catch (err) {
            console.error("Error fetching leads:", err);
            if (state === "loading") {
                setError("Error al cargar los datos");
                setState("error");
            }
        } finally {
            setLoading(false);
        }
    }, [token, dateRange, filterCloser, filterQualification, filterPostCall, state]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    const updateLead = async (leadId: string, updates: Record<string, unknown>) => {
        setSaving(leadId);
        try {
            await fetch(`/api/public/${token}/leads`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, updates }),
            });
            setLeads((prev) =>
                prev.map((l) => (l.id === leadId ? { ...l, ...updates, updatedAt: new Date().toISOString() } as Lead : l))
            );
        } catch (err) {
            console.error("Error updating lead:", err);
        } finally {
            setSaving(null);
        }
    };

    // Stats
    const stats = {
        total: leads.length,
        calificados: leads.filter((l) => l.qualification === "calificado").length,
        attended: leads.filter((l) => l.attendance === true).length,
        newClients: leads.filter((l) => l.postCallStatus === "nuevo_cliente").length,
        revenue: leads.reduce((sum, l) => sum + (l.revenue || 0), 0),
    };

    if (state === "loading") {
        return (
            <div className="min-h-screen bg-stellar flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-text-muted text-small">Cargando CRM...</p>
                </div>
            </div>
        );
    }

    if (state === "error") {
        return (
            <div className="min-h-screen bg-stellar flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="text-3xl">🔒</div>
                    <h1 className="text-lg font-bold text-text-primary">{error}</h1>
                    <p className="text-small text-text-muted">
                        Contactá al equipo de Worker para obtener un nuevo link.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stellar text-white">
            {/* Header */}
            <header className="border-b border-argent bg-special">
                <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image src="/img/logos/worker-brain-logo-white.png" alt="Worker Brain" width={28} height={28} />
                        <div>
                            <h1 className="text-body font-bold text-text-primary">Leads CRM</h1>
                            <p className="text-tiny text-text-muted">{clientName}</p>
                        </div>
                    </div>
                    <span className="text-tiny text-text-muted bg-stellar px-2 py-1 rounded">
                        Powered by Worker Brain
                    </span>
                </div>
            </header>

            <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-3 bg-special border border-argent rounded-lg text-center">
                        <p className="text-lg font-black font-mono text-text-primary">{stats.total}</p>
                        <p className="text-[9px] text-text-muted uppercase tracking-widest">Total Leads</p>
                    </div>
                    <div className="p-3 bg-special border border-argent rounded-lg text-center">
                        <p className="text-lg font-black font-mono text-synced">{stats.calificados}</p>
                        <p className="text-[9px] text-text-muted uppercase tracking-widest">Calificados</p>
                    </div>
                    {isFullFunnel && (
                        <div className="p-3 bg-special border border-argent rounded-lg text-center">
                            <p className="text-lg font-black font-mono text-classic">{stats.attended}</p>
                            <p className="text-[9px] text-text-muted uppercase tracking-widest">Asistieron</p>
                        </div>
                    )}
                    <div className="p-3 bg-special border border-argent rounded-lg text-center">
                        <p className="text-lg font-black font-mono text-synced">{stats.newClients}</p>
                        <p className="text-[9px] text-text-muted uppercase tracking-widest">Nuevos Clientes</p>
                    </div>
                    <div className="p-3 bg-special border border-argent rounded-lg text-center">
                        <p className="text-lg font-black font-mono text-text-primary">
                            ${stats.revenue.toLocaleString("es-AR")}
                        </p>
                        <p className="text-[9px] text-text-muted uppercase tracking-widest">Revenue</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <label className="text-tiny text-text-muted font-bold">DESDE</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="text-small bg-stellar border border-argent rounded px-2 py-1 focus:border-classic outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-tiny text-text-muted font-bold">HASTA</label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="text-small bg-stellar border border-argent rounded px-2 py-1 focus:border-classic outline-none"
                        />
                    </div>
                    <select
                        value={filterCloser}
                        onChange={(e) => setFilterCloser(e.target.value)}
                        className="text-small bg-stellar border border-argent rounded px-2 py-1 focus:border-classic outline-none"
                    >
                        <option value="">Todos los closers</option>
                        {closers.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <select
                        value={filterQualification}
                        onChange={(e) => setFilterQualification(e.target.value)}
                        className="text-small bg-stellar border border-argent rounded px-2 py-1 focus:border-classic outline-none"
                    >
                        <option value="">Todas las calificaciones</option>
                        {QUALIFICATION_OPTIONS.map((q) => (
                            <option key={q.value} value={q.value}>{q.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterPostCall}
                        onChange={(e) => setFilterPostCall(e.target.value)}
                        className="text-small bg-stellar border border-argent rounded px-2 py-1 focus:border-classic outline-none"
                    >
                        <option value="">Todos los estados</option>
                        {POST_CALL_OPTIONS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>

                {/* Leads Table */}
                <div className="bg-special border border-argent rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-argent">
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Fecha</th>
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Nombre</th>
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Teléfono</th>
                                    {isFullFunnel && (
                                        <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Agenda</th>
                                    )}
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Closer</th>
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Calificación</th>
                                    <th className="text-center px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Calidad</th>
                                    {isFullFunnel && (
                                        <th className="text-center px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Asistió</th>
                                    )}
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Estado Post Llamada</th>
                                    <th className="text-right px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Revenue</th>
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">UTM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={11} className="text-center py-8 text-text-muted text-small">
                                            Cargando leads...
                                        </td>
                                    </tr>
                                ) : leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="text-center py-8 text-text-muted text-small">
                                            No hay leads en este período.
                                        </td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => {
                                        const rowColor = lead.postCallStatus === "nuevo_cliente"
                                            ? "bg-synced/5"
                                            : lead.postCallStatus === "seguimiento"
                                                ? "bg-[#f59e0b]/5"
                                                : lead.qualification === "spam"
                                                    ? "bg-argent/30"
                                                    : lead.postCallStatus === "no_asistio" || lead.postCallStatus === "cancelo"
                                                        ? "bg-[#ef4444]/5"
                                                        : "";
                                        const isExpanded = expandedId === lead.id;
                                        const isSaving = saving === lead.id;

                                        return (
                                            <React.Fragment key={lead.id}>
                                                <tr
                                                    className={`border-b border-argent/50 hover:bg-stellar/50 cursor-pointer transition-colors ${rowColor} ${isSaving ? "opacity-60" : ""}`}
                                                    onClick={() => {
                                                        setExpandedId(isExpanded ? null : lead.id);
                                                        setCommentDraft(lead.closerComments || "");
                                                    }}
                                                >
                                                    <td className="px-3 py-2 text-small text-text-muted font-mono">
                                                        {formatDate(lead.createdAt)}
                                                    </td>
                                                    <td className="px-3 py-2 text-small text-text-primary font-medium">
                                                        {lead.name}
                                                    </td>
                                                    <td className="px-3 py-2 text-small text-text-muted font-mono">
                                                        {lead.phone || "—"}
                                                    </td>
                                                    {isFullFunnel && (
                                                        <td className="px-3 py-2 text-small text-text-muted">
                                                            {lead.scheduledDate ? formatDate(lead.scheduledDate) : "—"}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 text-small text-text-muted">
                                                        <select
                                                            value={lead.closerAssigned || ""}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                updateLead(lead.id, { closerAssigned: e.target.value });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="bg-transparent border-none text-small text-text-primary focus:outline-none cursor-pointer p-0"
                                                        >
                                                            <option value="" className="bg-special text-text-primary">—</option>
                                                            {closers.map((c) => (
                                                                <option key={c} value={c} className="bg-special text-text-primary">{c}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <select
                                                            value={lead.qualification}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                updateLead(lead.id, { qualification: e.target.value });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`bg-transparent border-none text-small font-bold focus:outline-none cursor-pointer p-0 ${QUALIFICATION_OPTIONS.find((q) => q.value === lead.qualification)?.color || ""}`}
                                                        >
                                                            {QUALIFICATION_OPTIONS.map((q) => (
                                                                <option key={q.value} value={q.value} className="bg-special text-text-primary">{q.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <select
                                                            value={lead.qualityScore ?? ""}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                                updateLead(lead.id, { qualityScore: val });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="bg-special border-none text-small text-text-primary font-mono font-bold focus:outline-none cursor-pointer p-0 text-center w-8"
                                                        >
                                                            {QUALITY_OPTIONS.map((q) => (
                                                                <option key={String(q.value)} value={q.value ?? ""} className="bg-special text-text-primary">{q.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    {isFullFunnel && (
                                                        <td className="px-3 py-2 text-center">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const next = lead.attendance === true ? false : lead.attendance === false ? null : true;
                                                                    updateLead(lead.id, { attendance: next });
                                                                }}
                                                                className={`w-6 h-6 rounded text-[10px] font-bold ${lead.attendance === true
                                                                    ? "bg-synced/20 text-synced"
                                                                    : lead.attendance === false
                                                                        ? "bg-[#ef4444]/20 text-[#ef4444]"
                                                                        : "bg-argent/30 text-text-muted"
                                                                    }`}
                                                            >
                                                                {lead.attendance === true ? "S" : lead.attendance === false ? "N" : "?"}
                                                            </button>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2">
                                                        <select
                                                            value={lead.postCallStatus}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                updateLead(lead.id, { postCallStatus: e.target.value });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`border-none text-[10px] font-bold rounded px-1.5 py-0.5 focus:outline-none cursor-pointer ${POST_CALL_OPTIONS.find((p) => p.value === lead.postCallStatus)?.color || "bg-special"}`}
                                                        >
                                                            {POST_CALL_OPTIONS.map((p) => (
                                                                <option key={p.value} value={p.value} className="bg-special text-text-primary">{p.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <input
                                                            type="number"
                                                            value={lead.revenue || ""}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                updateLead(lead.id, { revenue: parseFloat(e.target.value) || 0 });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            placeholder="$0"
                                                            className="w-20 bg-special/50 border border-argent/30 rounded px-1.5 py-0.5 text-small text-text-primary font-mono text-right focus:outline-none focus:border-classic/50"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-[10px] text-text-muted truncate max-w-[120px]" title={lead.utm?.campaign || ""}>
                                                        {lead.utm?.campaign
                                                            ? lead.utm.campaign.length > 20
                                                                ? lead.utm.campaign.slice(0, 20) + "..."
                                                                : lead.utm.campaign
                                                            : "—"}
                                                    </td>
                                                </tr>
                                                {/* Expanded row — comments */}
                                                {isExpanded && (
                                                    <tr className={`${rowColor}`}>
                                                        <td colSpan={11} className="px-3 py-3 border-b border-argent">
                                                            <div className="flex items-start gap-3">
                                                                <div className="flex-1">
                                                                    <label className="text-[9px] text-text-muted uppercase tracking-widest font-bold mb-1 block">
                                                                        Comentarios del closer
                                                                    </label>
                                                                    <textarea
                                                                        value={commentDraft}
                                                                        onChange={(e) => setCommentDraft(e.target.value)}
                                                                        rows={2}
                                                                        className="w-full text-small bg-stellar border border-argent rounded px-3 py-2 focus:border-classic outline-none resize-none"
                                                                        placeholder="Notas sobre la llamada..."
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        updateLead(lead.id, { closerComments: commentDraft });
                                                                        setExpandedId(null);
                                                                    }}
                                                                    className="mt-4 px-3 py-1.5 bg-classic text-white text-[10px] font-bold rounded hover:bg-classic/80"
                                                                >
                                                                    Guardar
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center py-4">
                    <p className="text-tiny text-text-muted">
                        Worker Brain &middot; {total} leads en período
                    </p>
                </div>
            </div>
        </div>
    );
}
