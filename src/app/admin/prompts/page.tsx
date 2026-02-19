"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { PromptTemplate, Client } from "@/types";
import { EngineConfig } from "@/types/engine-config";
import EngineConfigEditor from "@/components/admin/EngineConfigEditor";

export default function AdminPrompts() {
    const [selectedKey, setSelectedKey] = useState("report");
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Engine Config State
    const [engineConfig, setEngineConfig] = useState<EngineConfig | null>(null);
    const [isConfigLoading, setIsConfigLoading] = useState(false);

    // New version form
    const [newSystem, setNewSystem] = useState("");
    const [newUserTemplate, setNewUserTemplate] = useState("");

    useEffect(() => {
        if (selectedKey !== "logic") {
            fetchData();
        } else if (selectedClientId) {
            fetchEngineConfig(selectedClientId);
        }
    }, [selectedKey, selectedClientId]);

    const fetchData = async () => {
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
                    const active = pData.find((p: any) => p.status === "active") || pData[0];
                    setSelectedPrompt(active);
                    setNewSystem(active.system);
                    setNewUserTemplate(active.userTemplate);
                } else {
                    setSelectedPrompt(null);
                    setNewSystem(selectedKey === "report" ? "Eres un analista experto en Meta Ads." : "Eres un experto en Creative Strategy para Meta Ads.");
                    setNewUserTemplate(selectedKey === "report" ? "Analiza: {{summary_json}}" : "Analiza los datos: {{summary_json}}");
                }
            } else if (pData.error) {
                console.error("Prompts API error:", pData.error);
                alert(`Error cargando prompts: ${pData.error}`);
            }

            if (Array.isArray(cData)) {
                setClients(cData);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEngineConfig = async (clientId: string) => {
        setIsConfigLoading(true);
        try {
            const res = await fetch(`/api/clients/${clientId}/engine-config`);
            if (res.ok) {
                const data = await res.json();
                setEngineConfig(data);
            }
        } catch (error) {
            console.error("Error fetching engine config:", error);
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
            if (res.ok) {
                alert("Configuración del motor guardada correctamente.");
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            alert("Error al guardar configuración.");
        } finally {
            setIsActionLoading(false);
        }
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
                    variables: selectedKey === "report"
                        ? ["summary_json", "client_name", "meta_id", "ecommerce_mode"]
                        : ["summary_json"]
                })
            });
            if (res.ok) {
                await fetchData();
                alert("Borrador guardado con éxito.");
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (error) {
            alert("Error al guardar borrador.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleActivate = async (id: string) => {
        if (!confirm("¿Seguro que quieres activar esta versión? La anterior se archivará.")) return;
        setIsActionLoading(true);
        try {
            const res = await fetch("/api/admin/prompts/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                await fetchData();
            }
        } catch (error) {
            alert("Error al activar.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleTest = async () => {
        if (!selectedClientId || !selectedPrompt) {
            alert("Selecciona un cliente y un prompt.");
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
            const data = await res.json();
            setTestResult(data);
        } catch (error) {
            alert("Error en el test.");
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading) return <AppLayout><div>Cargando gestión de prompts...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-display font-black text-text-primary uppercase">Mesa de Control IA</h1>
                        <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                            Configuración de Prompts y Lógica de Negocio
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:flex bg-special border border-argent p-1 rounded-xl">
                        <button
                            onClick={() => setSelectedKey("report")}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedKey === "report" ? "bg-classic text-special" : "text-text-muted hover:text-text-primary"}`}
                        >
                            Reporte
                        </button>
                        <button
                            onClick={() => setSelectedKey("creative-audit")}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedKey === "creative-audit" ? "bg-classic text-special" : "text-text-muted hover:text-text-primary"}`}
                        >
                            Auditoría
                        </button>
                        <button
                            onClick={() => setSelectedKey("creative-variations")}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedKey === "creative-variations" ? "bg-classic text-special" : "text-text-muted hover:text-text-primary"}`}
                        >
                            Ads Copy
                        </button>
                        <button
                            onClick={() => setSelectedKey("concept_briefs_v1")}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedKey === "concept_briefs_v1" ? "bg-classic text-special" : "text-text-muted hover:text-text-primary"}`}
                        >
                            Briefs
                        </button>
                        <div className="w-px bg-argent mx-1 hidden sm:block" />
                        <button
                            onClick={() => setSelectedKey("logic")}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedKey === "logic" ? "bg-synced/80 text-stellar" : "text-text-muted hover:text-text-primary"}`}
                        >
                            ⚡ Lógica GEM
                        </button>
                    </div>
                </header>

                {/* Dynamic Category Explanation */}
                <div className="bg-special/40 border border-argent/50 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-text-primary">
                        {selectedKey === "report" && <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>}
                        {selectedKey === "creative-audit" && <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>}
                        {selectedKey === "creative-variations" && <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>}
                        {selectedKey === "concept_briefs_v1" && <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>}
                        {selectedKey === "logic" && <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.83 0-1.3-.53-1.15-1.01l3.5-9.15h1l-1 7h3.5c.83 0 1.3.53 1.15 1.01l-3.5 9.15z" /></svg>}
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-classic" />
                            <h3 className="text-small font-black text-text-primary uppercase tracking-tighter">
                                {selectedKey === "report" && "Propósito: Consolidado Diario"}
                                {selectedKey === "creative-audit" && "Propósito: Auditoría Creativa"}
                                {selectedKey === "creative-variations" && "Propósito: Generación de Variantes"}
                                {selectedKey === "concept_briefs_v1" && "Propósito: Estructuración de Briefs"}
                                {selectedKey === "logic" && "Propósito: Inteligencia de Negocio (GEM)"}
                            </h3>
                        </div>
                        <p className="text-small text-text-secondary leading-relaxed max-w-4xl">
                            {selectedKey === "report" && "Define cómo la IA redacta el resumen matutino en Slack. Aquí se configura el tono del informe, qué métricas priorizar visualmente y cómo debe hablarle la IA al equipo cada mañana."}
                            {selectedKey === "creative-audit" && "Define los criterios para calificar anuncios existentes. Aquí instruyes a la IA sobre qué buscar en el Visual Hook, el cuerpo del mensaje y el ángulo de venta para generar el reporte de auditoría."}
                            {selectedKey === "creative-variations" && "Define las reglas de escritura para nuevos anuncios. Aquí se configuran los frameworks creativos (como AIDA o PAS), el tono de voz de la marca y las restricciones de formato para los copies."}
                            {selectedKey === "concept_briefs_v1" && "Define cómo la IA transforma una idea en un requerimiento técnico para diseño. Aquí se formatea la estructura del brief que recibirá el equipo creativo para producir nuevos activos."}
                            {selectedKey === "logic" && "Este es el cerebro técnico. Aquí se configuran los umbrales de decisión (CPA, ROAS, Frecuencia) que determinan cuándo un anuncio cambia de etapa en el embudo o cuándo se dispara una alerta de escala."}
                        </p>
                    </div>

                    <div className="flex flex-col gap-1 min-w-[140px] border-l border-argent/30 pl-6">
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Impacto</span>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className={`w-3 h-1 rounded-full ${(selectedKey === "logic" || selectedKey === "report")
                                    ? (i <= 5 ? 'bg-synced' : 'bg-argent/20')
                                    : (i <= 4 ? 'bg-classic' : 'bg-argent/20')
                                    }`} />
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-text-primary mt-1 uppercase">
                            {selectedKey === "logic" ? "Core Engine" : "AI Output"}
                        </span>
                    </div>
                </div>

                {selectedKey === "logic" ? (
                    <div className="space-y-6">
                        <div className="card max-w-2xl">
                            <h3 className="text-body font-bold text-text-primary uppercase tracking-widest text-[11px] mb-4">Seleccionar Cliente</h3>
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body focus:border-classic outline-none"
                            >
                                <option value="">Seleccionar Cliente para visualizar lógica...</option>
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
                                <div className="p-20 text-center card italic text-text-muted">Cargando configuración...</div>
                            )
                        ) : (
                            <div className="p-20 text-center card border-dashed border-argent/50">
                                <div className="w-16 h-16 bg-classic/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl">☝️</span>
                                </div>
                                <h3 className="text-subheader font-black text-text-primary uppercase mb-2">Selecciona un cliente</h3>
                                <p className="text-small text-text-muted max-w-xs mx-auto">La lógica del motor GEM puede configurarse individualmente para cada cliente según su madurez y objetivos.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        {/* Sidebar: Versions List */}
                        <div className="xl:col-span-4 space-y-6">
                            <div className="card bg-special border-argent p-0 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-argent bg-stellar/50 text-center">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Historial de Versiones</h3>
                                </div>
                                <div className="divide-y divide-argent max-h-[400px] overflow-y-auto">
                                    {prompts.length === 0 && (
                                        <div className="p-8 text-center text-text-muted text-small italic">No hay versiones para este tipo.</div>
                                    )}
                                    {prompts.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedPrompt(p);
                                                setNewSystem(p.system);
                                                setNewUserTemplate(p.userTemplate);
                                            }}
                                            className={`p-4 cursor-pointer transition-colors hover:bg-argent/10 ${selectedPrompt?.id === p.id ? "bg-classic/5 border-l-4 border-classic" : ""}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-body font-bold text-text-primary">v{p.version}</span>
                                                {p.status === "active" && (
                                                    <span className="px-2 py-0.5 bg-synced/10 text-synced text-[10px] font-black uppercase rounded">Active</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                                                {new Date(p.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Test Panel */}
                            <div className="card space-y-4 shadow-sm">
                                <h3 className="text-body font-bold text-text-primary uppercase tracking-widest text-[11px]">Consola de Pruebas</h3>
                                <select
                                    value={selectedClientId}
                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                    className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body focus:border-classic outline-none"
                                >
                                    <option value="">Seleccionar Cliente para Test...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button
                                    onClick={handleTest}
                                    disabled={isActionLoading || !selectedClientId || !selectedPrompt}
                                    className="w-full btn-classic py-3 flex items-center justify-center gap-2"
                                >
                                    {isActionLoading ? <div className="w-4 h-4 border-2 border-special border-t-transparent rounded-full animate-spin"></div> : "CORRER TEST"}
                                </button>
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="xl:col-span-8 space-y-6">
                            <div className="card p-0 overflow-hidden shadow-xl border-argent">
                                <header className="bg-special border-b border-argent p-4 flex justify-between items-center">
                                    <h2 className="text-small font-black text-text-primary uppercase tracking-widest">
                                        Editor de {selectedKey === 'report' ? 'Reporte' : selectedKey === 'creative-audit' ? 'Auditoría' : 'Prompts'}
                                    </h2>
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={isActionLoading}
                                        className="btn-classic px-6 py-2 text-[10px]"
                                    >
                                        {isActionLoading ? "GUARDANDO..." : `GUARDAR v${(prompts[0]?.version || 0) + 1}`}
                                    </button>
                                </header>

                                <div className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block tracking-[0.2em]">Instrucción del Sistema (System Prompt)</label>
                                            <textarea
                                                value={newSystem}
                                                onChange={(e) => setNewSystem(e.target.value)}
                                                className="w-full h-48 bg-stellar border border-argent rounded-xl p-4 text-small font-mono focus:border-classic outline-none transition-all resize-none shadow-inner text-text-primary"
                                                placeholder="Instrucciones maestras para la IA..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block tracking-[0.2em]">Template del Usuario (User Template)</label>
                                            <textarea
                                                value={newUserTemplate}
                                                onChange={(e) => setNewUserTemplate(e.target.value)}
                                                className="w-full h-64 bg-stellar border border-argent rounded-xl p-4 text-small font-mono focus:border-classic outline-none transition-all resize-none shadow-inner text-text-primary"
                                                placeholder="Variables: {{summary_json}}..."
                                            />
                                            <div className="mt-4 p-3 bg-special rounded-lg border border-argent/50">
                                                <p className="text-[10px] text-text-muted font-bold uppercase flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-classic rounded-full"></span>
                                                    Variables Disponibles: {selectedKey === "report" ? "{{summary_json}}, {{client_name}}, {{meta_id}}" : "{{summary_json}}, {{creative_data}}"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Test Results Dashboard */}
                            {testResult && (
                                <div className="card bg-synced/5 border-synced/30 shadow-2xl animate-in zoom-in-95 duration-300">
                                    <header className="flex justify-between items-center mb-6 pb-4 border-b border-synced/20">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-synced rounded-full animate-pulse" />
                                            <h3 className="text-small font-bold text-synced uppercase tracking-widest">Inferencia Completada</h3>
                                        </div>
                                        <div className="flex gap-4 text-[9px] font-black text-text-muted uppercase">
                                            <span className="bg-special px-2 py-1 rounded">Model: {testResult.metadata.modelUsed}</span>
                                            <span className="bg-special px-2 py-1 rounded">Latency: {testResult.metadata.latencyMs}ms</span>
                                        </div>
                                    </header>
                                    <div className="bg-stellar p-8 rounded-2xl border border-argent/50 shadow-inner overflow-x-auto">
                                        <pre className="text-[13px] font-mono leading-relaxed text-text-primary whitespace-pre-wrap">
                                            {testResult.output}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
