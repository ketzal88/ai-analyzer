"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";
import { usePathname, useRouter } from "next/navigation";
import SidebarNav from "./SidebarNav";
import Header from "./Header";
import MobileDrawerNav from "./MobileDrawerNav";

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const { selectedClientId, isLoading: clientLoading } = useClient();
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Protection: Redirect if not admin and accessing /admin
    useEffect(() => {
        if (!authLoading && pathname.startsWith("/admin") && !isAdmin) {
            router.replace("/dashboard");
        }
    }, [pathname, isAdmin, authLoading, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-stellar flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-classic border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const isAdminRoute = pathname.startsWith("/admin");
    const needsClient = pathname === "/dashboard" || pathname === "/findings" || pathname === "/report" || pathname === "/ads-manager" || pathname === "/decision-board";
    const hasNoClient = needsClient && !selectedClientId && !clientLoading;

    return (
        <div className="min-h-screen bg-stellar flex relative">
            {/* Desktop Sidebar */}
            <SidebarNav isAdmin={isAdmin} />

            {/* Mobile Sidebar */}
            <MobileDrawerNav
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                isAdmin={isAdmin}
            />

            {/* Work Area */}
            <div className="flex-1 flex flex-col min-w-0 lg:pl-64 relative">
                <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

                <main className="p-6 lg:p-10">
                    <div className="max-w-[1400px] mx-auto min-h-screen">
                        {hasNoClient ? (
                            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-12 animate-in fade-in zoom-in duration-500">
                                <div className="w-24 h-24 bg-classic/10 flex items-center justify-center mb-6" style={{ borderRadius: 0 }}>
                                    <svg className="w-12 h-12 text-classic" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <h1 className="text-display font-black text-text-primary mb-2 leading-none">SIN CLIENTE SELECCIONADO</h1>
                                <p className="text-subheader text-text-secondary max-w-md mx-auto mb-8">
                                    Para acceder al análisis de {pathname.substring(1).toUpperCase()}, por favor selecciona un cliente activo en el selector superior.
                                </p>
                                <div className="flex gap-4">
                                    <div className="px-6 py-3 bg-special border border-argent animate-bounce" style={{ borderRadius: 0 }}>
                                        <span className="text-body font-bold text-classic" style={{ letterSpacing: '1px' }}>↑ USA EL SELECTOR</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            children
                        )}
                    </div>
                </main>

                {/* Global Footer (Subtle) */}
                <footer className="p-4 border-t border-argent bg-special/50 flex justify-between items-center text-[10px] text-text-muted font-bold uppercase px-10" style={{ letterSpacing: '1px' }}>
                    <div className="flex gap-6">
                        <span>© 2024 AD ANALYZER</span>
                        <span className="hidden sm:inline text-synced">Sistema Online</span>
                    </div>
                    <div className="flex gap-6">
                        <span>Seguridad: Verificada</span>
                        <span>Nivel: Enterprise</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
