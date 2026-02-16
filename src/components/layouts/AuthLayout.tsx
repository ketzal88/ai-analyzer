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
                    {/* Square logo mark — yellow fill, dark letter */}
                    <div
                        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#FACC15' }}
                    >
                        <span className="text-sm font-bold" style={{ color: '#0F0F10' }}>M</span>
                    </div>
                    <span
                        className="text-text-primary font-bold text-[12px] uppercase"
                        style={{ letterSpacing: '2px' }}
                    >
                        DIAGNOSTIC TOOL
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-6">
                {children}
            </main>

            {/* Footer */}
            <footer className="px-6 py-4 flex items-center justify-between text-[10px] text-text-muted font-bold uppercase" style={{ letterSpacing: '1px' }}>
                <span>V3.0.0-250411</span>
                <div className="flex items-center gap-2">
                    <span>DIAGNOSTIC STATUS: US-EAST-1</span>
                    {/* Square status indicator — no rounded-full */}
                    <div className="w-2 h-2 bg-synced" style={{ borderRadius: 0 }} />
                    <span className="text-synced">OPERATIONAL</span>
                </div>
            </footer>
        </div>
    );
}
