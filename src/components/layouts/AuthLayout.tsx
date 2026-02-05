import React from "react";

interface AuthLayoutProps {
    children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="min-h-screen bg-stellar flex flex-col">
            {/* Header */}
            <header className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-classic rounded flex items-center justify-center">
                        <span className="text-white text-sm font-bold">M</span>
                    </div>
                    <span className="text-text-primary font-semibold">Diagnostic Tool</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-6">
                {children}
            </main>

            {/* Footer */}
            <footer className="px-6 py-4 flex items-center justify-between text-small text-text-muted">
                <span>V3.0.0-250411</span>
                <div className="flex items-center gap-2">
                    <span>Diagnostic Status: US-EAST-1</span>
                    <div className="w-2 h-2 bg-synced rounded-full"></div>
                    <span className="text-synced">Operational</span>
                </div>
            </footer>
        </div>
    );
}
