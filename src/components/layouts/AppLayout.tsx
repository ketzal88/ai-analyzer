"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const { user, signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
            // Clear session cookie
            await fetch("/api/auth/session", {
                method: "DELETE",
            });
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <div className="min-h-screen bg-stellar flex flex-col">
            {/* Header Navigation */}
            <header className="border-b border-argent bg-special">
                <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-classic rounded flex items-center justify-center">
                            <span className="text-white text-sm font-bold">D</span>
                        </div>
                        <span className="text-text-primary font-semibold">DiagnosticPro</span>
                    </div>

                    {/* Navigation */}
                    <nav className="flex items-center gap-8">
                        <Link
                            href="/dashboard"
                            className="text-text-secondary hover:text-text-primary transition-colors text-body"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/documentation"
                            className="text-text-secondary hover:text-text-primary transition-colors text-body"
                        >
                            Documentation
                        </Link>
                        <Link
                            href="/api-keys"
                            className="text-text-secondary hover:text-text-primary transition-colors text-body"
                        >
                            API Keys
                        </Link>
                    </nav>

                    {/* User Menu */}
                    <div className="flex items-center gap-3">
                        <div className="text-right mr-2">
                            <p className="text-body text-text-primary font-medium">
                                {user?.displayName || user?.email?.split("@")[0] || "User"}
                            </p>
                            <p className="text-small text-text-muted">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-second border border-argent rounded-lg hover:bg-argent transition-colors text-body text-text-primary"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                <div className="max-w-[1400px] mx-auto px-6 py-8">
                    {children}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-argent bg-special">
                <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between text-small text-text-muted">
                    <div className="flex items-center gap-4">
                        <span>© ENTERPRISE SECURE</span>
                        <span>© GDPR COMPLIANT</span>
                    </div>
                    <span>© 2024 Meta Ads Diagnostic Tool. All rights reserved. Meta is a trademark of Meta Platforms, Inc.</span>
                </div>
            </footer>
        </div>
    );
}
