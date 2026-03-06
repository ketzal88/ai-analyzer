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

type CerebroTab = "generators" | "engine" | "classifier" | "console" | "analyst" | "library";

// ─── Winning Ads Library Types ──────────────────────────────
const HOOK_TYPES = [
    { id: "curiosity", label: "Curiosidad" },
    { id: "shock", label: "Shock" },
    { id: "problem", label: "Problema" },
    { id: "social-proof", label: "Social Proof" },
    { id: "offer", label: "Oferta" },
    { id: "question", label: "Pregunta" },
] as const;

const FORMAT_OPTIONS = ["VIDEO", "IMAGE", "CAROUSEL"] as const;

interface WinningAd {
    id: string;
    angle: string;
    format: string;
    description: string;
    whyItWorked: string;
    keyElements: string[];
    visualStyle: string;
    addedAt: string;
    active: boolean;
}

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

    // ─── AI Analyst Prompts State ──────────────────────
    const ANALYST_CHANNELS = [
        { id: "meta_ads", label: "Meta Ads" },
        { id: "google_ads", label: "Google Ads" },
        { id: "ecommerce", label: "Ecommerce" },
        { id: "email", label: "Email Marketing" },
        { id: "cross_channel", label: "Cross-Channel" },
        { id: "creative_briefs", label: "Bajadas Creativas" },
    ] as const;
    const [analystChannel, setAnalystChannel] = useState<string>("meta_ads");
    const [analystPrompts, setAnalystPrompts] = useState<Record<string, { hasCustomPrompt: boolean; systemPrompt: string | null; updatedAt: string | null }>>({});
    const [analystDefaults, setAnalystDefaults] = useState<Record<string, string>>({});
    const [analystEditValue, setAnalystEditValue] = useState("");
    const [isAnalystLoading, setIsAnalystLoading] = useState(false);
    const [analystSaveStatus, setAnalystSaveStatus] = useState<string | null>(null);

    // ─── Winning Ads Library State ───────────────────
    const [libraryAds, setLibraryAds] = useState<WinningAd[]>([]);
    const [isLibraryLoading, setIsLibraryLoading] = useState(false);
    const [libraryForm, setLibraryForm] = useState({
        angle: "curiosity",
        format: "VIDEO" as string,
        description: "",
        whyItWorked: "",
        keyElements: "",
        visualStyle: "",
    });
    const [libraryFormOpen, setLibraryFormOpen] = useState(false);

    // ─── Data Fetching ────────────────────────────────
    useEffect(() => {
        if (activeTab === "generators") fetchPromptData();
        if (activeTab === "console") fetchClients();
        if (activeTab === "analyst") fetchAnalystPrompts();
        if (activeTab === "library") fetchLibraryAds();
    }, [activeTab, selectedKey]);

    useEffect(() => {
        if (activeTab === "engine" && selectedClientId) fetchEngineConfig(selectedClientId);
    }, [activeTab, selectedClientId]);

    // When analyst channel changes, update the editor
    useEffect(() => {
        if (activeTab !== "analyst") return;
        const data = analystPrompts[analystChannel];
        if (data?.hasCustomPrompt && data.systemPrompt) {
            setAnalystEditValue(data.systemPrompt);
        } else if (analystDefaults[analystChannel]) {
            setAnalystEditValue(analystDefaults[analystChannel]);
        }
        setAnalystSaveStatus(null);
    }, [analystChannel, analystPrompts, analystDefaults, activeTab]);

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

    const fetchAnalystPrompts = async () => {
        setIsAnalystLoading(true);
        try {
            const [promptsRes, defaultsRes] = await Promise.all([
                fetch("/api/admin/brain-prompts"),
                fetch("/api/admin/brain-prompts/defaults"),
            ]);
            const promptsData = await promptsRes.json();
            const defaultsData = await defaultsRes.json();

            if (Array.isArray(promptsData)) {
                const map: Record<string, any> = {};
                for (const p of promptsData) map[p.channelId] = p;
                setAnalystPrompts(map);
            }
            if (defaultsData && typeof defaultsData === "object") {
                setAnalystDefaults(defaultsData);
            }
        } catch (e) { console.error("Error fetching analyst prompts:", e); }
        finally { setIsAnalystLoading(false); }
    };

    const handleSaveAnalystPrompt = async () => {
        setIsActionLoading(true);
        setAnalystSaveStatus(null);
        try {
            const res = await fetch("/api/admin/brain-prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId: analystChannel, systemPrompt: analystEditValue }),
            });
            if (res.ok) {
                setAnalystSaveStatus("saved");
                await fetchAnalystPrompts();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) { alert("Error al guardar."); }
        finally { setIsActionLoading(false); }
    };

    const handleResetAnalystPrompt = async () => {
        if (!confirm("Revertir al prompt por defecto? Se perderá la versión custom.")) return;
        setIsActionLoading(true);
        try {
            const res = await fetch(`/api/admin/brain-prompts?id=${analystChannel}`, { method: "DELETE" });
            if (res.ok) {
                setAnalystEditValue(analystDefaults[analystChannel] || "");
                setAnalystSaveStatus("reset");
                await fetchAnalystPrompts();
            }
        } catch (e) { alert("Error al resetear."); }
        finally { setIsActionLoading(false); }
    };

    // ─── Library Actions ─────────────────────────────
    const fetchLibraryAds = async () => {
        setIsLibraryLoading(true);
        try {
            const res = await fetch("/api/admin/winning-ads?active=true");
            const data = await res.json();
            if (Array.isArray(data)) setLibraryAds(data);
        } catch (e) { console.error("Error fetching library:", e); }
        finally { setIsLibraryLoading(false); }
    };

    const handleAddLibraryAd = async () => {
        if (!libraryForm.description.trim() || !libraryForm.whyItWorked.trim()) {
            alert("Descripción y 'Por qué funcionó' son requeridos.");
            return;
        }
        // Check max 3 per angle
        const countForAngle = libraryAds.filter(a => a.angle === libraryForm.angle).length;
        if (countForAngle >= 3) {
            alert(`Ya hay 3 ads para el ángulo "${libraryForm.angle}". Eliminá uno antes de agregar otro.`);
            return;
        }
        setIsActionLoading(true);
        try {
            const res = await fetch("/api/admin/winning-ads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...libraryForm,
                    keyElements: libraryForm.keyElements.split(",").map(s => s.trim()).filter(Boolean),
                }),
            });
            if (res.ok) {
                setLibraryForm({ angle: "curiosity", format: "VIDEO", description: "", whyItWorked: "", keyElements: "", visualStyle: "" });
                setLibraryFormOpen(false);
                await fetchLibraryAds();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (_e) { alert("Error al guardar."); }
        finally { setIsActionLoading(false); }
    };

    const handleDeleteLibraryAd = async (id: string) => {
        if (!confirm("Eliminar este ad de la biblioteca?")) return;
        setIsActionLoading(true);
        try {
            await fetch(`/api/admin/winning-ads?id=${id}`, { method: "DELETE" });
            await fetchLibraryAds();
        } catch (_e) { alert("Error al eliminar."); }
        finally { setIsActionLoading(false); }
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
        { id: "analyst", label: "AI Analyst", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
        { id: "library", label: "Ads Ganadores", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
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

                {/* ═══════════════════ TAB 5: AI ANALYST PROMPTS ═══════════════════ */}
                {activeTab === "analyst" && (
                    <div className="space-y-6">
                        <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-classic" />
                                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">AI Analyst — Prompts por Canal</span>
                            </div>
                            <p className="text-small text-text-secondary">
                                Edita los system prompts que usa el AI Analyst para cada canal. Incluyen benchmarks, frameworks de diagnostico y reglas especializadas. Si guardas una version custom, sobreescribe el default del codigo.
                            </p>
                        </div>

                        {/* Channel Selector */}
                        <div className="flex flex-wrap gap-2">
                            {ANALYST_CHANNELS.map(ch => {
                                const data = analystPrompts[ch.id];
                                return (
                                    <button
                                        key={ch.id}
                                        onClick={() => setAnalystChannel(ch.id)}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${analystChannel === ch.id
                                            ? "bg-classic/20 text-classic border border-classic/30"
                                            : "bg-special border border-argent text-text-muted hover:text-text-primary"
                                            }`}
                                    >
                                        {ch.label}
                                        {data?.hasCustomPrompt && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Custom prompt" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {isAnalystLoading ? (
                            <div className="p-20 text-center text-text-muted">Cargando prompts...</div>
                        ) : (
                            <div className="card p-0 overflow-hidden border-argent">
                                {/* Header */}
                                <header className="bg-special border-b border-argent p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div>
                                        <h2 className="text-small font-black text-text-primary uppercase tracking-widest">
                                            {ANALYST_CHANNELS.find(c => c.id === analystChannel)?.label}
                                        </h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            {analystPrompts[analystChannel]?.hasCustomPrompt ? (
                                                <>
                                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase rounded-full">
                                                        Custom en Firestore
                                                    </span>
                                                    {analystPrompts[analystChannel]?.updatedAt && (
                                                        <span className="text-[9px] text-text-muted">
                                                            {new Date(analystPrompts[analystChannel].updatedAt!).toLocaleString()}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-synced/10 text-synced text-[8px] font-black uppercase rounded-full">
                                                    Usando default del codigo
                                                </span>
                                            )}
                                            {analystSaveStatus === "saved" && (
                                                <span className="px-2 py-0.5 bg-synced/20 text-synced text-[8px] font-black uppercase rounded-full animate-in fade-in duration-300">
                                                    Guardado
                                                </span>
                                            )}
                                            {analystSaveStatus === "reset" && (
                                                <span className="px-2 py-0.5 bg-classic/20 text-classic text-[8px] font-black uppercase rounded-full animate-in fade-in duration-300">
                                                    Revertido a default
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {analystPrompts[analystChannel]?.hasCustomPrompt && (
                                            <button
                                                onClick={handleResetAnalystPrompt}
                                                disabled={isActionLoading}
                                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
                                            >
                                                Revertir a Default
                                            </button>
                                        )}
                                        <button
                                            onClick={handleSaveAnalystPrompt}
                                            disabled={isActionLoading}
                                            className="btn-classic px-6 py-2 text-[10px]"
                                        >
                                            {isActionLoading ? "GUARDANDO..." : "GUARDAR EN FIRESTORE"}
                                        </button>
                                    </div>
                                </header>

                                {/* Editor */}
                                <div className="p-6">
                                    <textarea
                                        value={analystEditValue}
                                        onChange={(e) => setAnalystEditValue(e.target.value)}
                                        className="w-full h-[500px] bg-stellar border border-argent rounded-xl p-4 text-[12px] font-mono leading-relaxed focus:border-classic outline-none resize-none text-text-primary"
                                        placeholder="System prompt para el AI Analyst..."
                                    />
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-[9px] text-text-muted">
                                            Este prompt se envia como system message a Claude junto con los datos del canal en formato XML. Incluye benchmarks, reglas de diagnostico y formato de respuesta.
                                        </p>
                                        <span className="text-[9px] text-text-muted font-mono">
                                            {analystEditValue.length.toLocaleString()} chars
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Info card */}
                        <div className="card bg-special/40 border-argent/30 p-4">
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Los prompts se cachean 5 minutos en el servidor. Los cambios tardan hasta 5 min en reflejarse en el chat del analyst.
                            </p>
                        </div>
                    </div>
                )}

                {/* ═══════════════════ TAB 6: BIBLIOTECA ADS GANADORES ═══════════════════ */}
                {activeTab === "library" && (
                    <div className="space-y-6">
                        <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Biblioteca de Ads Ganadores</span>
                            </div>
                            <p className="text-small text-text-secondary">
                                Ads ganadores históricos cross-client que alimentan las bajadas creativas. Máximo 3 por ángulo para mantener el contexto liviano.
                            </p>
                        </div>

                        {/* Add button */}
                        {!libraryFormOpen && (
                            <button
                                onClick={() => setLibraryFormOpen(true)}
                                className="btn-classic px-6 py-2.5 text-[10px] flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Agregar Ad Ganador
                            </button>
                        )}

                        {/* Add Form */}
                        {libraryFormOpen && (
                            <div className="card border-classic/30 p-6 space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[10px] font-black text-text-primary uppercase tracking-widest">Nuevo Ad Ganador</h3>
                                    <button onClick={() => setLibraryFormOpen(false)} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Ángulo (Hook Type)</label>
                                        <select
                                            value={libraryForm.angle}
                                            onChange={(e) => setLibraryForm(f => ({ ...f, angle: e.target.value }))}
                                            className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-body focus:border-classic outline-none"
                                        >
                                            {HOOK_TYPES.map(h => {
                                                const count = libraryAds.filter(a => a.angle === h.id).length;
                                                return (
                                                    <option key={h.id} value={h.id} disabled={count >= 3}>
                                                        {h.label} ({count}/3)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Formato</label>
                                        <select
                                            value={libraryForm.format}
                                            onChange={(e) => setLibraryForm(f => ({ ...f, format: e.target.value }))}
                                            className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-body focus:border-classic outline-none"
                                        >
                                            {FORMAT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Descripción del anuncio</label>
                                    <textarea
                                        value={libraryForm.description}
                                        onChange={(e) => setLibraryForm(f => ({ ...f, description: e.target.value }))}
                                        className="w-full h-20 bg-stellar border border-argent rounded-lg p-3 text-small font-mono focus:border-classic outline-none resize-none text-text-primary"
                                        placeholder="UGC de mujer mostrando el producto con expresión de sorpresa..."
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Por qué funcionó</label>
                                    <textarea
                                        value={libraryForm.whyItWorked}
                                        onChange={(e) => setLibraryForm(f => ({ ...f, whyItWorked: e.target.value }))}
                                        className="w-full h-20 bg-stellar border border-argent rounded-lg p-3 text-small font-mono focus:border-classic outline-none resize-none text-text-primary"
                                        placeholder="Hook de curiosidad con cara + texto corto generó CTR 3.2%..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Elementos clave (separados por coma)</label>
                                        <input
                                            type="text"
                                            value={libraryForm.keyElements}
                                            onChange={(e) => setLibraryForm(f => ({ ...f, keyElements: e.target.value }))}
                                            className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-mono focus:border-classic outline-none text-text-primary"
                                            placeholder="cara, texto corto, producto visible, colores vibrantes"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Estilo visual</label>
                                        <input
                                            type="text"
                                            value={libraryForm.visualStyle}
                                            onChange={(e) => setLibraryForm(f => ({ ...f, visualStyle: e.target.value }))}
                                            className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-mono focus:border-classic outline-none text-text-primary"
                                            placeholder="ugc, editorial, meme, flat-design..."
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => setLibraryFormOpen(false)}
                                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAddLibraryAd}
                                        disabled={isActionLoading}
                                        className="btn-classic px-6 py-2 text-[10px]"
                                    >
                                        {isActionLoading ? "GUARDANDO..." : "GUARDAR"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Ads grouped by angle */}
                        {isLibraryLoading ? (
                            <div className="p-20 text-center text-text-muted">Cargando biblioteca...</div>
                        ) : (
                            <div className="space-y-6">
                                {HOOK_TYPES.map(hookType => {
                                    const adsForAngle = libraryAds.filter(a => a.angle === hookType.id);
                                    return (
                                        <div key={hookType.id} className="card p-0 overflow-hidden border-argent">
                                            <div className="flex items-center justify-between px-5 py-3 bg-special border-b border-argent">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-[10px] font-black text-text-primary uppercase tracking-widest">{hookType.label}</h3>
                                                    <span className="text-[9px] font-mono text-text-muted">{hookType.id}</span>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${adsForAngle.length >= 3
                                                    ? "bg-amber-500/10 text-amber-400"
                                                    : adsForAngle.length > 0
                                                        ? "bg-synced/10 text-synced"
                                                        : "bg-argent/20 text-text-muted"
                                                    }`}>
                                                    {adsForAngle.length}/3
                                                </span>
                                            </div>

                                            {adsForAngle.length === 0 ? (
                                                <div className="px-5 py-6 text-center text-[10px] text-text-muted italic">
                                                    Sin ads para este ángulo
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-argent/50">
                                                    {adsForAngle.map(ad => (
                                                        <div key={ad.id} className="px-5 py-4 hover:bg-argent/5 transition-colors">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${
                                                                            ad.format === "VIDEO" ? "bg-classic/10 text-classic" :
                                                                            ad.format === "CAROUSEL" ? "bg-amber-500/10 text-amber-400" :
                                                                            "bg-synced/10 text-synced"
                                                                        }`}>{ad.format}</span>
                                                                        {ad.visualStyle && (
                                                                            <span className="px-2 py-0.5 bg-argent/20 text-text-muted text-[8px] font-mono rounded">{ad.visualStyle}</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-text-primary font-mono leading-relaxed mb-1">{ad.description}</p>
                                                                    <p className="text-[10px] text-text-secondary leading-relaxed">
                                                                        <span className="font-bold text-text-muted">Por qué funcionó:</span> {ad.whyItWorked}
                                                                    </p>
                                                                    {ad.keyElements && ad.keyElements.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                                            {ad.keyElements.map((el, i) => (
                                                                                <span key={i} className="px-1.5 py-0.5 bg-classic/5 text-classic/80 text-[8px] font-mono rounded">{el}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteLibraryAd(ad.id)}
                                                                    disabled={isActionLoading}
                                                                    className="shrink-0 w-7 h-7 flex items-center justify-center text-text-muted hover:text-red-400
                                                                               hover:bg-red-500/10 rounded transition-all text-sm"
                                                                    title="Eliminar"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Summary */}
                        <div className="card bg-special/40 border-argent/30 p-4">
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Solo texto, sin imágenes. Máximo 3 por ángulo = 18 ads totales. Esto mantiene el contexto liviano para el AI Analyst.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
