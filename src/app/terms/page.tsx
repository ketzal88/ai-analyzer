import Link from "next/link";

export default function TermsOfUse() {
    return (
        <div className="min-h-screen bg-stellar text-text-primary">
            <nav className="border-b border-argent/50 sticky top-0 z-50 bg-stellar/95 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
                    <Link href="/">
                        <img src="/img/logo-h-worker-brain.png" alt="Worker Brain" className="h-7 w-auto cursor-pointer" />
                    </Link>
                    <Link
                        href="/"
                        className="text-[11px] font-bold text-text-muted uppercase tracking-widest hover:text-text-primary transition-colors"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                    >
                        Volver al inicio
                    </Link>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-20">
                <h1
                    className="text-4xl md:text-5xl font-black tracking-tighter mb-12"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Terms of <span className="text-classic">Use</span>
                </h1>

                <div className="space-y-12 text-zinc-400 leading-relaxed font-medium">
                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            1. Acceptance of Terms
                        </h2>
                        <p>
                            By accesssing and using Worker Brain, you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree, you are prohibited from using this service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            2. Use License
                        </h2>
                        <p>
                            We grant you a personal, non-exclusive license to use the platform for analyzing and managing Meta Ads accounts. This license does not include the right to:
                        </p>
                        <ul className="list-disc pl-5 mt-4 space-y-2">
                            <li>Modify, copy, or reverse engineer the software.</li>
                            <li>Use the materials for any commercial purpose (other than managing your own or your clients&apos; ads).</li>
                            <li>Remove any copyright or proprietary notations.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            3. Disclaimer
                        </h2>
                        <p>
                            Worker Brain is provided &quot;as is&quot;. We make no warranties, expressed or implied, regarding the accuracy or reliability of the AI-generated analysis. Decisions made based on the platform&apos;s output are the sole responsibility of the user.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            4. Limitations
                        </h2>
                        <p>
                            In no event shall Worker Brain be liable for any damages (including, without limitation, damages for loss of data or profit) arising out of the use or inability to use the platform, even if we have been notified of the possibility of such damage.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            5. Service Continuity
                        </h2>
                        <p>
                            While we strive for 24/7 availability, services may be interrupted for maintenance or due to third-party API issues (e.g., Meta Ads API downtime). We reserve the right to modify or discontinue any part of the service at any time.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            6. Governing Law
                        </h2>
                        <p>
                            These terms are governed by the laws of Argentina, without regard to its conflict of law provisions.
                        </p>
                    </section>
                </div>
            </main>

            <footer className="border-t border-argent/50">
                <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between">
                    <span
                        className="text-[10px] text-text-muted font-bold uppercase tracking-widest"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                    >
                        Worker &copy; {new Date().getFullYear()}
                    </span>
                    <div className="flex gap-6">
                        <Link href="/terms" className="text-[10px] text-text-muted hover:text-text-primary uppercase tracking-widest font-black">Terms</Link>
                        <Link href="/privacy" className="text-[10px] text-text-muted hover:text-text-primary uppercase tracking-widest">Privacy</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
