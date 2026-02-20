"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { PromptTemplate, Client } from "@/types";
import { EngineConfig } from "@/types/engine-config";
import EngineConfigEditor from "@/components/admin/EngineConfigEditor";
import { PROMPT_KEYS, getDefaultCriticalInstructions, getDefaultOutputSchema } from "@/lib/prompt-utils";

// ─── Creative Classifier Categories (read-only reference) ─────────
const CREATIVE_CATEGORIES = [
    {
        name: "DOMINANT_SCALABLE",
        label: "Dominante Escalable",
        color: "bg-synced/20 text-synced border-synced/30",
        conditions: [
            "BOFU + SCALE o CPA <= target CPA",
            "Spend > 30% del gasto total de la cuenta",
        ],
        meaning: "Creativo ganador con alta concentración de gasto y buen rendimiento. Candidato a escalar presupuesto."
    },
    {
        name: "WINNER_SATURATING",
        label: "Ganador Saturado",
        color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        conditions: [
            "BOFU + fatigue REAL o AUDIENCE_SATURATION",
        ],
        meaning: "Fue ganador pero muestra fatiga real. Necesita rotación de concepto o variantes frescas."
    },
    {
        name: "HIDDEN_BOFU",
        label: "BOFU Oculto",
        color: "bg-classic/20 text-classic border-classic/30",
        conditions: [
            "BOFU + spend < P25 del account",
            "Tiene conversiones (> 0)",
        ],
        meaning: "Creativo BOFU sub-presupuestado. Oportunidad de escala si se le asigna más budget."
    },
    {
        name: "INEFFICIENT_TOFU",
        label: "TOFU Ineficiente",
        color: "bg-red-500/20 text-red-400 border-red-500/30",
        conditions: [
            "TOFU + CPA > target * 1.5",
            "Spend > $100 en 7 días",
        ],
        meaning: "Creativo top-of-funnel que gasta demasiado sin convertir eficientemente. Candidato a pausar o iterar."
    },
    {
        name: "ZOMBIE",
        label: "Zombie",
        color: "bg-red-800/20 text-red-300 border-red-800/30",
        conditions: [
            "Spend > $50 en 7d con 0 conversiones",
            "O spend > $30 sin ninguna señal de conversión",
        ],
        meaning: "Gasto sin retorno. Debe pausarse o reestructurarse completamente."
    },
    {
        name: "NEW_INSUFFICIENT_DATA",
        label: "Nuevo / Datos Insuficientes",
        color: "bg-argent/20 text-text-muted border-argent/30",
        conditions: [
            "Activo hace < 4 días",
            "Menos de 2000 impresiones",
        ],
        meaning: "Creativo recién lanzado sin datos suficientes para clasificar. Se reevalúa automáticamente."
    },
];

type CerebroTab = "generators" | "engine" | "classifier" | "console";

export default function CerebroDeWorker() {
    const [activeTab, setActiveTab] = useState<CerebroTab>("generators");

    // ─── Generators State ─────────────────────────────
    const [selectedKey, setSelectedKey] = useState(PROMPT_KEYS[0].key);
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Form state
    const [newSystem, setNewSystem] = useState("");
    const [newUserTemplate, setNewUserTemplate] = useState("");
    const [newCriticalInstructions, setNewCriticalInstructions] = useState("");
    const [newOutputSchema, setNewOutputSchema] = useState("");

    // ─── Engine Config State ──────────────────────────
    const [engineConfig, setEngineConfig] = useState<EngineConfig | null>(null);
    const [isConfigLoading, setIsConfigLoading] = useState(false);

    // ─── Console State ────────────────────────────────
    const [testResult, setTestResult] = useState<any>(null);
    const [testPromptKey, setTestPromptKey] = useState(PROMPT_KEYS[0].key);

    // ─── Data Fetching ────────────────────────────────
    useEffect(() => {
        if (activeTab === "generators") fetchPromptData();
        if (activeTab === "console") fetchClients();
    }, [activeTab, selectedKey]);

    useEffect(() => {
        if (activeTab === "engine" && selectedClientId) fetchEngineConfig(selectedClientId);
    }, [activeTab, selectedClientId]);

    const fetchClients = async () => {
        try {
            const res = await fetch("/api/clients");
            const data = await res.json();
            if (Array.isArray(data)) setClients(data);
        } catch (e) { console.error("Error fetching clients:", e); }
    };

    const fetchPromptData = async () => {
        setIsLoading(true);
        try {
            const [pRes, cRes] = await Promise.all([
                fetch(`/api/admin/prompts?key=${selectedKey}`),
                fetch("/api/clients")
            ]);
            const pData = await pRes.json();
            const cData = await cRes.json();

            if (Array.isArray(pData)) {
                setPrompts(pData);
                if (pData.length > 0) {
                    const active = pData.find((p: PromptTemplate) => p.status === "active") || pData[0];
                    selectPrompt(active);
                } else {
                    setSelectedPrompt(null);
                    resetFormToDefaults();
                }
            }
            if (Array.isArray(cData)) setClients(cData);
        } catch (e) { console.error("Error fetching data:", e); }
        finally { setIsLoading(false); }
    };

    const selectPrompt = (p: PromptTemplate) => {
        setSelectedPrompt(p);
        setNewSystem(p.system);
        setNewUserTemplate(p.userTemplate);
        setNewCriticalInstructions(p.criticalInstructions || getDefaultCriticalInstructions(p.key));
        setNewOutputSchema(p.outputSchema || getDefaultOutputSchema(p.key));
    };

    const resetFormToDefaults = () => {
        setNewSystem("Eres un analista experto en Meta Ads.");
        setNewUserTemplate("Analiza: {{summary_json}}");
        setNewCriticalInstructions(getDefaultCriticalInstructions(selectedKey));
        setNewOutputSchema(getDefaultOutputSchema(selectedKey));
    };

    const fetchEngineConfig = async (clientId: string) => {
        setIsConfigLoading(true);
        try {
            const res = await fetch(`/api/clients/${clientId}/engine-config`);
            if (res.ok) setEngineConfig(await res.json());
        } catch (e) { console.error("Error fetching engine config:", e); }
        finally { setIsConfigLoading(false); }
    };

    // ─── Actions ──────────────────────────────────────
    const handleSaveDraft = async () => {
        setIsActionLoading(true);
        try {
            const res = await fetch("/api/admin/prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: selectedKey,
                    system: newSystem,
                    userTemplate: newUserTemplate,
                    criticalInstructions: newCriticalInstructions,
                    outputSchema: newOutputSchema,
                    variables: selectedKey === "report"
                        ? ["summary_json", "client_name", "meta_id", "ecommerce_mode"]
                        : ["summary_json"]
                })
            });
            if (res.ok) {
                await fetchPromptData();
                alert("Borrador guardado con las instrucciones actualizadas.");
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (e) { alert("Error al guardar borrador."); }
        finally { setIsActionLoading(false); }
    };

    const handleActivate = async (id: string) => {
        if (!confirm("Activar esta version? La anterior se archivara.")) return;
        setIsActionLoading(true);
        try {
            const res = await fetch("/api/admin/prompts/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            if (res.ok) await fetchPromptData();
        } catch (e) { alert("Error al activar."); }
        finally { setIsActionLoading(false); }
    };

    const handleSaveConfig = async () => {
        if (!selectedClientId || !engineConfig) return;
        setIsActionLoading(true);
        try {
            const res = await fetch(`/api/clients/${selectedClientId}/engine-config`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(engineConfig)
            });
            if (res.ok) alert("Configuracion del motor guardada.");
            else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) { alert("Error al guardar configuracion."); }
        finally { setIsActionLoading(false); }
    };

    const handleTest = async () => {
        if (!selectedClientId || !selectedPrompt) {
            alert("Selecciona un cliente y un prompt activo.");
            return;
        }
        setIsActionLoading(true);
        setTestResult(null);
        try {
            const res = await fetch("/api/admin/prompts/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: selectedClientId,
                    promptId: selectedPrompt.id,
                    range: "last_14d"
                })
            });
            setTestResult(await res.json());
        } catch (e) { alert("Error en el test."); }
        finally { setIsActionLoading(false); }
    };

    // ─── Tab Definitions ──────────────────────────────
    const tabs: { id: CerebroTab; label: string; icon: string }[] = [
        { id: "generators", label: "Generadores IA", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
        { id: "engine", label: "Motor de Decisiones", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
        { id: "classifier", label: "Clasificador Creativo", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
        { id: "console", label: "Consola de Pruebas", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
    ];

    const currentPromptMeta = PROMPT_KEYS.find(p => p.key === selectedKey);

    if (isLoading && activeTab === "generators") {
        return <AppLayout><div className="p-20 text-center text-text-muted">Cargando Cerebro de Worker...</div></AppLayout>;
    }

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-display font-black text-text-primary uppercase">Cerebro de Worker</h1>
                        <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                            Centro de Control de Inteligencia
                        </p>
                    </div>
                </header>

                {/* Tab Navigation */}
                <div className="flex bg-special border border-argent p-1 rounded-xl overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id
                                ? "bg-classic text-special"
                                : "text-text-muted hover:text-text-primary"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                            </svg>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ═══════════════════ TAB 1: GENERADORES IA ═══════════════════ */}
                {activeTab === "generators" && (
                    <div className="space-y-6">
                        {/* Prompt Type Selector */}
                        <div className="flex flex-wrap gap-2">
                            {PROMPT_KEYS.map(pk => (
                                <button
                                    key={pk.key}
                                    onClick={() => setSelectedKey(pk.key)}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedKey === pk.key
                                        ? "bg-classic/20 text-classic border border-classic/30"
                                        : "bg-special border border-argent text-text-muted hover:text-text-primary"
                                        }`}
                                >
                                    {pk.label}
                                </button>
                            ))}
                        </div>

                        {/* Description */}
                        {currentPromptMeta && (
                            <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-classic" />
                                    <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">{currentPromptMeta.label}</span>
                                </div>
                                <p className="text-small text-text-secondary">{currentPromptMeta.description}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                            {/* Sidebar: Versions */}
                            <div className="xl:col-span-3 space-y-4">
                                <div className="card bg-special border-argent p-0 overflow-hidden">
                                    <div className="p-3 border-b border-argent bg-stellar/50 text-center">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Versiones</h3>
                                    </div>
                                    <div className="divide-y divide-argent max-h-[300px] overflow-y-auto">
                                        {prompts.length === 0 && (
                                            <div className="p-6 text-center text-text-muted text-small italic">Sin versiones.</div>
                                        )}
                                        {prompts.map((p) => (
                                            <div
                                                key={p.id}
                                                onClick={() => selectPrompt(p)}
                                                className={`p-3 cursor-pointer transition-colors hover:bg-argent/10 ${selectedPrompt?.id === p.id ? "bg-classic/5 border-l-4 border-classic" : ""}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-body font-bold text-text-primary">v{p.version}</span>
                                                    <div className="flex items-center gap-2">
                                                        {p.criticalInstructions && (
                                                            <span className="px-1.5 py-0.5 bg-classic/10 text-classic text-[8px] font-black uppercase rounded">Custom CI</span>
                                                        )}
                                                        {p.status === "active" ? (
                                                            <span className="px-2 py-0.5 bg-synced/10 text-synced text-[9px] font-black uppercase rounded">Activa</span>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleActivate(p.id); }}
                                                                className="px-2 py-0.5 bg-argent/20 text-text-muted text-[9px] font-black uppercase rounded hover:bg-classic/20 hover:text-classic transition-colors"
                                                            >
                                                                Activar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
                                                    {new Date(p.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Editor Area */}
                            <div className="xl:col-span-9 space-y-4">
                                <div className="card p-0 overflow-hidden border-argent">
                                    <header className="bg-special border-b border-argent p-4 flex justify-between items-center">
                                        <h2 className="text-small font-black text-text-primary uppercase tracking-widest">
                                            Editor — {currentPromptMeta?.label}
                                        </h2>
                                        <button
                                            onClick={handleSaveDraft}
                                            disabled={isActionLoading}
                                            className="btn-classic px-6 py-2 text-[10px]"
                                        >
                                            {isActionLoading ? "GUARDANDO..." : `GUARDAR v${(prompts[0]?.version || 0) + 1}`}
                                        </button>
                                    </header>

                                    <div className="p-6 space-y-5">
                                        {/* System Prompt */}
                                        <div>
                                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">
                                                System Prompt
                                            </label>
                                            <textarea
                                                value={newSystem}
                                                onChange={(e) => setNewSystem(e.target.value)}
                                                className="w-full h-36 bg-stellar border border-argent rounded-xl p-4 text-small font-mono focus:border-classic outline-none resize-none text-text-primary"
                                                placeholder="Instrucciones base para la IA..."
                                            />
                                        </div>

                                        {/* Critical Instructions */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                    Instrucciones Criticas
                                                </label>
                                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase rounded-full">
                                                    Se inyectan al final del system prompt
                                                </span>
                                            </div>
                                            <textarea
                                                value={newCriticalInstructions}
                                                onChange={(e) => setNewCriticalInstructions(e.target.value)}
                                                className="w-full h-48 bg-stellar border border-amber-500/30 rounded-xl p-4 text-small font-mono focus:border-amber-400 outline-none resize-none text-text-primary"
                                                placeholder="Instrucciones de formato, idioma y schema JSON..."
                                            />
                                            <p className="text-[9px] text-text-muted mt-1">
                                                Define el formato de respuesta, idioma, y schema JSON. Si se deja vacio se usara el default del sistema.
                                            </p>
                                        </div>

                                        {/* User Template */}
                                        <div>
                                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">
                                                User Template
                                            </label>
                                            <textarea
                                                value={newUserTemplate}
                                                onChange={(e) => setNewUserTemplate(e.target.value)}
                                                className="w-full h-36 bg-stellar border border-argent rounded-xl p-4 text-small font-mono focus:border-classic outline-none resize-none text-text-primary"
                                                placeholder="Variables: {{summary_json}}..."
                                            />
                                            <div className="mt-2 p-3 bg-special rounded-lg border border-argent/50">
                                                <p className="text-[10px] text-text-muted font-bold uppercase flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-classic rounded-full"></span>
                                                    Variables: {selectedKey === "report"
                                                        ? "{{summary_json}}, {{client_name}}, {{meta_id}}, {{business_type}}"
                                                        : "{{summary_json}}"
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {/* Output Schema (Reference) */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                    Schema de Output
                                                </label>
                                                <span className="px-2 py-0.5 bg-synced/10 text-synced text-[8px] font-black uppercase rounded-full">
                                                    Referencia
                                                </span>
                                            </div>
                                            <textarea
                                                value={newOutputSchema}
                                                onChange={(e) => setNewOutputSchema(e.target.value)}
                                                className="w-full h-36 bg-stellar border border-synced/20 rounded-xl p-4 text-small font-mono focus:border-synced outline-none resize-none text-text-primary/60"
                                                placeholder="Schema JSON esperado..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════════════ TAB 2: MOTOR DE DECISIONES ═══════════════════ */}
                {activeTab === "engine" && (
                    <div className="space-y-6">
                        <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-synced" />
                                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Motor GEM</span>
                            </div>
                            <p className="text-small text-text-secondary">
                                Configura los umbrales de decision (CPA, ROAS, Frecuencia) que determinan cuando un anuncio cambia de etapa o se dispara una alerta. Cada cliente puede tener su propia configuracion.
                            </p>
                        </div>

                        <div className="card max-w-2xl">
                            <h3 className="text-body font-bold text-text-primary uppercase tracking-widest text-[11px] mb-4">Seleccionar Cliente</h3>
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body focus:border-classic outline-none"
                            >
                                <option value="">Seleccionar cliente...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {selectedClientId ? (
                            engineConfig ? (
                                <EngineConfigEditor
                                    config={engineConfig}
                                    onChange={setEngineConfig}
                                    onSave={handleSaveConfig}
                                    isSaving={isActionLoading}
                                />
                            ) : (
                                <div className="p-20 text-center card italic text-text-muted">Cargando configuracion...</div>
                            )
                        ) : (
                            <div className="p-20 text-center card border-dashed border-argent/50">
                                <div className="w-16 h-16 bg-classic/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-classic/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-subheader font-black text-text-primary uppercase mb-2">Selecciona un cliente</h3>
                                <p className="text-small text-text-muted max-w-xs mx-auto">La logica del motor GEM se configura por cliente segun su madurez y objetivos.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════ TAB 3: CLASIFICADOR CREATIVO ═══════════════════ */}
                {activeTab === "classifier" && (
                    <div className="space-y-6">
                        <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-classic" />
                                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Clasificador de Creativos</span>
                            </div>
                            <p className="text-small text-text-secondary">
                                Cada creativo/ad se clasifica automaticamente en una de 6 categorias basandose en su rendimiento, intent stage (TOFU/MOFU/BOFU), fatiga, y concentracion de gasto. Estas categorias alimentan las recomendaciones y los briefs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {CREATIVE_CATEGORIES.map(cat => (
                                <div key={cat.name} className={`card border ${cat.color} p-5`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="text-body font-black uppercase tracking-widest">{cat.label}</h3>
                                            <code className="text-[9px] text-text-muted font-mono">{cat.name}</code>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Condiciones</p>
                                        <ul className="space-y-1">
                                            {cat.conditions.map((cond, i) => (
                                                <li key={i} className="text-small text-text-secondary flex items-start gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-current mt-1.5 flex-shrink-0" />
                                                    {cond}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="border-t border-current/10 pt-3">
                                        <p className="text-small text-text-secondary italic">{cat.meaning}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card bg-special/40 border-argent/30 p-4">
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Las categorias se recalculan automaticamente en cada ejecucion de data-sync. La logica vive en creative-classifier.ts
                            </p>
                        </div>
                    </div>
                )}

                {/* ═══════════════════ TAB 4: CONSOLA DE PRUEBAS ═══════════════════ */}
                {activeTab === "console" && (
                    <div className="space-y-6">
                        <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-classic" />
                                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Consola de Pruebas Unificada</span>
                            </div>
                            <p className="text-small text-text-secondary">
                                Ejecuta cualquier generador IA contra datos reales de un cliente. Ve el prompt completo (incluyendo instrucciones criticas) y la respuesta parseada.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="card space-y-4">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Tipo de Prompt</h3>
                                <select
                                    value={testPromptKey}
                                    onChange={(e) => setTestPromptKey(e.target.value)}
                                    className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body focus:border-classic outline-none"
                                >
                                    {PROMPT_KEYS.map(pk => (
                                        <option key={pk.key} value={pk.key}>{pk.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="card space-y-4">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Cliente</h3>
                                <select
                                    value={selectedClientId}
                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                    className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body focus:border-classic outline-none"
                                >
                                    <option value="">Seleccionar...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="card flex items-end">
                                <button
                                    onClick={handleTest}
                                    disabled={isActionLoading || !selectedClientId}
                                    className="w-full btn-classic py-3 flex items-center justify-center gap-2"
                                >
                                    {isActionLoading ? (
                                        <div className="w-4 h-4 border-2 border-special border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            EJECUTAR TEST
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Test Results */}
                        {testResult && (
                            <div className="card bg-synced/5 border-synced/30 animate-in zoom-in-95 duration-300">
                                <header className="flex justify-between items-center mb-6 pb-4 border-b border-synced/20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-synced rounded-full animate-pulse" />
                                        <h3 className="text-small font-bold text-synced uppercase tracking-widest">Inferencia Completada</h3>
                                    </div>
                                    <div className="flex gap-4 text-[9px] font-black text-text-muted uppercase">
                                        {testResult.metadata?.modelUsed && (
                                            <span className="bg-special px-2 py-1 rounded">Model: {testResult.metadata.modelUsed}</span>
                                        )}
                                        {testResult.metadata?.latencyMs && (
                                            <span className="bg-special px-2 py-1 rounded">Latency: {testResult.metadata.latencyMs}ms</span>
                                        )}
                                    </div>
                                </header>
                                <div className="bg-stellar p-6 rounded-xl border border-argent/50 overflow-x-auto">
                                    <pre className="text-[12px] font-mono leading-relaxed text-text-primary whitespace-pre-wrap">
                                        {testResult.output || JSON.stringify(testResult, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
