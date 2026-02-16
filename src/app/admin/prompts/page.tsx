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
                                <div className="p-20 text-center card italic text-text-muted">
                                    Cargando configuración...
                                </div>
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
                            <div className="card bg-special border-argent p-0 overflow-hidden">
                                <div className="p-4 border-b border-argent bg-stellar/50 text-center">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Historial de Versiones</h3>
                                </div>
                                <div className="divide-y divide-argent max-h-[400px] overflow-y-auto">
                                    {prompts.length === 0 && (
                                        <div className="p-8 text-center text-text-muted text-small italic">
                                            No hay versiones para este tipo.
                                        </div>
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
                                                {p.status === "draft" && (
                                                    <span className="px-2 py-0.5 bg-argent/20 text-text-muted text-[10px] font-black uppercase rounded">Draft</span>
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
                            <div className="card space-y-4">
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
                                    {isActionLoading ? "Ejecutando..." : `Run Test (${selectedKey.replace("-", " ")})`}
                                </button>
                            </div>
                        </div>

                        {/* Editor Main Area */}
                        <div className="xl:col-span-8 space-y-6">
                            <div className="card space-y-6">
                                <div className="flex justify-between items-center bg-stellar/30 p-4 -m-6 mb-2 border-b border-argent">
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-text-primary italic">Editor de {selectedKey === "report" ? "Reporte" : "Auditoría"}</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveDraft}
                                            disabled={isActionLoading}
                                            className="px-4 py-2 bg-argent/20 hover:bg-argent/30 rounded-lg text-[10px] font-black uppercase transition-all"
                                        >
                                            Guardar Draft v{prompts.length > 0 ? prompts[0].version + 1 : 1}
                                        </button>
                                        {selectedPrompt && selectedPrompt.status !== "active" && (
                                            <button
                                                onClick={() => handleActivate(selectedPrompt.id)}
                                                disabled={isActionLoading}
                                                className="px-4 py-2 bg-synced text-stellar text-[10px] font-black uppercase"
                                            >
                                                Promover a Activo
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Instrucción del Sistema (System Prompt)</label>
                                        <textarea
                                            value={newSystem}
                                            onChange={(e) => setNewSystem(e.target.value)}
                                            className="w-full h-32 bg-stellar border border-argent rounded-xl p-4 text-body font-mono focus:border-classic outline-none transition-all resize-none shadow-inner"
                                            placeholder="Eres un experto en..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Template del Usuario (User Template)</label>
                                        <textarea
                                            value={newUserTemplate}
                                            onChange={(e) => setNewUserTemplate(e.target.value)}
                                            className="w-full h-64 bg-stellar border border-argent rounded-xl p-4 text-body font-mono focus:border-classic outline-none transition-all resize-none shadow-inner"
                                            placeholder="Analiza los datos: {{summary_json}}"
                                        />
                                        <p className="text-[10px] text-text-muted mt-3 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-classic rounded-full"></span>
                                            Variables: {selectedKey === "report"
                                                ? "{{summary_json}}, {{client_name}}, {{meta_id}}, {{ecommerce_mode}}"
                                                : "{{summary_json}}, {{creative_data}}"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Test Result Area */}
                            {testResult && (
                                <div className="card bg-synced/5 border-synced/20 animate-in fade-in slide-in-from-bottom-4">
                                    <header className="flex justify-between items-center mb-4">
                                        <h3 className="text-body font-bold text-synced uppercase tracking-widest text-[11px]">Resultado del Test</h3>
                                        <div className="flex gap-4 text-[10px] font-black text-text-muted">
                                            <span>MODELO: {testResult.metadata.modelUsed}</span>
                                            <span>LATENCIA: {testResult.metadata.latencyMs}ms</span>
                                        </div>
                                    </header>
                                    <pre className="bg-stellar p-6 rounded-xl border border-argent overflow-x-auto text-[12px] font-mono whitespace-pre-wrap max-h-[500px] shadow-inner text-text-primary">
                                        {testResult.output}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
