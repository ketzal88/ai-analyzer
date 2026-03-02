"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { Client } from "@/types";
import { EngineConfig, getDefaultEngineConfig } from "@/types/engine-config";

export default function AdminAlertsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [config, setConfig] = useState<EngineConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [globalAlertsEnabled, setGlobalAlertsEnabled] = useState<boolean>(true);
    const [globalEnabledTypes, setGlobalEnabledTypes] = useState<string[]>([]);
    const [isUpdatingGlobal, setIsUpdatingGlobal] = useState(false);

    // Load clients
    useEffect(() => {
        const fetchClients = async () => {
            try {
                const res = await fetch("/api/clients");
                if (!res.ok) throw new Error("Failed to load clients");
                const data = await res.json();
                const activeClients = data.filter((c: Client) => c.active);
                setClients(activeClients);
                if (activeClients.length > 0) {
                    setSelectedClientId(activeClients[0].id);
                }
            } catch (err: any) {
                setMessage({ type: 'error', text: err.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchClients();

        // Load global settings
        fetch("/api/admin/system-settings")
            .then(res => res.json())
            .then(data => {
                setGlobalAlertsEnabled(data.alertsEnabled);
                setGlobalEnabledTypes(data.enabledAlertTypes || []);
            })
            .catch(err => console.error("Failed to load global settings:", err));
    }, []);

    // Load config when client changes
    useEffect(() => {
        if (!selectedClientId) return;

        const fetchConfig = async () => {
            try {
                const res = await fetch(`/api/clients/${selectedClientId}/engine-config`);
                if (!res.ok) throw new Error("Failed to load config");
                const data = await res.json();

                // Ensure enabledAlerts exists
                if (!data.enabledAlerts) {
                    data.enabledAlerts = getDefaultEngineConfig(selectedClientId).enabledAlerts;
                }
                setConfig(data);
            } catch (err: any) {
                console.error("Error loading config:", err);
                setConfig(getDefaultEngineConfig(selectedClientId));
            }
        };
        fetchConfig();
    }, [selectedClientId]);

    const handleToggleAlert = (alertId: string) => {
        if (!config) return;
        const current = config.enabledAlerts || [];
        const next = current.includes(alertId)
            ? current.filter(id => id !== alertId)
            : [...current, alertId];

        setConfig({ ...config, enabledAlerts: next });
    };

    const handleSave = async () => {
        if (!config || !selectedClientId) return;
        setIsSaving(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/clients/${selectedClientId}/engine-config`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });

            if (!res.ok) throw new Error("Failed to save configuration");

            setMessage({ type: 'success', text: "Configuración de alertas guardada correctamente." });
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleGlobal = async () => {
        setIsUpdatingGlobal(true);
        const newValue = !globalAlertsEnabled;
        try {
            const res = await fetch("/api/admin/system-settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertsEnabled: newValue })
            });

            if (!res.ok) throw new Error("Failed to update global settings");

            setGlobalAlertsEnabled(newValue);
            setMessage({
                type: 'success',
                text: `Alertas globales ${newValue ? 'activadas' : 'desactivadas'} correctamente.`
            });
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsUpdatingGlobal(false);
        }
    };

    const handleToggleGlobalType = async (type: string) => {
        setIsUpdatingGlobal(true);
        const next = globalEnabledTypes.includes(type)
            ? globalEnabledTypes.filter(t => t !== type)
            : [...globalEnabledTypes, type];

        try {
            const res = await fetch("/api/admin/system-settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabledAlertTypes: next })
            });

            if (!res.ok) throw new Error("Failed to update global alert types");

            setGlobalEnabledTypes(next);
            setMessage({ type: 'success', text: `Preferencia global de "${type}" actualizada.` });
            setTimeout(() => setMessage(null), 2000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsUpdatingGlobal(false);
        }
    };

    if (isLoading) return <AppLayout><div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin"></div></div></AppLayout>;

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-argent pb-6">
                    <div>
                        <h1 className="text-hero text-text-primary mb-1">Configuración de Alertas</h1>
                        <p className="text-body text-text-secondary">Gestiona qué alertas están activas y personaliza sus mensajes de Slack.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-special p-3 rounded-lg border border-argent shadow-sm">
                        <span className="text-tiny font-bold text-text-muted uppercase">Cliente:</span>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic font-bold min-w-[200px]"
                        >
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Master Switch Banner */}
                <div className={`p-6 border rounded-2xl transition-all duration-500 shadow-md flex items-center justify-between ${globalAlertsEnabled
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                    }`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${globalAlertsEnabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                            : 'bg-red-500/10 border-red-500/30 text-red-500'
                            }`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {globalAlertsEnabled ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 18.36A9 9 0 015.64 5.64m12.72 12.72L5.64 5.64" />
                                )}
                            </svg>
                        </div>
                        <div>
                            <h2 className={`text-small font-black uppercase tracking-widest ${globalAlertsEnabled ? 'text-emerald-500' : 'text-red-500'}`}>
                                Master Switch: Alertas {globalAlertsEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
                            </h2>
                            <p className="text-tiny text-text-secondary mt-1 max-w-lg">
                                Este interruptor afecta a todas las alertas de Slack y reportes diarios para todos los clientes de la agencia.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className={`text-[10px] font-black uppercase tracking-tighter ${globalAlertsEnabled ? 'text-emerald-500' : 'text-red-500'}`}>
                                {globalAlertsEnabled ? 'SISTEMA ONLINE' : 'SISTEMA PAUSADO'}
                            </span>
                        </div>
                        <button
                            onClick={handleToggleGlobal}
                            disabled={isUpdatingGlobal}
                            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${globalAlertsEnabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-argent'
                                }`}
                        >
                            <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${globalAlertsEnabled ? 'translate-x-6' : 'translate-x-0'
                                }`}>
                                {isUpdatingGlobal && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-4 h-4 border-2 border-argent border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Per-Alert Global Switches (Nested inside a card) */}
                <div className="p-6 bg-stellar border border-argent rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-tiny font-black text-text-muted uppercase tracking-widest">Controles por Tipo de Alerta (Global)</h3>
                            <p className="text-[10px] text-text-muted italic">Apaga un tipo de alerta aquí y se desactivará para TODOS tus clientes automáticamente.</p>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {globalEnabledTypes.length > 0 ? ([
                            "SCALING_OPPORTUNITY", "LEARNING_RESET_RISK", "CPA_SPIKE",
                            "BUDGET_BLEED", "CPA_VOLATILITY", "ROTATE_CONCEPT",
                            "CONSOLIDATE", "KILL_RETRY", "INTRODUCE_BOFU_VARIANTS"
                        ]).map(type => {
                            const isGloballyOn = globalEnabledTypes.includes(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => handleToggleGlobalType(type)}
                                    disabled={isUpdatingGlobal}
                                    className={`px-3 py-2 rounded-lg border text-[10px] font-bold text-center transition-all ${isGloballyOn
                                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
                                        : 'bg-red-500/5 border-red-500/20 text-red-500 opacity-50'
                                        }`}
                                >
                                    {type.replace(/_/g, ' ')}
                                </button>
                            );
                        }) : (
                            <div className="col-span-full py-4 text-center text-tiny text-text-muted">Cargando tipos de alerta...</div>
                        )}
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {message.type === 'success' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                        </svg>
                        <span className="text-small font-medium">{message.text}</span>
                    </div>
                )}

                {config ? (
                    <div className="space-y-10">
                        {/* Templates & Switches Section Unified */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-subheader text-text-primary">Interruptores y Mensajes de Slack</h2>
                                <div className="text-[10px] text-text-muted font-bold bg-special border border-argent px-2 py-1 rounded">VARS: {"{entityName}, {spend_7d}, {cpa_7d}, {targetCpa}, {frequency_7d}, {budget_change_3d_pct}, {cpa_delta_pct}"}</div>
                            </div>

                            {/* Daily Digest Title Card */}
                            <div className="p-6 bg-special/40 border border-argent rounded-xl shadow-inner">
                                <label className="block text-tiny font-bold text-text-muted uppercase mb-2 tracking-widest">Reporte Diario (MTD Snapshot)</label>
                                <div className="flex gap-4 items-center">
                                    <input
                                        type="text"
                                        value={config.dailySnapshotTitle}
                                        onChange={(e) => setConfig({ ...config, dailySnapshotTitle: e.target.value })}
                                        className="flex-1 bg-stellar border border-argent p-3 text-small rounded-lg outline-none focus:border-classic font-bold"
                                        placeholder="Reporte Acumulado Mes — {clientName}"
                                    />
                                </div>
                                <p className="mt-2 text-tiny text-text-muted italic">Variables: {"{clientName}, {startDate}, {endDate}"}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {Object.entries(config.alertTemplates).map(([type, template]) => {
                                    const isEnabled = (config.enabledAlerts || []).includes(type);
                                    return (
                                        <div key={type} className={`p-6 bg-stellar border rounded-2xl transition-all duration-300 shadow-sm ${!isEnabled
                                            ? 'border-argent/30 bg-stellar/20 grayscale-[0.5] opacity-60'
                                            : 'border-argent hover:border-classic/40 shadow-classic/5'
                                            }`}>
                                            <div className="flex items-center justify-between mb-5 pb-4 border-b border-argent/50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-argent'}`} />
                                                    <span className={`text-tiny font-black uppercase tracking-widest ${isEnabled ? 'text-text-primary' : 'text-text-muted'}`}>
                                                        {type.replace(/_/g, ' ')}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <span className={`text-[10px] font-bold ${isEnabled ? 'text-emerald-500' : 'text-text-muted'}`}>
                                                        {isEnabled ? 'ACTIVA' : 'DESACTIVADA'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleToggleAlert(type)}
                                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEnabled ? 'bg-classic shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-argent/40'
                                                            }`}
                                                    >
                                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'
                                                            }`} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-300 ${isEnabled ? 'opacity-100' : 'opacity-40'}`}>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-tighter">Título Slack</label>
                                                    <input
                                                        type="text"
                                                        readOnly={!isEnabled}
                                                        value={template.title}
                                                        onChange={(e) => setConfig({
                                                            ...config,
                                                            alertTemplates: {
                                                                ...config.alertTemplates,
                                                                [type]: { ...template, title: e.target.value }
                                                            }
                                                        })}
                                                        className="w-full bg-stellar/50 border border-argent/80 p-3 text-small rounded-lg outline-none focus:border-classic font-bold disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-tighter">Cuerpo del Mensaje</label>
                                                    <textarea
                                                        rows={2}
                                                        readOnly={!isEnabled}
                                                        value={template.description}
                                                        onChange={(e) => setConfig({
                                                            ...config,
                                                            alertTemplates: {
                                                                ...config.alertTemplates,
                                                                [type]: { ...template, description: e.target.value }
                                                            }
                                                        })}
                                                        className="w-full bg-stellar/50 border border-argent/80 p-3 text-small rounded-lg outline-none focus:border-classic resize-none disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Save Bar */}
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-8 py-3 bg-classic hover:bg-classic-hover text-white rounded-full font-bold shadow-2xl flex items-center gap-2 group transition-all"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>GUARDAR CAMBIOS</span>
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="card text-center p-20">
                        <p className="text-text-muted">Selecciona un cliente para configurar sus alertas.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
