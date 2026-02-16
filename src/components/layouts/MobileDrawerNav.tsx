"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navConfig } from "@/configs/navConfig";

interface MobileDrawerNavProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
}

const sectionLabels: Record<string, string> = {
    operativo: "OPERATIVO",
    inteligencia: "INTELIGENCIA",
    admin: "ADMIN",
};

export default function MobileDrawerNav({ isOpen, onClose, isAdmin }: MobileDrawerNavProps) {
    const pathname = usePathname();

    if (!isOpen) return null;

    let lastSection = "";

    return (
        <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className="absolute left-0 top-0 bottom-0 w-80 bg-special border-r border-argent flex flex-col animate-in slide-in-from-left duration-300"
                style={{ borderLeft: '1px solid #FACC15', borderRadius: 0 }}
            >
                {/* Header */}
                <div className="px-4 py-5 border-b border-argent flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: '#FACC15' }}
                        >
                            <span className="font-bold text-base" style={{ color: '#0F0F10' }}>A</span>
                        </div>
                        <span
                            className="text-text-primary font-bold text-[13px]"
                            style={{ letterSpacing: '2px' }}
                        >
                            ANALIZADOR
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-argent/30 text-text-muted"
                        style={{ borderRadius: 0 }}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {navConfig.map((item) => {
                        if (item.adminOnly && !isAdmin) return null;

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
                                            style={{ letterSpacing: '2px', opacity: 0.5 }}
                                        >
                                            {sectionLabels[section] || section}
                                        </span>
                                    </div>
                                )}
                                <Link
                                    href={item.href}
                                    onClick={onClose}
                                    className="flex items-center gap-2.5 px-3 py-2.5 transition-all duration-150 group mb-px w-full"
                                    style={isActive
                                        ? { borderLeft: '2px solid #FACC15', backgroundColor: 'rgba(250, 204, 21, 0.08)', paddingLeft: '10px' }
                                        : { borderLeft: '2px solid transparent', paddingLeft: '10px' }
                                    }
                                >
                                    <span
                                        className="text-[11px] font-semibold flex-shrink-0 w-6"
                                        style={{ color: isActive ? '#FACC15' : '#52525B' }}
                                    >
                                        {item.number}
                                    </span>
                                    <span
                                        className={`text-[12px] font-semibold ${isActive ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}
                                        style={{ letterSpacing: '1px' }}
                                    >
                                        {item.title.toUpperCase()}
                                    </span>
                                </Link>
                            </React.Fragment>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-argent">
                    <p
                        className="text-[10px] text-text-muted font-bold uppercase text-center"
                        style={{ letterSpacing: '1px' }}
                    >
                        SECURE ENTERPRISE PLATFORM v1.0
                    </p>
                </div>
            </div>
        </div>
    );
}
