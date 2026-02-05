"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navConfig } from "@/configs/navConfig";

interface SidebarNavProps {
    isAdmin: boolean;
}

export default function SidebarNav({ isAdmin }: SidebarNavProps) {
    const pathname = usePathname();

    return (
        <aside className="w-64 border-r border-argent bg-special flex flex-col hidden lg:flex h-screen sticky top-0">
            {/* Logo Section */}
            <div className="p-6 border-b border-argent flex items-center gap-3">
                <div className="w-8 h-8 bg-classic rounded-lg flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-lg">A</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-text-primary font-bold text-body tracking-tight leading-none">ANALIZADOR DE ADS</span>
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Motor de Diagnóstico</span>
                </div>
            </div>

            {/* Nav Section */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-4">
                {navConfig.map((item) => {
                    if (item.adminOnly && !isAdmin) return null;

                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                                ? "bg-classic text-white shadow-md shadow-classic/20"
                                : "text-text-secondary hover:bg-argent/30 hover:text-text-primary"
                                }`}
                        >
                            {item.icon && (
                                <svg
                                    className={`w-5 h-5 ${isActive ? "text-white" : "text-text-muted group-hover:text-classic"}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                </svg>
                            )}
                            <span className="text-body font-medium">{item.title}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer Section */}
            <div className="p-6 border-t border-argent bg-stellar/30">
                <div className="flex items-center gap-2 text-[10px] text-text-muted font-bold uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-synced animate-pulse" />
                    <span>Estado: Sistema OK</span>
                </div>
            </div>
        </aside>
    );
}
