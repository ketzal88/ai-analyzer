"use client";

import React, { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { useAuth } from "@/contexts/AuthContext";
import { Lead, LeadQualification as LeadQualificationType, LeadPostCallStatus, LeadQualityScore } from "@/types/leads";
import { Client } from "@/types";

const QUALIFICATION_OPTIONS: { value: LeadQualificationType; label: string; color: string }[] = [
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

export default function LeadQualificationPage() {
    const { selectedClientId: clientId, activeClients } = useClient();
    const { user, isAdmin } = useAuth();

    const [leads, setLeads] = useState<Lead[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);

    // Filters
    const [filterCloser, setFilterCloser] = useState<string>("");
    const [filterQualification, setFilterQualification] = useState<string>("");
    const [filterPostCall, setFilterPostCall] = useState<string>("");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
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

    // Show new lead form
    const [showNewLead, setShowNewLead] = useState(false);
    const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", closerAssigned: "" });

    const client = activeClients.find((c: Client) => c.id === clientId);
    const closers = client?.leadsConfig?.closers || [];
    const isFullFunnel = client?.leadsConfig?.mode !== "whatsapp_simple";

    const fetchLeads = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                clientId,
                startDate: dateRange.start,
                endDate: dateRange.end,
            });
            if (filterCloser) params.set("closer", filterCloser);
            if (filterQualification) params.set("qualification", filterQualification);
            if (filterPostCall) params.set("postCallStatus", filterPostCall);

            const res = await fetch(`/api/leads?${params}`);
            const data = await res.json();
            setLeads(data.leads || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error("Error fetching leads:", err);
        } finally {
            setLoading(false);
        }
    }, [clientId, dateRange, filterCloser, filterQualification, filterPostCall]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    const updateLead = async (leadId: string, updates: Record<string, unknown>) => {
        setSaving(leadId);
        try {
            await fetch(`/api/leads/${leadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            // Update local state
            setLeads((prev) =>
                prev.map((l) => (l.id === leadId ? { ...l, ...updates, updatedAt: new Date().toISOString() } as Lead : l))
            );
        } catch (err) {
            console.error("Error updating lead:", err);
        } finally {
            setSaving(null);
        }
    };

    const createLead = async () => {
        if (!clientId || !newLead.name) return;
        try {
            const res = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    ...newLead,
                    source: "manual",
                }),
            });
            if (res.ok) {
                setShowNewLead(false);
                setNewLead({ name: "", phone: "", email: "", closerAssigned: "" });
                fetchLeads();
            }
        } catch (err) {
            console.error("Error creating lead:", err);
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

    if (!clientId) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-[60vh]">
                    <p className="text-text-muted">Seleccioná un cliente para ver los leads.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-header text-text-primary">Leads CRM</h1>
                        <p className="text-small text-text-muted mt-1">
                            Calificación y seguimiento de leads &middot; {total} leads en período
                        </p>
                    </div>
                    <button
                        onClick={() => setShowNewLead(!showNewLead)}
                        className="px-4 py-2 bg-classic text-white text-small font-bold rounded hover:bg-classic/80 transition-colors"
                    >
                        + Nuevo Lead
                    </button>
                </div>

                {/* New Lead Form */}
                {showNewLead && (
                    <div className="p-4 bg-special border border-argent rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
                        <h3 className="text-small font-bold text-text-primary">Crear Lead Manual</h3>
                        <div className="grid grid-cols-4 gap-3">
                            <input
                                type="text"
                                placeholder="Nombre *"
                                value={newLead.name}
                                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                                className="text-small bg-stellar border border-argent rounded px-3 py-2 focus:border-classic outline-none"
                            />
                            <input
                                type="text"
                                placeholder="Teléfono"
                                value={newLead.phone}
                                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                                className="text-small bg-stellar border border-argent rounded px-3 py-2 focus:border-classic outline-none"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={newLead.email}
                                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                                className="text-small bg-stellar border border-argent rounded px-3 py-2 focus:border-classic outline-none"
                            />
                            <select
                                value={newLead.closerAssigned}
                                onChange={(e) => setNewLead({ ...newLead, closerAssigned: e.target.value })}
                                className="text-small bg-stellar border border-argent rounded px-3 py-2 focus:border-classic outline-none"
                            >
                                <option value="">Closer...</option>
                                {closers.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={createLead}
                                disabled={!newLead.name}
                                className="px-4 py-1.5 bg-classic text-white text-small font-bold rounded disabled:opacity-50"
                            >
                                Crear
                            </button>
                            <button
                                onClick={() => setShowNewLead(false)}
                                className="px-4 py-1.5 text-text-muted text-small hover:text-text-primary"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Stats Bar */}
                <div className="grid grid-cols-5 gap-4">
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
                                    <th className="text-left px-3 py-2 text-[9px] text-text-muted uppercase tracking-widest font-bold">Estado</th>
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
                                                            <option value="">—</option>
                                                            {closers.map((c) => (
                                                                <option key={c} value={c}>{c}</option>
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
                                                            className={`bg-transparent border-none text-small font-bold focus:outline-none cursor-pointer p-0 ${
                                                                QUALIFICATION_OPTIONS.find((q) => q.value === lead.qualification)?.color || ""
                                                            }`}
                                                        >
                                                            {QUALIFICATION_OPTIONS.map((q) => (
                                                                <option key={q.value} value={q.value}>{q.label}</option>
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
                                                            className="bg-transparent border-none text-small text-text-primary font-mono font-bold focus:outline-none cursor-pointer p-0 text-center w-8"
                                                        >
                                                            {QUALITY_OPTIONS.map((q) => (
                                                                <option key={String(q.value)} value={q.value ?? ""}>{q.label}</option>
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
                                                                className={`w-6 h-6 rounded text-[10px] font-bold ${
                                                                    lead.attendance === true
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
                                                            className={`border-none text-[10px] font-bold rounded px-1.5 py-0.5 focus:outline-none cursor-pointer ${
                                                                POST_CALL_OPTIONS.find((p) => p.value === lead.postCallStatus)?.color || "bg-special"
                                                            }`}
                                                        >
                                                            {POST_CALL_OPTIONS.map((p) => (
                                                                <option key={p.value} value={p.value}>{p.label}</option>
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
                                                            className="w-20 bg-transparent border-none text-small text-text-primary font-mono text-right focus:outline-none p-0"
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
                                                            {lead.utm && (lead.utm.source || lead.utm.campaign) && (
                                                                <div className="mt-2 flex gap-2 flex-wrap">
                                                                    {lead.utm.source && (
                                                                        <span className="text-[9px] bg-classic/10 text-classic px-2 py-0.5 rounded font-mono">
                                                                            source: {lead.utm.source}
                                                                        </span>
                                                                    )}
                                                                    {lead.utm.campaign && (
                                                                        <span className="text-[9px] bg-classic/10 text-classic px-2 py-0.5 rounded font-mono">
                                                                            campaign: {lead.utm.campaign}
                                                                        </span>
                                                                    )}
                                                                    {lead.utm.content && (
                                                                        <span className="text-[9px] bg-classic/10 text-classic px-2 py-0.5 rounded font-mono">
                                                                            content: {lead.utm.content}
                                                                        </span>
                                                                    )}
                                                                    {lead.utm.medium && (
                                                                        <span className="text-[9px] bg-classic/10 text-classic px-2 py-0.5 rounded font-mono">
                                                                            medium: {lead.utm.medium}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
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
            </div>
        </AppLayout>
    );
}
