"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { PromptTemplate, Client } from "@/types";

export default function AdminPrompts() {
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // New version form
    const [newSystem, setNewSystem] = useState("Eres un ingeniero experto en crecimiento y optimización de Meta Ads.");
    const [newUserTemplate, setNewUserTemplate] = useState("Analiza: {{summary_json}}");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [pRes, cRes] = await Promise.all([
                fetch("/api/admin/prompts?key=report"),
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

    const handleSaveDraft = async () => {
        setIsActionLoading(true);
        try {
            const res = await fetch("/api/admin/prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: "report",
                    system: newSystem,
                    userTemplate: newUserTemplate,
                    variables: ["summary_json", "client_name", "meta_id", "ecommerce_mode"]
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
                <header className="flex justify-between items-center">
                    <div>
                        <h1 className="text-display font-black text-text-primary">GESTIÓN DE PROMPTS</h1>
                        <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                            Control de Versiones IA y Pruebas A/B
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Sidebar: Versions List */}
                    <div className="xl:col-span-4 space-y-6">
                        <div className="card bg-special border-argent p-0 overflow-hidden">
                            <div className="p-4 border-b border-argent bg-stellar/50">
                                <h3 className="text-body font-bold text-text-primary">Versiones Disponibles</h3>
                            </div>
                            <div className="divide-y divide-argent max-h-[600px] overflow-y-auto">
                                {Array.isArray(prompts) && prompts.map((p) => (
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
                                className="w-full bg-stellar border border-argent rounded-lg px-4 py-2 text-body"
                            >
                                <option value="">Seleccionar Cliente para Test...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button
                                onClick={handleTest}
                                disabled={isActionLoading || !selectedClientId}
                                className="w-full btn-classic py-3 flex items-center justify-center gap-2"
                            >
                                {isActionLoading ? "Ejecutando..." : "Run Test (Gemini)"}
                            </button>
                        </div>
                    </div>

                    {/* Editor Main Area */}
                    <div className="xl:col-span-8 space-y-6">
                        <div className="card space-y-6">
                            <div className="flex justify-between items-center bg-stellar/30 p-4 -m-6 mb-2 border-b border-argent">
                                <h3 className="text-body font-bold text-text-primary">Editor de Template</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={isActionLoading}
                                        className="px-4 py-2 bg-argent/20 hover:bg-argent/30 rounded-lg text-small font-bold transition-all"
                                    >
                                        Guardar Draft v{prompts.length > 0 ? prompts[0].version + 1 : 1}
                                    </button>
                                    {selectedPrompt && selectedPrompt.status !== "active" && (
                                        <button
                                            onClick={() => handleActivate(selectedPrompt.id)}
                                            disabled={isActionLoading}
                                            className="px-4 py-2 bg-synced text-white rounded-lg text-small font-bold shadow-md shadow-synced/20"
                                        >
                                            Promover a Activo
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Instrucción del Sistema (System Prompt)</label>
                                    <textarea
                                        value={newSystem}
                                        onChange={(e) => setNewSystem(e.target.value)}
                                        className="w-full h-32 bg-stellar border border-argent rounded-xl p-4 text-body font-mono focus:border-classic outline-none transition-all"
                                        placeholder="Eres un experto en..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Template del Usuario (User Template)</label>
                                    <textarea
                                        value={newUserTemplate}
                                        onChange={(e) => setNewUserTemplate(e.target.value)}
                                        className="w-full h-64 bg-stellar border border-argent rounded-xl p-4 text-body font-mono focus:border-classic outline-none transition-all"
                                        placeholder="Analiza los datos: {{summary_json}}"
                                    />
                                    <p className="text-[10px] text-text-muted mt-2 italic">
                                        Variables disponibles: {"{{summary_json}}"}, {"{{client_name}}"}, {"{{meta_id}}"}, {"{{ecommerce_mode}}"}
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
                                <pre className="bg-stellar p-6 rounded-xl border border-argent overflow-x-auto text-[12px] font-mono whitespace-pre-wrap max-h-[500px]">
                                    {testResult.output}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
