"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navConfig } from "@/configs/navConfig";

interface SidebarNavProps {
    isAdmin: boolean;
}

const sectionLabels: Record<string, string> = {
    operativo: "OPERATIVO",
    inteligencia: "INTELIGENCIA",
    admin: "ADMIN",
};

export default function SidebarNav({ isAdmin }: SidebarNavProps) {
    const pathname = usePathname();

    const visibleItems = navConfig.filter(item => !item.adminOnly || isAdmin);
    let lastSection = "";

    return (
        <aside
            className="w-64 bg-special flex flex-col hidden lg:flex h-screen fixed left-0 top-0 border-r border-argent z-40"
            style={{ borderLeft: '1px solid #FACC15' }}
        >
            {/* Logo Section */}
            <div className="px-4 py-5 border-b border-argent flex items-center gap-3">
                <div
                    className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#FACC15' }}
                >
                    <span className="font-bold text-base" style={{ color: '#0F0F10', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>A</span>
                </div>
                <div className="flex flex-col min-w-0">
                    <span
                        className="text-text-primary font-bold text-[13px] leading-none truncate"
                        style={{ letterSpacing: '2px', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                    >
                        ANALIZADOR
                    </span>
                    <span
                        className="text-text-muted font-bold text-[9px] uppercase mt-1"
                        style={{ letterSpacing: '1px', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                    >
                        Motor de Diagnóstico
                    </span>
                </div>
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
