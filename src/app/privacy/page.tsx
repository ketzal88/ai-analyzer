import Link from "next/link";

export default function PrivacyPolicy() {
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
                    Privacy <span className="text-classic">Policy</span>
                </h1>

                <div className="space-y-12 text-zinc-400 leading-relaxed font-medium">
                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            1. Data Collection
                        </h2>
                        <p>
                            We collect information necessary to provide our services, including:
                        </p>
                        <ul className="list-disc pl-5 mt-4 space-y-2">
                            <li>Account information: Name, email, and authentication data.</li>
                            <li>Integration data: Metadata and performance metrics from your Meta Ads accounts.</li>
                            <li>Usage data: Information on how you interact with our platform to improve performance.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            2. Use of Information
                        </h2>
                        <p>
                            Your data is used specifically for:
                        </p>
                        <ul className="list-disc pl-5 mt-4 space-y-2">
                            <li>Generating AI-driven diagnostics and performance reports.</li>
                            <li>Detecting anomalies and sending real-time alerts via Slack.</li>
                            <li>Providing personalized insights and recommendations for ad scaling.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            3. Data Sharing and Processing
                        </h2>
                        <p>
                            Worker Brain uses AI models (such as Gemini 2.0) to process data. While metadata is processed through these models, we do not sell your data to third parties. We only share information with service providers (like Google Cloud and Firebase) essential for hosting and operating the platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            4. Data Security
                        </h2>
                        <p>
                            We implement industry-standard security measures to protect your information. Your Meta Ads data is accessed via secure OAuth protocols, and we only request the permissions strictly necessary for our analysis.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            5. Your Rights
                        </h2>
                        <p>
                            You have the right to access, update, or request the deletion of your personal information at any time. You can also revoke our access to your Meta Ads account via your Meta settings.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-text-primary font-black text-sm uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            6. Contact
                        </h2>
                        <p>
                            If you have questions about this policy, please contact us at <a href="mailto:hola@worker.ar" className="text-classic hover:underline">hola@worker.ar</a>.
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
                        <Link href="/terms" className="text-[10px] text-text-muted hover:text-text-primary uppercase tracking-widest">Terms</Link>
                        <Link href="/privacy" className="text-[10px] text-text-muted hover:text-text-primary uppercase tracking-widest font-black">Privacy</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
