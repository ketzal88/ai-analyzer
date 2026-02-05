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

export default function MobileDrawerNav({ isOpen, onClose, isAdmin }: MobileDrawerNavProps) {
    const pathname = usePathname();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="absolute left-0 top-0 bottom-0 w-80 bg-special border-r border-argent flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
                <div className="p-6 border-b border-argent flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-classic rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold">A</span>
                        </div>
                        <span className="text-text-primary font-bold">AD ANALYZER</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-argent/30 rounded-lg text-text-muted">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navConfig.map((item) => {
                        if (item.adminOnly && !isAdmin) return null;

                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                        ? "bg-classic text-white"
                                        : "text-text-secondary hover:bg-argent/30"
                                    }`}
                            >
                                {item.icon && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                    </svg>
                                )}
                                <span className="text-body font-medium">{item.title}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-argent mt-auto">
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest text-center">
                        Secure Enterprise Platform v1.0
                    </p>
                </div>
            </div>
        </div>
    );
}
