"use client";

import React, { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";
import { Client } from "@/types";

interface HeaderProps {
    onOpenMobileMenu: () => void;
    hideClientSelector?: boolean;
}

export default function Header({ onOpenMobileMenu, hideClientSelector = false }: HeaderProps) {
    const { user, signOut } = useAuth();
    const { selectedClientId, setSelectedClientId, activeClients, teams, selectedTeamId, setSelectedTeamId } = useClient();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const avatarUrl = user?.providerData?.[0]?.photoURL || user?.photoURL || null;

    // Filter clients by selected team, then group by team for optgroup rendering
    const filteredClients = useMemo(() => {
        if (!selectedTeamId) return activeClients;
        return activeClients.filter(c => c.team === selectedTeamId);
    }, [activeClients, selectedTeamId]);

    const groupedClients = useMemo(() => {
        const teamMap = new Map(teams.map(t => [t.id, t.name]));
        const groups: { teamName: string; teamId: string; clients: Client[] }[] = [];
        const noTeam: Client[] = [];

        // Build groups from teams that have clients
        const clientsByTeam = new Map<string, Client[]>();
        for (const client of filteredClients) {
            if (client.team) {
                const existing = clientsByTeam.get(client.team) || [];
                existing.push(client);
                clientsByTeam.set(client.team, existing);
            } else {
                noTeam.push(client);
            }
        }

        // Sort groups by team name
        for (const [teamId, clients] of clientsByTeam.entries()) {
            groups.push({
                teamId,
                teamName: teamMap.get(teamId) || teamId,
                clients: clients.sort((a, b) => a.name.localeCompare(b.name)),
            });
        }
        groups.sort((a, b) => a.teamName.localeCompare(b.teamName));

        // Add "Sin Equipo" at the end if needed
        if (noTeam.length > 0) {
            groups.push({
                teamId: "__none__",
                teamName: "Sin Equipo",
                clients: noTeam.sort((a, b) => a.name.localeCompare(b.name)),
            });
        }

        return groups;
    }, [filteredClients, teams]);

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/session", { method: "DELETE" });
            await signOut();
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <header className="h-14 bg-special border-b border-argent px-6 flex items-center justify-between sticky top-0 z-30">
            {/* Left: Mobile Toggle & Client Switcher */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onOpenMobileMenu}
                    className="lg:hidden p-2 hover:bg-argent/30 text-text-muted"
                    style={{ borderRadius: 0 }}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                </button>

                {!hideClientSelector && (
                    <div className="flex items-center gap-3 border-l lg:border-none border-argent pl-4 lg:pl-0">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <span
                                    className="text-text-muted font-bold hidden md:inline text-[9px] uppercase leading-none"
                                    style={{ letterSpacing: '1px' }}
                                >
                                    EQUIPO:
                                </span>
                                <select
                                    value={selectedTeamId || ""}
                                    onChange={(e) => setSelectedTeamId(e.target.value || null)}
                                    className="bg-stellar border border-argent/50 px-2 py-0.5 text-[9px] font-bold text-text-muted uppercase tracking-wider focus:outline-none focus:border-classic transition-all cursor-pointer hidden md:inline"
                                    style={{ borderRadius: 0 }}
                                >
                                    <option value="">TODOS</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={selectedClientId || ""}
                                    onChange={(e) => setSelectedClientId(e.target.value || null)}
                                    className="bg-stellar border border-argent px-3 py-1.5 text-small font-medium text-text-primary focus:outline-none focus:border-classic transition-all cursor-pointer min-w-[200px]"
                                    style={{ borderRadius: 0 }}
                                >
                                    <option value="">SELECCIONAR CLIENTE...</option>
                                    {groupedClients.map(group => (
                                        <optgroup key={group.teamId} label={`── ${group.teamName.toUpperCase()} ──`}>
                                            {group.clients.map(client => (
                                                <option key={client.id} value={client.id}>
                                                    {client.name.toUpperCase()}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>

                                {/* Client Context Info */}
                                {selectedClientId && (
                                    <div className="hidden xl:flex items-center gap-2 px-3 border-l border-argent/50">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-synced animate-pulse" />
                                                <span className="text-[10px] font-black text-text-primary uppercase tracking-tighter">
                                                    {activeClients.find(c => c.id === selectedClientId)?.businessType || 'eCommerce'}
                                                </span>
                                            </div>
                                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest leading-none">
                                                {activeClients.find(c => c.id === selectedClientId)?.conversionSchema?.primary.actionType || 'purchase'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: User Menu */}
            <div className="flex items-center gap-4 relative">
                <div className="hidden sm:flex flex-col text-right">
                    <span className="text-small font-bold text-text-primary leading-tight">
                        {user?.displayName || user?.email?.split("@")[0] || "Usuario"}
                    </span>
                    <span
                        className="text-[10px] text-text-muted font-bold uppercase"
                        style={{ letterSpacing: '1px' }}
                    >
                        {user?.email}
                    </span>
                </div>

                <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-9 h-9 bg-argent/20 border-2 border-argent hover:border-classic transition-all overflow-hidden"
                    style={{ borderRadius: 0 }}
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.1)' }}>
                            <span className="text-classic font-bold uppercase text-sm">
                                {user?.email?.charAt(0) || "U"}
                            </span>
                        </div>
                    )}
                </button>

                {isUserMenuOpen && (
                    <div
                        className="absolute right-0 top-12 w-56 bg-special border border-argent shadow-2xl p-2 z-50"
                        style={{ borderRadius: 0 }}
                    >
                        <div className="px-4 py-3 border-b border-argent sm:hidden">
                            <p className="text-small font-bold text-text-primary">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-argent/20 transition-colors text-small"
                            style={{ borderRadius: 0 }}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            CERRAR SESIÓN
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
