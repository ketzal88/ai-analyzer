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

    const selectedClient = activeClients.find(c => c.id === selectedClientId);

    return (
        <header className="h-20 bg-special border-b border-argent px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm backdrop-blur-md bg-special/95">
            {/* Left: Mobile Toggle & Client Switcher */}
            <div className="flex items-center gap-6">
                <button
                    onClick={onOpenMobileMenu}
                    className="lg:hidden p-2 hover:bg-argent/30 rounded-lg text-text-muted"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                </button>

                <div className="flex items-center gap-3 border-l lg:border-none border-argent pl-6 lg:pl-0">
                    <span className="text-small text-text-muted font-bold uppercase tracking-widest hidden md:inline">Cliente:</span>
                    <select
                        value={selectedClientId || ""}
                        onChange={(e) => setSelectedClientId(e.target.value || null)}
                        className="bg-stellar border border-argent rounded-lg px-4 py-2 text-body font-medium text-text-primary focus:outline-none focus:border-classic transition-all cursor-pointer min-w-[200px]"
                    >
                        <option value="">Seleccionar cliente...</option>
                        {activeClients.map(client => (
                            <option key={client.id} value={client.id}>
                                {client.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Right: User Menu */}
            <div className="flex items-center gap-4 relative">
                <div className="hidden sm:flex flex-col text-right">
                    <span className="text-body font-bold text-text-primary leading-tight">
                        {user?.displayName || user?.email?.split("@")[0] || "Usuario"}
                    </span>
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                        {user?.email}
                    </span>
                </div>

                <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-10 h-10 rounded-full bg-argent/20 border-2 border-argent hover:border-classic transition-all overflow-hidden"
                >
                    <div className="w-full h-full flex items-center justify-center bg-classic/10">
                        <span className="text-classic font-bold uppercase">
                            {user?.email?.charAt(0) || "U"}
                        </span>
                    </div>
                </button>

                {isUserMenuOpen && (
                    <div className="absolute right-0 top-14 w-56 bg-special border border-argent rounded-xl shadow-2xl p-2 z-50">
                        <div className="px-4 py-3 border-b border-argent sm:hidden">
                            <p className="text-body font-bold text-text-primary">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium text-body"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Cerrar sesión
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
