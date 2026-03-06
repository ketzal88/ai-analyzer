"use client";

import React, { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { QuarterlyObjective, MetricGoal, getCurrentQuarter, SemaforoStatus } from "@/types/semaforo";
import { SemaforoEngine } from "@/lib/semaforo-engine";
import { ChannelType } from "@/lib/channel-brain-interface";
import { Client } from "@/types";

// ── Metric definitions ──────────────────────────────
interface MetricDef {
    key: string;
    label: string;
    channels: string[];     // which integraciones enable this metric
    isInverse?: boolean;
    isCurrency?: boolean;
}

const ALL_METRICS: MetricDef[] = [
    { key: "orders", label: "Órdenes", channels: ["ecommerce"] },
    { key: "revenue", label: "Revenue", channels: ["meta", "google", "ecommerce"], isCurrency: true },
    { key: "spend", label: "Inversión Ads", channels: ["meta", "google"], isCurrency: true },
    { key: "conversions", label: "Conversiones", channels: ["meta", "google"] },
    { key: "cpa", label: "CPA", channels: ["meta", "google"], isInverse: true, isCurrency: true },
    { key: "clicks", label: "Clicks", channels: ["meta", "google"] },
    { key: "impressions", label: "Impresiones", channels: ["meta", "google"] },
    { key: "email_sent", label: "Emails Enviados", channels: ["email"] },
    { key: "email_opens", label: "Aperturas Email", channels: ["email"] },
    { key: "email_clicks", label: "Clicks Email", channels: ["email"] },
    { key: "email_revenue", label: "Revenue Email", channels: ["email"], isCurrency: true },
];

const CHANNEL_KEYS: { key: ChannelType; label: string; integration: string }[] = [
    { key: "META", label: "Meta Ads", integration: "meta" },
    { key: "GOOGLE", label: "Google Ads", integration: "google" },
    { key: "ECOMMERCE", label: "Ecommerce", integration: "ecommerce" },
    { key: "EMAIL", label: "Email", integration: "email" },
];

// ── Helpers ──────────────────────────────────────────
function getStatusColor(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'text-emerald-500';
        case 'yellow': return 'text-yellow-500';
        case 'red': return 'text-red-500';
    }
}

function getStatusBg(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'bg-emerald-500';
        case 'yellow': return 'bg-yellow-500';
        case 'red': return 'bg-red-500';
    }
}

function getStatusLabel(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'EN RITMO';
        case 'yellow': return 'ATENCIÓN';
        case 'red': return 'EN RIESGO';
    }
}

function formatNum(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ── Quarter Options (Cuatrimestres: 3 quarters × 4 months) ──
function getQuarterOptions(): { value: string; label: string; year: number; num: 1|2|3; startDate: string; endDate: string }[] {
    const now = new Date();
    const year = now.getFullYear();
    const options: { value: string; label: string; year: number; num: 1|2|3; startDate: string; endDate: string }[] = [];

    for (let y = year; y >= year - 1; y--) {
        for (let q = 3; q >= 1; q--) {
            // Q1=Ene-Abr, Q2=May-Ago, Q3=Sep-Dic
            const startMonth = (q - 1) * 4;       // 0, 4, 8 (0-indexed)
            const endMonth = startMonth + 3;       // 3, 7, 11 (0-indexed)
            const lastDay = new Date(y, endMonth + 1, 0).getDate();
            options.push({
                value: `Q${q}_${y}`,
                label: `Q${q} ${y}`,
                year: y,
                num: q as 1|2|3,
                startDate: `${y}-${String(startMonth + 1).padStart(2, '0')}-01`,
                endDate: `${y}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
            });
        }
    }
    return options;
}

// ── Formatted Input ─────────────────────────────────
function FormattedInput({ value, onChange, disabled, placeholder, isCurrency }: {
    value: number | undefined;
    onChange: (v: number) => void;
    disabled?: boolean;
    placeholder?: string;
    isCurrency?: boolean;
}) {
    const [isFocused, setIsFocused] = useState(false);
    const [raw, setRaw] = useState('');

    const formatted = value != null && value !== 0
        ? (isCurrency ? '$' : '') + value.toLocaleString('es-AR', { maximumFractionDigits: 0 })
        : '';

    return (
        <input
            type={isFocused ? 'number' : 'text'}
            value={isFocused ? raw : formatted}
            onFocus={() => {
                setIsFocused(true);
                setRaw(value != null && value !== 0 ? String(value) : '');
            }}
            onBlur={() => {
                setIsFocused(false);
                onChange(parseFloat(raw) || 0);
            }}
            onChange={(e) => setRaw(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-stellar border border-argent text-text-primary p-1.5 text-[12px] font-mono disabled:opacity-30"
        />
    );
}

// ── Component ───────────────────────────────────────
export default function ObjectivesEditor() {
    const { selectedClientId: globalClientId, activeClients, setSelectedClientId } = useClient();
    const [localClientId, setLocalClientId] = useState<string>("");

    // Sync from global on mount
    useEffect(() => {
        if (globalClientId && !localClientId) setLocalClientId(globalClientId);
    }, [globalClientId]);

    const clientId = localClientId || globalClientId;
    const currentClient = activeClients.find((c: Client) => c.id === clientId);
    const integraciones = currentClient?.integraciones;

    // When user picks a client in this page, also update global context
    function handleClientChange(newClientId: string) {
        setLocalClientId(newClientId);
        setSelectedClientId(newClientId);
    }

    const [objectives, setObjectives] = useState<(QuarterlyObjective & { id?: string })[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAutoSuggesting, setIsAutoSuggesting] = useState(false);
    const [showChannelGoals, setShowChannelGoals] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [quarter, setQuarter] = useState("");
    const [pacingMode, setPacingMode] = useState<'linear' | 'accelerating'>('linear');
    const [goals, setGoals] = useState<Record<string, MetricGoal>>({});
    const [channelGoals, setChannelGoals] = useState<Partial<Record<ChannelType, Record<string, { target: number }>>>>({});

    // Preview state
    const [previewActuals, setPreviewActuals] = useState<Record<string, number> | null>(null);

    const quarterOptions = getQuarterOptions();
    const currentQ = getCurrentQuarter();

    // Filter metrics based on client integrations
    const availableMetrics = ALL_METRICS.filter(m => {
        if (!integraciones) return false;
        return m.channels.some(ch => {
            if (ch === 'meta') return integraciones.meta;
            if (ch === 'google') return integraciones.google;
            if (ch === 'ecommerce') return !!integraciones.ecommerce;
            if (ch === 'email') return !!integraciones.email;
            return false;
        });
    });

    const availableChannels = CHANNEL_KEYS.filter(ch => {
        if (!integraciones) return false;
        if (ch.integration === 'meta') return integraciones.meta;
        if (ch.integration === 'google') return integraciones.google;
        if (ch.integration === 'ecommerce') return !!integraciones.ecommerce;
        if (ch.integration === 'email') return !!integraciones.email;
        return false;
    });

    // Load objectives
    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        fetch(`/api/objectives?clientId=${clientId}`)
            .then(res => res.json())
            .then(data => {
                setObjectives(data.objectives || []);
                if (data.objectives?.length > 0) {
                    selectObjective(data.objectives[0]);
                } else {
                    resetForm();
                }
            })
            .catch(() => setObjectives([]))
            .finally(() => setIsLoading(false));
    }, [clientId]);

    function selectObjective(obj: QuarterlyObjective & { id?: string }) {
        setSelectedId(obj.id || null);
        setQuarter(obj.quarter);
        setPacingMode(obj.weeklyPacing?.mode === 'accelerating' ? 'accelerating' : 'linear');
        setGoals(obj.goals || {});
        setChannelGoals(obj.channelGoals || {});
        setShowChannelGoals(Object.keys(obj.channelGoals || {}).length > 0);
        setPreviewActuals(null);
        setMessage(null);
    }

    function resetForm() {
        setSelectedId(null);
        setQuarter(currentQ.quarter);
        setPacingMode('linear');
        setGoals({});
        setChannelGoals({});
        setShowChannelGoals(false);
        setPreviewActuals(null);
        setMessage(null);
    }

    function handleNewQuarter() {
        resetForm();
    }

    // Auto-suggest baselines from data
    async function handleAutoSuggest() {
        if (!clientId || !quarter) return;
        setIsAutoSuggesting(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/objectives/suggest?clientId=${clientId}&quarter=${quarter}`);
            const data = await res.json();

            if (data.error) {
                setMessage({ type: 'error', text: data.error });
                return;
            }

            const newGoals: Record<string, MetricGoal> = {};
            for (const m of availableMetrics) {
                const suggestion = data.suggestions?.[m.key];
                if (suggestion) {
                    newGoals[m.key] = {
                        baseline: suggestion.baseline,
                        target: suggestion.suggestedTarget,
                        isInverse: suggestion.isInverse || m.isInverse || false,
                    };
                }
            }
            setGoals(newGoals);

            // Also populate channel goals if available
            if (data.channelSuggestions) {
                const newChannelGoals: Partial<Record<ChannelType, Record<string, { target: number }>>> = {};
                for (const [ch, metrics] of Object.entries(data.channelSuggestions) as [ChannelType, Record<string, { suggestedTarget: number }>][]) {
                    newChannelGoals[ch] = {};
                    for (const [metric, vals] of Object.entries(metrics)) {
                        newChannelGoals[ch]![metric] = { target: vals.suggestedTarget };
                    }
                }
                setChannelGoals(newChannelGoals);
            }

            setMessage({ type: 'success', text: `Ritmo diario de ${data.daysWithData} días × ${data.quarterDays} días del Q = baseline. Target = +15%.` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsAutoSuggesting(false);
        }
    }

    // Save objective
    async function handleSave() {
        if (!clientId || !quarter || Object.keys(goals).length === 0) return;
        setIsSaving(true);
        setMessage(null);

        const qOption = quarterOptions.find(q => q.value === quarter);
        if (!qOption) return;

        const payload = {
            clientId,
            quarter,
            year: qOption.year,
            quarterNumber: qOption.num,
            startDate: qOption.startDate,
            endDate: qOption.endDate,
            goals,
            channelGoals: showChannelGoals && Object.keys(channelGoals).length > 0 ? channelGoals : undefined,
            weeklyPacing: { mode: pacingMode },
        };

        try {
            let res: Response;
            if (selectedId) {
                res = await fetch(`/api/objectives/${selectedId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                res = await fetch(`/api/objectives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            const data = await res.json();
            if (data.error) {
                setMessage({ type: 'error', text: data.error });
            } else {
                setMessage({ type: 'success', text: selectedId ? 'Objetivo actualizado' : 'Objetivo creado' });
                // Reload objectives
                const reloadRes = await fetch(`/api/objectives?clientId=${clientId}`);
                const reloadData = await reloadRes.json();
                setObjectives(reloadData.objectives || []);
                if (data.id) setSelectedId(data.id);
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSaving(false);
        }
    }

    // Load actuals for preview
    async function loadPreviewActuals() {
        if (!clientId || !quarter) return;
        const qOption = quarterOptions.find(q => q.value === quarter);
        if (!qOption) return;

        try {
            const today = new Date().toISOString().split("T")[0];
            const endDate = today < qOption.endDate ? today : qOption.endDate;
            const res = await fetch(`/api/channel-snapshots?clientId=${clientId}&startDate=${qOption.startDate}&endDate=${endDate}`);
            const data = await res.json();

            const actuals: Record<string, number> = {};
            const snapshots = data.snapshots || [];
            // Check if ecommerce data exists — if so, ecommerce is source of truth for revenue
            const hasEcommerce = snapshots.some((s: any) => s.channel === 'ECOMMERCE');

            for (const snap of snapshots) {
                const ch = snap.channel as ChannelType;
                const m = snap.metrics || {};
                if (ch === 'META' || ch === 'GOOGLE') {
                    if (m.spend) actuals['spend'] = (actuals['spend'] || 0) + m.spend;
                    // Only use ads revenue if no ecommerce (ecommerce = real total)
                    if (m.revenue && !hasEcommerce) actuals['revenue'] = (actuals['revenue'] || 0) + m.revenue;
                    if (m.conversions) actuals['conversions'] = (actuals['conversions'] || 0) + m.conversions;
                    if (m.clicks) actuals['clicks'] = (actuals['clicks'] || 0) + m.clicks;
                    if (m.impressions) actuals['impressions'] = (actuals['impressions'] || 0) + m.impressions;
                } else if (ch === 'ECOMMERCE') {
                    if (m.orders) actuals['orders'] = (actuals['orders'] || 0) + m.orders;
                    if (m.revenue) actuals['revenue'] = (actuals['revenue'] || 0) + m.revenue;
                } else if (ch === 'EMAIL') {
                    if (m.sent) actuals['email_sent'] = (actuals['email_sent'] || 0) + m.sent;
                    if (m.opens) actuals['email_opens'] = (actuals['email_opens'] || 0) + m.opens;
                    if (m.emailClicks) actuals['email_clicks'] = (actuals['email_clicks'] || 0) + m.emailClicks;
                    if (m.emailRevenue) actuals['email_revenue'] = (actuals['email_revenue'] || 0) + m.emailRevenue;
                }
            }

            // Compute CPA
            if (actuals['spend'] && actuals['conversions']) {
                actuals['cpa'] = actuals['conversions'] > 0 ? actuals['spend'] / actuals['conversions'] : 0;
            }

            setPreviewActuals(actuals);
        } catch {
            setPreviewActuals(null);
        }
    }

    // Compute preview semáforo
    const previewSnapshot = React.useMemo(() => {
        if (!previewActuals || Object.keys(goals).length === 0 || !quarter) return null;

        const qOption = quarterOptions.find(q => q.value === quarter);
        if (!qOption) return null;

        try {
            return SemaforoEngine.evaluate({
                clientId: clientId || '',
                objective: {
                    clientId: clientId || '',
                    quarter,
                    year: qOption.year,
                    quarterNumber: qOption.num,
                    startDate: qOption.startDate,
                    endDate: qOption.endDate,
                    goals,
                    channelGoals: showChannelGoals ? channelGoals : undefined,
                    weeklyPacing: { mode: pacingMode },
                    createdAt: '',
                    updatedAt: '',
                },
                currentDate: new Date().toISOString().split("T")[0],
                actuals: previewActuals,
                channelActuals: {},
            });
        } catch {
            return null;
        }
    }, [previewActuals, goals, quarter, clientId, pacingMode, channelGoals, showChannelGoals]);

    // Update a goal field
    function updateGoal(key: string, field: 'target' | 'baseline', value: number) {
        setGoals(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
    }

    // Update a channel goal
    function updateChannelGoal(channel: ChannelType, metric: string, target: number) {
        setChannelGoals(prev => ({
            ...prev,
            [channel]: { ...(prev[channel] || {}), [metric]: { target } },
        }));
    }

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
                <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Objetivos
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Metas Trimestrales y Pacing
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                            Cliente
                        </label>
                        <select
                            value={clientId || ""}
                            onChange={(e) => handleClientChange(e.target.value)}
                            className="bg-stellar border border-argent text-text-primary px-3 py-2 text-[12px] font-bold min-w-[200px]"
                        >
                            {activeClients.map((c: Client) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </header>

                {/* How it works */}
                <div className="bg-special border border-argent/40 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 text-[10px] text-text-muted">
                    <div>
                        <span className="font-black text-classic uppercase tracking-widest">Baseline</span>
                        <p className="mt-1 leading-relaxed">Proyeccion del Q basada en el ritmo diario de los ultimos 60 dias. Promedio diario x dias del cuatrimestre.</p>
                    </div>
                    <div>
                        <span className="font-black text-classic uppercase tracking-widest">Target</span>
                        <p className="mt-1 leading-relaxed">Objetivo del cuatrimestre. Auto-sugerir aplica +15% sobre el baseline. Editable manualmente.</p>
                    </div>
                    <div>
                        <span className="font-black text-classic uppercase tracking-widest">Pacing</span>
                        <p className="mt-1 leading-relaxed"><b>Linear:</b> ritmo constante durante el Q. <b>Accelerating:</b> espera mas volumen hacia el final del periodo.</p>
                    </div>
                    <div>
                        <span className="font-black text-classic uppercase tracking-widest">Semaforo</span>
                        <p className="mt-1 leading-relaxed"><span className="text-emerald-500">Verde</span> = en ritmo (&ge;90%). <span className="text-yellow-500">Amarillo</span> = atencion (70-90%). <span className="text-red-500">Rojo</span> = en riesgo (&lt;70%).</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando objetivos...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-6">
                        {/* ── Left Panel: Objectives List ── */}
                        <div className="col-span-3 space-y-3">
                            <button
                                onClick={handleNewQuarter}
                                className="w-full px-4 py-2.5 bg-classic text-white text-[11px] font-black uppercase tracking-widest hover:bg-classic/80 transition-all"
                            >
                                + Nuevo Quarter
                            </button>

                            {objectives.map((obj) => {
                                const isActive = obj.quarter === currentQ.quarter;
                                const isSelected = obj.id === selectedId;
                                return (
                                    <button
                                        key={obj.id || obj.quarter}
                                        onClick={() => selectObjective(obj)}
                                        className={`w-full text-left p-3 border transition-all ${
                                            isSelected
                                                ? 'bg-classic/10 border-classic/40'
                                                : 'bg-special border-argent hover:border-classic/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-text-primary uppercase">
                                                {obj.quarter.replace('_', ' ')}
                                            </span>
                                            {isActive && (
                                                <span className="text-[8px] font-black px-1.5 py-0.5 bg-synced/20 text-synced uppercase">
                                                    Activo
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-text-muted mt-1">
                                            {Object.keys(obj.goals || {}).length} métricas
                                        </p>
                                    </button>
                                );
                            })}

                            {objectives.length === 0 && (
                                <div className="text-center p-6 border border-dashed border-argent">
                                    <p className="text-[10px] text-text-muted">Sin objetivos configurados</p>
                                </div>
                            )}
                        </div>

                        {/* ── Right Panel: Editor ── */}
                        <div className="col-span-9 space-y-6">
                            {/* Quarter Selector + Pacing */}
                            <div className="card p-5">
                                <div className="flex items-end gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            Quarter
                                        </label>
                                        <select
                                            value={quarter}
                                            onChange={(e) => setQuarter(e.target.value)}
                                            className="w-full mt-1 bg-stellar border border-argent text-text-primary p-2 text-[12px] font-mono"
                                        >
                                            {quarterOptions.map(q => (
                                                <option key={q.value} value={q.value}>
                                                    {q.label} ({q.startDate} → {q.endDate})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            Pacing
                                        </label>
                                        <div className="flex gap-1 mt-1">
                                            {(['linear', 'accelerating'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setPacingMode(mode)}
                                                    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                                                        pacingMode === mode
                                                            ? 'bg-classic text-white'
                                                            : 'bg-special text-text-muted hover:text-text-primary border border-argent'
                                                    }`}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAutoSuggest}
                                        disabled={isAutoSuggesting}
                                        className="px-4 py-2 bg-synced/20 text-synced text-[10px] font-black uppercase tracking-widest hover:bg-synced/30 transition-all disabled:opacity-50"
                                    >
                                        {isAutoSuggesting ? 'Calculando...' : 'Auto-sugerir'}
                                    </button>
                                </div>
                            </div>

                            {/* Message */}
                            {message && (
                                <div className={`px-4 py-2 text-[11px] ${
                                    message.type === 'success' ? 'bg-synced/10 text-synced border border-synced/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                    {message.text}
                                </div>
                            )}

                            {/* Metrics Grid */}
                            <div className="card p-5">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Métricas y Targets
                                </h3>

                                {/* Header */}
                                <div className="grid grid-cols-12 gap-3 mb-2 text-[9px] font-black text-text-muted uppercase tracking-widest">
                                    <div className="col-span-3">Métrica</div>
                                    <div className="col-span-3">Baseline</div>
                                    <div className="col-span-3">Target</div>
                                    <div className="col-span-2">Tipo</div>
                                    <div className="col-span-1"></div>
                                </div>

                                {availableMetrics.map(m => {
                                    const goal = goals[m.key];
                                    const hasGoal = !!goal;
                                    return (
                                        <div key={m.key} className={`grid grid-cols-12 gap-3 items-center py-2 border-t border-argent/30 ${hasGoal ? '' : 'opacity-50'}`}>
                                            <div className="col-span-3">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={hasGoal}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setGoals(prev => ({
                                                                    ...prev,
                                                                    [m.key]: { baseline: 0, target: 0, isInverse: m.isInverse || false },
                                                                }));
                                                            } else {
                                                                setGoals(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[m.key];
                                                                    return next;
                                                                });
                                                            }
                                                        }}
                                                        className="accent-classic"
                                                    />
                                                    <span className="text-[11px] font-bold text-text-secondary">{m.label}</span>
                                                </label>
                                            </div>
                                            <div className="col-span-3">
                                                <FormattedInput
                                                    value={goal?.baseline}
                                                    onChange={(v) => updateGoal(m.key, 'baseline', v)}
                                                    disabled={!hasGoal}
                                                    placeholder={m.isCurrency ? "$0" : "0"}
                                                    isCurrency={m.isCurrency}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <FormattedInput
                                                    value={goal?.target}
                                                    onChange={(v) => updateGoal(m.key, 'target', v)}
                                                    disabled={!hasGoal}
                                                    placeholder={m.isCurrency ? "$0" : "0"}
                                                    isCurrency={m.isCurrency}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 ${
                                                    m.isInverse ? 'bg-yellow-500/10 text-yellow-400' : 'bg-classic/10 text-classic'
                                                }`}>
                                                    {m.isInverse ? 'Inversa' : 'Normal'}
                                                </span>
                                            </div>
                                            <div className="col-span-1 text-right">
                                                {hasGoal && goal.target > 0 && goal.baseline > 0 && (
                                                    <span className={`text-[10px] font-mono ${
                                                        m.isInverse
                                                            ? (goal.target < goal.baseline ? 'text-synced' : 'text-red-400')
                                                            : (goal.target > goal.baseline ? 'text-synced' : 'text-red-400')
                                                    }`}>
                                                        {m.isInverse
                                                            ? `${((1 - goal.target / goal.baseline) * 100).toFixed(0)}%↓`
                                                            : `+${((goal.target / goal.baseline - 1) * 100).toFixed(0)}%`
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Channel Goals (Expandable) */}
                            <div className="card p-5">
                                <button
                                    onClick={() => setShowChannelGoals(!showChannelGoals)}
                                    className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest hover:text-text-primary transition-all"
                                >
                                    <span>{showChannelGoals ? '▼' : '▶'}</span>
                                    Sub-Targets por Canal (Opcional)
                                </button>

                                {showChannelGoals && (
                                    <div className="mt-4 space-y-4">
                                        {availableChannels.map(ch => (
                                            <div key={ch.key} className="border border-argent/30 p-4">
                                                <h4 className="text-[10px] font-black text-classic uppercase tracking-widest mb-3">
                                                    {ch.label}
                                                </h4>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                    {availableMetrics
                                                        .filter(m => m.channels.includes(ch.integration) && goals[m.key])
                                                        .map(m => (
                                                            <div key={m.key}>
                                                                <label className="text-[9px] text-text-muted uppercase">{m.label}</label>
                                                                <FormattedInput
                                                                    value={channelGoals[ch.key]?.[m.key]?.target}
                                                                    onChange={(v) => updateChannelGoal(ch.key, m.key, v)}
                                                                    placeholder={m.isCurrency ? "$0" : "0"}
                                                                    isCurrency={m.isCurrency}
                                                                />
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Preview Semáforo */}
                            <div className="card p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                        Preview Semáforo
                                    </h3>
                                    <button
                                        onClick={loadPreviewActuals}
                                        className="px-3 py-1.5 bg-special border border-argent text-text-secondary text-[10px] font-bold uppercase tracking-widest hover:border-classic/30 transition-all"
                                    >
                                        Cargar Actuals
                                    </button>
                                </div>

                                {!previewActuals && (
                                    <p className="text-[10px] text-text-muted text-center py-4">
                                        Click "Cargar Actuals" para ver cómo quedaría el semáforo con estos targets
                                    </p>
                                )}

                                {previewSnapshot && (
                                    <div className="space-y-3">
                                        {/* General */}
                                        <div className="flex items-center gap-3 p-3 bg-stellar border border-argent">
                                            <div className={`w-4 h-4 ${getStatusBg(previewSnapshot.general.status)}`} />
                                            <span className={`text-[11px] font-black uppercase ${getStatusColor(previewSnapshot.general.status)}`}>
                                                {getStatusLabel(previewSnapshot.general.status)}
                                            </span>
                                            <span className="text-[11px] text-text-muted flex-1">{previewSnapshot.general.summary}</span>
                                            <span className={`text-lg font-black font-mono ${getStatusColor(previewSnapshot.general.status)}`}>
                                                {previewSnapshot.general.score}
                                            </span>
                                        </div>

                                        {/* Per metric */}
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                            {Object.values(previewSnapshot.metrics).map(m => (
                                                <div key={m.metric} className="flex items-center gap-2 p-2 bg-stellar border border-argent">
                                                    <div className={`w-2 h-2 ${getStatusBg(m.status)}`} />
                                                    <span className="text-[10px] font-bold text-text-secondary flex-1">{m.metric}</span>
                                                    <span className="text-[10px] font-mono text-text-muted">
                                                        {formatNum(m.current)} / {formatNum(m.target)}
                                                    </span>
                                                    <span className={`text-[10px] font-mono font-bold ${getStatusColor(m.status)}`}>
                                                        {m.pctAchieved.toFixed(0)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Save Button */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || Object.keys(goals).length === 0}
                                    className="px-6 py-3 bg-classic text-white text-[11px] font-black uppercase tracking-widest hover:bg-classic/80 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? 'Guardando...' : selectedId ? 'Actualizar Objetivo' : 'Crear Objetivo'}
                                </button>

                                {selectedId && (
                                    <button
                                        onClick={handleNewQuarter}
                                        className="px-6 py-3 bg-special border border-argent text-text-secondary text-[11px] font-black uppercase tracking-widest hover:border-classic/30 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
