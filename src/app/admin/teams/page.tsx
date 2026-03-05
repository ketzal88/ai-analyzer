"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { Team } from "@/types";

export default function AdminTeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New team form
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const fetchTeams = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/teams");
            if (!res.ok) throw new Error("Failed to load teams");
            setTeams(await res.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchTeams(); }, []);

    const createTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch("/api/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Failed to create team");
                return;
            }
            setNewName("");
            fetchTeams();
        } catch (err) {
            console.error("Failed to create team", err);
        } finally {
            setCreating(false);
        }
    };

    const updateTeam = async (id: string) => {
        if (!editName.trim()) return;
        try {
            const res = await fetch(`/api/teams/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName.trim() }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Failed to update team");
                return;
            }
            setEditingId(null);
            fetchTeams();
        } catch (err) {
            console.error("Failed to update team", err);
        }
    };

    const deleteTeam = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar el equipo "${name}"? Los clientes asignados quedarán sin equipo.`)) return;
        try {
            const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
            if (res.ok) fetchTeams();
        } catch (err) {
            console.error("Failed to delete team", err);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-[800px] mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-header text-text-primary">Equipos</h1>
                        <p className="text-body text-text-secondary mt-1">Gestión de equipos de trabajo</p>
                    </div>
                </div>

                {/* Create form */}
                <form onSubmit={createTeam} className="flex items-center gap-3 mb-8">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nombre del nuevo equipo..."
                        className="flex-1 bg-stellar border border-argent rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-classic outline-none"
                    />
                    <button
                        type="submit"
                        disabled={creating || !newName.trim()}
                        className="px-6 py-2.5 bg-classic text-white rounded-lg font-bold text-small uppercase tracking-wider hover:bg-classic/90 disabled:opacity-40 transition-colors"
                    >
                        {creating ? "Creando..." : "Crear Equipo"}
                    </button>
                </form>

                {/* Teams list */}
                <div className="card p-0 overflow-hidden relative min-h-[200px]">
                    {isLoading && (
                        <div className="absolute inset-0 bg-stellar/50 flex items-center justify-center z-10 backdrop-blur-[2px]">
                            <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {error && (
                        <div className="p-12 text-center">
                            <h3 className="text-subheader text-red-500 mb-2">Failed to load teams</h3>
                            <p className="text-body text-text-secondary">{error}</p>
                        </div>
                    )}

                    {!isLoading && !error && teams.length === 0 && (
                        <div className="p-16 text-center">
                            <h3 className="text-subheader text-text-primary mb-2">No hay equipos</h3>
                            <p className="text-body text-text-secondary">Creá tu primer equipo usando el campo de arriba.</p>
                        </div>
                    )}

                    {!isLoading && !error && teams.length > 0 && (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-argent text-left">
                                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-argent">
                                {teams.map(team => (
                                    <tr key={team.id} className="hover:bg-special transition-colors group">
                                        <td className="px-6 py-4">
                                            {editingId === team.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") updateTeam(team.id);
                                                            if (e.key === "Escape") setEditingId(null);
                                                        }}
                                                        autoFocus
                                                        className="bg-stellar border border-classic rounded px-3 py-1 text-text-primary outline-none"
                                                    />
                                                    <button
                                                        onClick={() => updateTeam(team.id)}
                                                        className="text-synced font-bold text-small hover:underline"
                                                    >
                                                        GUARDAR
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="text-text-muted font-bold text-small hover:text-text-primary"
                                                    >
                                                        CANCELAR
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="font-medium text-text-primary">{team.name}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId !== team.id && (
                                                <>
                                                    <button
                                                        onClick={() => { setEditingId(team.id); setEditName(team.name); }}
                                                        className="text-classic font-bold text-small hover:underline"
                                                    >
                                                        EDITAR
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTeam(team.id, team.name)}
                                                        className="text-red-400 font-bold text-small hover:text-red-600"
                                                    >
                                                        ELIMINAR
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
