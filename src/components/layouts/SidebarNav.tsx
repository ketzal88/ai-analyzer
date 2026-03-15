"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navConfig } from "@/configs/navConfig";
import { useClient } from "@/contexts/ClientContext";

interface SidebarNavProps {
    isAdmin: boolean;
}

const sectionLabels: Record<string, string> = {
    operativo: "OPERATIVO",
    canales: "CANALES",
    inteligencia: "INTELIGENCIA",
    admin: "ADMIN",
};

export default function SidebarNav({ isAdmin }: SidebarNavProps) {
    const pathname = usePathname();
    const { selectedClientId, activeClients } = useClient();

    // Find the currently selected client object
    const selectedClient = activeClients.find(c => c.id === selectedClientId) || null;

    // Build a set of active integrations for the current client
    const activeIntegrations = new Set<string>();
    if (selectedClient) {
        const integ = selectedClient.integraciones;
        if (integ) {
            if (selectedClient.metaAdAccountId || integ.meta) activeIntegrations.add('meta');
            if (integ.google) activeIntegrations.add('google');
            if (integ.ga4) activeIntegrations.add('ga4');
            if (integ.ecommerce) activeIntegrations.add('ecommerce');
            if (integ.email) activeIntegrations.add('email');
            if (integ.leads) activeIntegrations.add('leads');
        }
        if (selectedClient.metaAdAccountId) activeIntegrations.add('meta');
    }

    const visibleItems = navConfig.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        // If item requires an integration, check if the client has it
        if (item.requiresIntegration && !activeIntegrations.has(item.requiresIntegration)) return false;
        return true;
    });

    let lastSection = "";

    return (
        <aside
            className="w-64 bg-special flex flex-col hidden lg:flex h-screen fixed left-0 top-0 border-r border-argent z-40"
            style={{ borderLeft: '1px solid #FACC15' }}
        >
            {/* Logo Section */}
            <div className="px-4 py-5 border-b border-argent flex items-center gap-3">
                <img src="/img/logo-h-worker-brain.png" alt="Worker Brain" className="h-8 w-auto" />
            </div>

            {/* Nav Section */}
            <nav className="flex-1 py-4 overflow-y-auto">
                {visibleItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    const section = item.section || 'operativo';
                    const showDivider = section !== lastSection;
                    lastSection = section;

                    return (
                        <React.Fragment key={item.href}>
                            {showDivider && (
                                <div className={`px-4 ${section !== 'operativo' ? 'mt-5 mb-1' : 'mb-1'}`}>
                                    <span
                                        className="text-text-muted font-black text-[9px] uppercase"
                                        style={{ letterSpacing: '2px', opacity: 0.5, fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {sectionLabels[section] || section}
                                    </span>
                                </div>
                            )}
                            <Link
                                href={item.href}
                                className="flex items-center gap-2.5 px-3 py-2.5 transition-all duration-150 group mb-px w-full"
                                style={isActive
                                    ? { borderLeft: '2px solid #FACC15', backgroundColor: 'rgba(250, 204, 21, 0.08)', paddingLeft: '10px' }
                                    : { borderLeft: '2px solid transparent', paddingLeft: '10px' }
                                }
                            >
                                {/* Number prefix */}
                                <span
                                    className="text-[11px] font-semibold flex-shrink-0 w-6"
                                    style={{
                                        color: isActive ? '#FACC15' : '#52525B',
                                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                                    }}
                                >
                                    {item.number}
                                </span>
                                {/* Label */}
                                <span
                                    className={`text-[12px] font-semibold truncate ${isActive ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}
                                    style={{ letterSpacing: '1px', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {item.title.toUpperCase()}
                                </span>
                            </Link>
                        </React.Fragment>
                    );
                })}
            </nav>

            {/* Footer Section */}
            <div className="px-4 py-4 border-t border-argent">
                <div
                    className="flex items-center gap-2 text-[10px] text-text-muted font-bold uppercase"
                    style={{ letterSpacing: '1px', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                >
                    {/* Square status indicator — no rounded-full */}
                    <div className="w-1.5 h-1.5 bg-synced animate-pulse" style={{ borderRadius: 0 }} />
                    <span>SYS: ONLINE</span>
                </div>
            </div>
        </aside>
    );
}
