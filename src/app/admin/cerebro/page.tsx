"use client";

import React, { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { Client } from "@/types";
import { PromptTemplate } from "@/types";
import { EngineConfig } from "@/types/engine-config";
import EngineConfigEditor from "@/components/admin/EngineConfigEditor";
import ChannelPromptEditor from "@/components/admin/ChannelPromptEditor";
import GenericPromptEditor from "@/components/admin/GenericPromptEditor";
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

// ─── Tab System ─────────────────────────────────────────────

type CerebroTab =
    | "general"
    | "meta_ads"
    | "google_ads"
    | "ga4"
    | "ecommerce"
    | "email"
    | "cross_channel"
    | "creativos"
    | "slack"
    | "engine";

const CHANNEL_TABS: { id: CerebroTab; label: string }[] = [
    { id: "meta_ads", label: "Meta Ads" },
    { id: "google_ads", label: "Google Ads" },
    { id: "ga4", label: "GA4" },
    { id: "ecommerce", label: "Ecommerce" },
    { id: "email", label: "Email" },
    { id: "cross_channel", label: "Cross-Channel" },
];

const ALL_TABS: { id: CerebroTab; label: string; group?: string }[] = [
    { id: "general", label: "General", group: "config" },
    ...CHANNEL_TABS.map(t => ({ ...t, group: "channels" })),
    { id: "creativos", label: "Creativos", group: "tools" },
    { id: "slack", label: "Slack & Reportes", group: "tools" },
    { id: "engine", label: "Motor Decisiones", group: "tools" },
];

// ─── Creativos Sub-tabs ─────────────────────────────────────
type CreativosSubTab = "bajadas" | "vision" | "classifier" | "library";

// ─── Main Component ─────────────────────────────────────────

export default function CerebroDeWorker() {
    const [activeTab, setActiveTab] = useState<CerebroTab>("general");

    // ─── Prompt Data (all prompts + defaults) ───────────
    const [promptsData, setPromptsData] = useState<Record<string, any>>({});
    const [defaultsData, setDefaultsData] = useState<Record<string, any>>({});
    const [isPromptsLoading, setIsPromptsLoading] = useState(true);

    // ─── Engine Config State ──────────────────────────
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [engineConfig, setEngineConfig] = useState<EngineConfig | null>(null);
    const [isConfigLoading, setIsConfigLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // ─── Creativos Sub-tab ──────────────────────────────
    const [creativosSubTab, setCreativosSubTab] = useState<CreativosSubTab>("bajadas");

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

    // ─── Legacy Generators State ────────────────────────
    const [showLegacy, setShowLegacy] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string>(PROMPT_KEYS[0].key);
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
    const [newSystem, setNewSystem] = useState("");
    const [newUserTemplate, setNewUserTemplate] = useState("");
    const [newCriticalInstructions, setNewCriticalInstructions] = useState("");
    const [newOutputSchema, setNewOutputSchema] = useState("");

    // ─── Console State ────────────────────────────────
    const [testResult, setTestResult] = useState<any>(null);
    const [testPromptKey, setTestPromptKey] = useState<string>(PROMPT_KEYS[0].key);

    // ─── Data Fetching ────────────────────────────────
    const fetchAllPrompts = useCallback(async () => {
        setIsPromptsLoading(true);
        try {
            const [promptsRes, defaultsRes] = await Promise.all([
                fetch("/api/admin/brain-prompts"),
                fetch("/api/admin/brain-prompts/defaults"),
            ]);
            const pData = await promptsRes.json();
            const dData = await defaultsRes.json();

            if (Array.isArray(pData)) {
                const map: Record<string, any> = {};
                for (const p of pData) map[p.channelId] = p;
                setPromptsData(map);
            }
            if (dData && typeof dData === "object") {
                setDefaultsData(dData);
            }
        } catch (e) {
            console.error("Error fetching prompts:", e);
        } finally {
            setIsPromptsLoading(false);
        }
    }, []);

    const fetchClients = useCallback(async () => {
        try {
            const res = await fetch("/api/clients");
            const data = await res.json();
            if (Array.isArray(data)) setClients(data);
        } catch (e) {
            console.error("Error fetching clients:", e);
        }
    }, []);

    useEffect(() => {
        fetchAllPrompts();
        fetchClients();
    }, [fetchAllPrompts, fetchClients]);

    useEffect(() => {
        if (activeTab === "engine" && selectedClientId) fetchEngineConfig(selectedClientId);
    }, [activeTab, selectedClientId]);

    useEffect(() => {
        if (creativosSubTab === "library") fetchLibraryAds();
    }, [creativosSubTab]);

    // ─── Prompt Save/Reset Handlers ─────────────────
    const handleSavePrompt = async (channelId: string, systemPrompt: string, suggestedQuestions?: string[]) => {
        const body: any = { channelId, systemPrompt };
        if (suggestedQuestions) body.suggestedQuestions = suggestedQuestions;
        const res = await fetch("/api/admin/brain-prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        await fetchAllPrompts();
    };

    const handleSaveGenericPrompt = async (promptId: string, value: string) => {
        const body: any = { channelId: promptId };
        if (promptId === "general") {
            body.commonRules = value;
        } else {
            body.systemPrompt = value;
        }
        const res = await fetch("/api/admin/brain-prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        await fetchAllPrompts();
    };

    const handleResetPrompt = async (channelId: string) => {
        if (!confirm("Revertir al prompt por defecto? Se perderá la versión custom.")) return;
        const res = await fetch(`/api/admin/brain-prompts?id=${channelId}`, { method: "DELETE" });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        await fetchAllPrompts();
    };

    // ─── Engine Config ───────────────────────────────
    const fetchEngineConfig = async (clientId: string) => {
        setIsConfigLoading(true);
        try {
            const res = await fetch(`/api/clients/${clientId}/engine-config`);
            if (res.ok) setEngineConfig(await res.json());
        } catch (e) {
            console.error("Error fetching engine config:", e);
        } finally {
            setIsConfigLoading(false);
        }
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
        } catch (e) {
            alert("Error al guardar configuracion.");
        } finally {
            setIsActionLoading(false);
        }
    };

    // ─── Library Actions ─────────────────────────────
    const fetchLibraryAds = async () => {
        setIsLibraryLoading(true);
        try {
            const res = await fetch("/api/admin/winning-ads?active=true");
            const data = await res.json();
            if (Array.isArray(data)) setLibraryAds(data);
        } catch (e) {
            console.error("Error fetching library:", e);
        } finally {
            setIsLibraryLoading(false);
        }
    };

    const handleAddLibraryAd = async () => {
        if (!libraryForm.description.trim() || !libraryForm.whyItWorked.trim()) {
            alert("Descripción y 'Por qué funcionó' son requeridos.");
            return;
        }
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
        } catch (_e) {
            alert("Error al guardar.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteLibraryAd = async (id: string) => {
        if (!confirm("Eliminar este ad de la biblioteca?")) return;
        setIsActionLoading(true);
        try {
            await fetch(`/api/admin/winning-ads?id=${id}`, { method: "DELETE" });
            await fetchLibraryAds();
        } catch (_e) {
            alert("Error al eliminar.");
        } finally {
            setIsActionLoading(false);
        }
    };

    // ─── Legacy Generator Actions ────────────────────
    const fetchPromptData = async () => {
        try {
            const res = await fetch(`/api/admin/prompts?key=${selectedKey}`);
            const pData = await res.json();
            if (Array.isArray(pData)) {
                setPrompts(pData);
                if (pData.length > 0) {
                    const active = pData.find((p: PromptTemplate) => p.status === "active") || pData[0];
                    selectLegacyPrompt(active);
                } else {
                    setSelectedPrompt(null);
                    resetFormToDefaults();
                }
            }
        } catch (e) {
            console.error("Error fetching prompts:", e);
        }
    };

    const selectLegacyPrompt = (p: PromptTemplate) => {
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
        } catch (e) {
            alert("Error al guardar borrador.");
        } finally {
            setIsActionLoading(false);
        }
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
        } catch (e) {
            alert("Error al activar.");
        } finally {
            setIsActionLoading(false);
        }
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
        } catch (e) {
            alert("Error en el test.");
        } finally {
            setIsActionLoading(false);
        }
    };

    // ─── Helper to get prompt data for a channel ────
    const getChannelData = (channelId: string) => {
        const stored = promptsData[channelId];
        const defaults = defaultsData[channelId];
        return {
            customPrompt: stored?.systemPrompt || null,
            suggestedQuestions: stored?.suggestedQuestions || null,
            defaultPrompt: defaults?.systemPrompt || "",
            defaultQuestions: defaults?.suggestedQuestions || [],
            hasCustom: !!stored?.hasCustomPrompt,
        };
    };

    const getGenericData = (promptId: string) => {
        const stored = promptsData[promptId];
        const defaults = defaultsData[promptId];
        if (promptId === "general") {
            return {
                customPrompt: stored?.commonRules || null,
                defaultPrompt: defaults?.commonRules || "",
            };
        }
        return {
            customPrompt: stored?.systemPrompt || null,
            defaultPrompt: defaults?.systemPrompt || "",
        };
    };

    const currentPromptMeta = PROMPT_KEYS.find(p => p.key === selectedKey);

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
                    {ALL_TABS.map((tab, i) => {
                        const isActive = activeTab === tab.id;
                        const showSeparator = i > 0 && ALL_TABS[i - 1].group !== tab.group;
                        const hasCustom = promptsData[tab.id]?.hasCustomPrompt;
                        return (
                            <React.Fragment key={tab.id}>
                                {showSeparator && (
                                    <div className="w-px bg-argent/40 mx-1 my-1.5" />
                                )}
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${isActive
                                        ? "bg-classic text-special"
                                        : "text-text-muted hover:text-text-primary"
                                        }`}
                                >
                                    {tab.label}
                                    {hasCustom && !isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    )}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* ═══════════════════ TAB: GENERAL ═══════════════════ */}
                {activeTab === "general" && (
                    <div className="space-y-6">
                        <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-classic" />
                                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Reglas Generales</span>
                            </div>
                            <p className="text-small text-text-secondary">
                                Estas reglas de formato se aplican automaticamente a TODOS los prompts de canal del AI Analyst. Definen idioma, longitud y estilo de respuesta.
                            </p>
                        </div>

                        {isPromptsLoading ? (
                            <div className="p-20 text-center text-text-muted">Cargando...</div>
                        ) : (
                            <GenericPromptEditor
                                promptId="general"
                                label="COMMON_RULES — Reglas de Formato"
                                description="Se concatenan al final de cada prompt de canal. Aplican a meta_ads, google_ads, ga4, ecommerce, email y cross_channel."
                                defaultPrompt={getGenericData("general").defaultPrompt}
                                customPrompt={getGenericData("general").customPrompt}
                                isLoading={isPromptsLoading}
                                onSave={handleSaveGenericPrompt}
                                onReset={handleResetPrompt}
                                fieldName="commonRules"
                            />
                        )}

                        <div className="card bg-special/40 border-argent/30 p-4">
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Los cambios se cachean 5 minutos. El prompt de "Bajadas Creativas" tiene sus propias reglas de formato separadas.
                            </p>
                        </div>
                    </div>
                )}

                {/* ═══════════════════ CHANNEL TABS (6 channels) ═══════════════════ */}
                {CHANNEL_TABS.map(ch => ch.id).includes(activeTab) && (
                    <div className="space-y-6">
                        {isPromptsLoading ? (
                            <div className="p-20 text-center text-text-muted">Cargando prompts...</div>
                        ) : (() => {
                            const data = getChannelData(activeTab);
                            const label = CHANNEL_TABS.find(t => t.id === activeTab)?.label || activeTab;
                            return (
                                <ChannelPromptEditor
                                    channelId={activeTab}
                                    channelLabel={label}
                                    defaultPrompt={data.defaultPrompt}
                                    customPrompt={data.customPrompt}
                                    suggestedQuestions={data.suggestedQuestions}
                                    defaultQuestions={data.defaultQuestions}
                                    isLoading={isPromptsLoading}
                                    onSave={handleSavePrompt}
                                    onReset={handleResetPrompt}
                                />
                            );
                        })()}

                        <div className="card bg-special/40 border-argent/30 p-4">
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Este prompt se envía como system message a Claude junto con los datos del canal en formato XML. Las COMMON_RULES se concatenan automáticamente.
                            </p>
                        </div>
                    </div>
                )}

                {/* ═══════════════════ TAB: CREATIVOS ═══════════════════ */}
                {activeTab === "creativos" && (
                    <div className="space-y-6">
                        {/* Sub-tab navigation */}
                        <div className="flex gap-2">
                            {([
                                { id: "bajadas" as CreativosSubTab, label: "Bajadas Creativas" },
                                { id: "vision" as CreativosSubTab, label: "Vision Prompt" },
                                { id: "classifier" as CreativosSubTab, label: "Clasificador" },
                                { id: "library" as CreativosSubTab, label: "Ads Ganadores" },
                            ]).map(sub => (
                                <button
                                    key={sub.id}
                                    onClick={() => setCreativosSubTab(sub.id)}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${creativosSubTab === sub.id
                                        ? "bg-classic/20 text-classic border border-classic/30"
                                        : "bg-special border border-argent text-text-muted hover:text-text-primary"
                                        }`}
                                >
                                    {sub.label}
                                    {sub.id === "bajadas" && promptsData["creative_briefs"]?.hasCustomPrompt && (
                                        <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                    )}
                                    {sub.id === "vision" && promptsData["creative_dna_vision"]?.hasCustomPrompt && (
                                        <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Bajadas Creativas */}
                        {creativosSubTab === "bajadas" && !isPromptsLoading && (() => {
                            const data = getChannelData("creative_briefs");
                            return (
                                <ChannelPromptEditor
                                    channelId="creative_briefs"
                                    channelLabel="Bajadas Creativas"
                                    defaultPrompt={data.defaultPrompt}
                                    customPrompt={data.customPrompt}
                                    suggestedQuestions={data.suggestedQuestions}
                                    defaultQuestions={data.defaultQuestions}
                                    isLoading={isPromptsLoading}
                                    onSave={handleSavePrompt}
                                    onReset={handleResetPrompt}
                                />
                            );
                        })()}

                        {/* Creative DNA Vision Prompt */}
                        {creativosSubTab === "vision" && !isPromptsLoading && (() => {
                            const data = getGenericData("creative_dna_vision");
                            return (
                                <GenericPromptEditor
                                    promptId="creative_dna_vision"
                                    label="Creative DNA — Vision Prompt"
                                    description="Prompt que usa Gemini Vision para analizar imágenes de creativos. Define qué atributos extraer (visualStyle, hookType, colores, etc)."
                                    defaultPrompt={data.defaultPrompt}
                                    customPrompt={data.customPrompt}
                                    isLoading={isPromptsLoading}
                                    onSave={handleSaveGenericPrompt}
                                    onReset={handleResetPrompt}
                                />
                            );
                        })()}

                        {/* Clasificador Creativo */}
                        {creativosSubTab === "classifier" && (
                            <div className="space-y-6">
                                <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-2 h-2 rounded-full bg-classic" />
                                        <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Clasificador de Creativos</span>
                                    </div>
                                    <p className="text-small text-text-secondary">
                                        Cada creativo se clasifica automáticamente en 6 categorías basándose en rendimiento, intent stage y fatiga. La lógica vive en creative-classifier.ts.
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
                            </div>
                        )}

                        {/* Ads Ganadores Library */}
                        {creativosSubTab === "library" && (
                            <div className="space-y-6">
                                <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                        <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Biblioteca de Ads Ganadores</span>
                                    </div>
                                    <p className="text-small text-text-secondary">
                                        Ads ganadores históricos cross-client que alimentan las bajadas creativas. Máximo 3 por ángulo.
                                    </p>
                                </div>

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

                                {libraryFormOpen && (
                                    <div className="card border-classic/30 p-6 space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[10px] font-black text-text-primary uppercase tracking-widest">Nuevo Ad Ganador</h3>
                                            <button onClick={() => setLibraryFormOpen(false)} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Ángulo</label>
                                                <select
                                                    value={libraryForm.angle}
                                                    onChange={(e) => setLibraryForm(f => ({ ...f, angle: e.target.value }))}
                                                    className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-body focus:border-classic outline-none"
                                                >
                                                    {HOOK_TYPES.map(h => {
                                                        const count = libraryAds.filter(a => a.angle === h.id).length;
                                                        return <option key={h.id} value={h.id} disabled={count >= 3}>{h.label} ({count}/3)</option>;
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
                                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Descripción</label>
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
                                                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Elementos clave (coma)</label>
                                                <input
                                                    type="text"
                                                    value={libraryForm.keyElements}
                                                    onChange={(e) => setLibraryForm(f => ({ ...f, keyElements: e.target.value }))}
                                                    className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-mono focus:border-classic outline-none text-text-primary"
                                                    placeholder="cara, texto corto, producto visible"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 block">Estilo visual</label>
                                                <input
                                                    type="text"
                                                    value={libraryForm.visualStyle}
                                                    onChange={(e) => setLibraryForm(f => ({ ...f, visualStyle: e.target.value }))}
                                                    className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-mono focus:border-classic outline-none text-text-primary"
                                                    placeholder="ugc, editorial, meme..."
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button onClick={() => setLibraryFormOpen(false)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors">
                                                Cancelar
                                            </button>
                                            <button onClick={handleAddLibraryAd} disabled={isActionLoading} className="btn-classic px-6 py-2 text-[10px]">
                                                {isActionLoading ? "GUARDANDO..." : "GUARDAR"}
                                            </button>
                                        </div>
                                    </div>
                                )}

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
                                                        <div className="px-5 py-6 text-center text-[10px] text-text-muted italic">Sin ads para este ángulo</div>
                                                    ) : (
                                                        <div className="divide-y divide-argent/50">
                                                            {adsForAngle.map(ad => (
                                                                <div key={ad.id} className="px-5 py-4 hover:bg-argent/5 transition-colors">
                                                                    <div className="flex items-start justify-between gap-4">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${ad.format === "VIDEO" ? "bg-classic/10 text-classic" : ad.format === "CAROUSEL" ? "bg-amber-500/10 text-amber-400" : "bg-synced/10 text-synced"}`}>{ad.format}</span>
                                                                                {ad.visualStyle && <span className="px-2 py-0.5 bg-argent/20 text-text-muted text-[8px] font-mono rounded">{ad.visualStyle}</span>}
                                                                            </div>
                                                                            <p className="text-[11px] text-text-primary font-mono leading-relaxed mb-1">{ad.description}</p>
                                                                            <p className="text-[10px] text-text-secondary leading-relaxed">
                                                                                <span className="font-bold text-text-muted">Por qué funcionó:</span> {ad.whyItWorked}
                                                                            </p>
                                                                            {ad.keyElements?.length > 0 && (
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
                                                                            className="shrink-0 w-7 h-7 flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-all text-sm"
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
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════ TAB: SLACK & REPORTES ═══════════════════ */}
                {activeTab === "slack" && (
                    <div className="space-y-6">
                        <div className="bg-special/40 border border-argent/50 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-classic" />
                                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Slack & Reportes</span>
                            </div>
                            <p className="text-small text-text-secondary">
                                Prompts que generan los resúmenes semanales para enviar por Slack al cliente. Tono esperanzador, orientado a oportunidades.
                            </p>
                        </div>

                        {isPromptsLoading ? (
                            <div className="p-20 text-center text-text-muted">Cargando...</div>
                        ) : (
                            <div className="space-y-8">
                                {([
                                    { id: "slack_summary", label: "Resumen por Canal", desc: "Prompt para resúmenes Slack de un canal individual (Meta, Google, etc). Tono esperanzador, max 15 líneas, formato Slack mrkdwn." },
                                    { id: "slack_cross_channel", label: "Resumen Cross-Channel", desc: "Prompt para el super resumen semanal cruzando todos los canales. Análisis de funnel completo, max 25-30 líneas." },
                                    { id: "slack_user_template", label: "Template de Usuario", desc: "Template del mensaje de usuario que se envía junto con los datos. Usa {context} como placeholder para los datos del cliente." },
                                ]).map(p => {
                                    const data = getGenericData(p.id);
                                    return (
                                        <GenericPromptEditor
                                            key={p.id}
                                            promptId={p.id}
                                            label={p.label}
                                            description={p.desc}
                                            defaultPrompt={data.defaultPrompt}
                                            customPrompt={data.customPrompt}
                                            isLoading={isPromptsLoading}
                                            onSave={handleSaveGenericPrompt}
                                            onReset={handleResetPrompt}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════ TAB: MOTOR DE DECISIONES ═══════════════════ */}
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

                {/* ═══════════════════ LEGACY GENERATORS (collapsible) ═══════════════════ */}
                <div className="border-t border-argent/30 pt-6">
                    <button
                        onClick={() => {
                            setShowLegacy(!showLegacy);
                            if (!showLegacy) fetchPromptData();
                        }}
                        className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest hover:text-text-secondary transition-colors"
                    >
                        <svg className={`w-3 h-3 transition-transform ${showLegacy ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Generadores Gemini (Legacy)
                        <span className="px-2 py-0.5 bg-argent/20 text-text-muted text-[8px] rounded-full">DEPRECADO</span>
                    </button>

                    {showLegacy && (
                        <div className="mt-6 space-y-6">
                            {/* Prompt Type Selector */}
                            <div className="flex flex-wrap gap-2">
                                {PROMPT_KEYS.map(pk => (
                                    <button
                                        key={pk.key}
                                        onClick={() => { setSelectedKey(pk.key); fetchPromptData(); }}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedKey === pk.key
                                            ? "bg-classic/20 text-classic border border-classic/30"
                                            : "bg-special border border-argent text-text-muted hover:text-text-primary"
                                            }`}
                                    >
                                        {pk.label}
                                    </button>
                                ))}
                            </div>

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
                                                    onClick={() => selectLegacyPrompt(p)}
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
                                            <button onClick={handleSaveDraft} disabled={isActionLoading} className="btn-classic px-6 py-2 text-[10px]">
                                                {isActionLoading ? "GUARDANDO..." : `GUARDAR v${(prompts[0]?.version || 0) + 1}`}
                                            </button>
                                        </header>
                                        <div className="p-6 space-y-5">
                                            <div>
                                                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">System Prompt</label>
                                                <textarea value={newSystem} onChange={(e) => setNewSystem(e.target.value)} className="w-full h-36 bg-stellar border border-argent rounded-xl p-4 text-small font-mono focus:border-classic outline-none resize-none text-text-primary" placeholder="Instrucciones base para la IA..." />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Instrucciones Criticas</label>
                                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase rounded-full">Se inyectan al final</span>
                                                </div>
                                                <textarea value={newCriticalInstructions} onChange={(e) => setNewCriticalInstructions(e.target.value)} className="w-full h-48 bg-stellar border border-amber-500/30 rounded-xl p-4 text-small font-mono focus:border-amber-400 outline-none resize-none text-text-primary" placeholder="Instrucciones de formato, idioma y schema JSON..." />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">User Template</label>
                                                <textarea value={newUserTemplate} onChange={(e) => setNewUserTemplate(e.target.value)} className="w-full h-36 bg-stellar border border-argent rounded-xl p-4 text-small font-mono focus:border-classic outline-none resize-none text-text-primary" placeholder="Variables: {{summary_json}}..." />
                                                <div className="mt-2 p-3 bg-special rounded-lg border border-argent/50">
                                                    <p className="text-[10px] text-text-muted font-bold uppercase flex items-center gap-2">
                                                        <span className="w-2 h-2 bg-classic rounded-full"></span>
                                                        Variables: {selectedKey === "report" ? "{{summary_json}}, {{client_name}}, {{meta_id}}, {{business_type}}" : "{{summary_json}}"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Schema de Output</label>
                                                    <span className="px-2 py-0.5 bg-synced/10 text-synced text-[8px] font-black uppercase rounded-full">Referencia</span>
                                                </div>
                                                <textarea value={newOutputSchema} onChange={(e) => setNewOutputSchema(e.target.value)} className="w-full h-36 bg-stellar border border-synced/20 rounded-xl p-4 text-small font-mono focus:border-synced outline-none resize-none text-text-primary/60" placeholder="Schema JSON esperado..." />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Console */}
                            <div className="card bg-special/40 border-argent/30 p-4 space-y-4">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Consola de Pruebas</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <select value={testPromptKey} onChange={(e) => setTestPromptKey(e.target.value)} className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body focus:border-classic outline-none">
                                        {PROMPT_KEYS.map(pk => <option key={pk.key} value={pk.key}>{pk.label}</option>)}
                                    </select>
                                    <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body focus:border-classic outline-none">
                                        <option value="">Seleccionar cliente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <button onClick={handleTest} disabled={isActionLoading || !selectedClientId} className="w-full btn-classic py-3 flex items-center justify-center gap-2">
                                        {isActionLoading ? <div className="w-4 h-4 border-2 border-special border-t-transparent rounded-full animate-spin" /> : "EJECUTAR TEST"}
                                    </button>
                                </div>
                                {testResult && (
                                    <div className="bg-stellar p-6 rounded-xl border border-argent/50 overflow-x-auto">
                                        <pre className="text-[12px] font-mono leading-relaxed text-text-primary whitespace-pre-wrap">
                                            {testResult.output || JSON.stringify(testResult, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
