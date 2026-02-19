"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";

interface HeaderProps {
    onOpenMobileMenu: () => void;
}

export default function Header({ onOpenMobileMenu }: HeaderProps) {
    const { user, signOut } = useAuth();
    const { selectedClientId, setSelectedClientId, activeClients } = useClient();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut();
            await fetch("/api/auth/session", { method: "DELETE" });
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

                <div className="flex items-center gap-3 border-l lg:border-none border-argent pl-4 lg:pl-0">
                    <div className="flex flex-col">
                        <span
                            className="text-text-muted font-bold hidden md:inline text-[9px] uppercase leading-none mb-1"
                            style={{ letterSpacing: '1px' }}
                        >
                            SELECCIONAR CLIENTE:
                        </span>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedClientId || ""}
                                onChange={(e) => setSelectedClientId(e.target.value || null)}
                                className="bg-stellar border border-argent px-3 py-1.5 text-small font-medium text-text-primary focus:outline-none focus:border-classic transition-all cursor-pointer min-w-[200px]"
                                style={{ borderRadius: 0 }}
                            >
                                <option value="">SELECCIONAR CLIENTE...</option>
                                {activeClients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.name.toUpperCase()}
                                    </option>
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
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'rgba(250,204,21,0.1)' }}>
                        <span className="text-classic font-bold uppercase text-sm">
                            {user?.email?.charAt(0) || "U"}
                        </span>
                    </div>
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
