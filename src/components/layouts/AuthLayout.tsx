import Link from "next/link";

interface AuthLayoutProps {
    children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="min-h-screen bg-stellar flex flex-col">
            {/* Header */}
            <header className="px-6 py-4">
                <Link href="/">
                    <img src="/img/logo-h-worker-brain.png" alt="Worker Brain" className="h-8 w-auto cursor-pointer" />
                </Link>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-6">
                {children}
            </main>

            {/* Footer */}
            <footer className="px-6 py-8 flex flex-col md:flex-row items-center justify-between text-[10px] text-text-muted font-bold uppercase gap-4" style={{ letterSpacing: '1px' }}>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-6">
                    <span>V3.0.0-250411</span>
                    <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
                    <Link href="/terms" className="hover:text-text-primary transition-colors">Terms of Use</Link>
                </div>
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
