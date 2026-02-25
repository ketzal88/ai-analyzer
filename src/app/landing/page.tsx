import Link from "next/link";

const DEMO_URL = "https://calendar.app.google/Eo3YfiNsUt7Au1s8A"; // Cambiar por tu link real de Calendly

const categories = [
    { name: "Dominante Escalable", desc: "Alto gasto + CPA eficiente. Escalar agresivamente.", color: "text-synced", border: "border-synced/30", bg: "bg-synced/5" },
    { name: "Winner Saturando", desc: "Era eficiente pero muestra fatiga. Rotar concepto.", color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-400/5" },
    { name: "Hidden BOFU", desc: "Bajo gasto pero excelentes conversiones. Aumentar budget.", color: "text-classic", border: "border-classic/30", bg: "bg-classic/5" },
    { name: "TOFU Ineficiente", desc: "Alto gasto + pobre eficiencia. Cortar o reestructurar.", color: "text-red-400", border: "border-red-400/30", bg: "bg-red-400/5" },
    { name: "Zombie", desc: "Gasto minimo, resultados minimos. Pausar o refrescar.", color: "text-text-muted", border: "border-argent", bg: "bg-argent/5" },
    { name: "Nuevo / Sin Datos", desc: "Menos de 48hs o 2000 impresiones. Esperando data.", color: "text-text-secondary", border: "border-argent/50 border-dashed", bg: "bg-transparent" },
];

const features = [
    { icon: "01", title: "Clasificacion Inteligente", desc: "6 categorias automaticas basadas en rendimiento real. Sin reglas manuales." },
    { icon: "02", title: "Alertas en Tiempo Real", desc: "10+ senales: CPA Spike, Budget Bleed, Fatiga, Oportunidades de Escala y mas." },
    { icon: "03", title: "Auditoria GEM", desc: "Gemini 2.0 Flash genera diagnosticos, planes de accion y variaciones creativas." },
    { icon: "04", title: "Multi-Cliente", desc: "Gestiona multiples cuentas con configuracion independiente por cliente." },
    { icon: "05", title: "Cerebro Configurable", desc: "Edita como piensa la AI. Ajusta prompts, umbrales y logica de decisiones." },
    { icon: "06", title: "Reportes Slack", desc: "Digest diario a las 9 AM con KPIs acumulados del mes y alertas priorizadas." },
];

const verticals = [
    { name: "eCommerce", metric: "ROAS + Compras", desc: "Optimizado para tiendas online con tracking de valor de compra y retorno." },
    { name: "Lead Gen", metric: "CPL + Volumen", desc: "Foco en costo por lead y volumen de formularios o registros." },
    { name: "WhatsApp / Ventas", metric: "Costo por Conversacion", desc: "Para negocios que venden por mensaje directo o WhatsApp Business." },
    { name: "Apps", metric: "CPI + Installs", desc: "Tracking de costo por instalacion y eventos in-app." },
];

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-stellar text-text-primary">

            {/* ── NAV ── */}
            <nav className="border-b border-argent/50 sticky top-0 z-50 bg-stellar/95 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <img src="/img/logo-h-worker-brain.png" alt="Worker Brain" className="h-7 w-auto" />
                    <div className="flex items-center gap-6">
                        <Link
                            href="/login"
                            className="text-[11px] font-bold text-text-muted uppercase tracking-widest hover:text-text-primary transition-colors"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Iniciar Sesion
                        </Link>
                        <a
                            href={DEMO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-classic text-special px-5 py-2 text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Agendar Demo
                        </a>
                    </div>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
                <div className="flex items-center justify-between gap-12">
                    <div className="max-w-3xl">
                        <div
                            className="inline-block px-3 py-1 border border-classic/30 text-classic text-[10px] font-black uppercase tracking-widest mb-8"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Powered by Gemini 2.0 Flash
                        </div>
                        <h1
                            className="text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tighter mb-8"
                            style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                        >
                            Tu analista de<br />
                            Meta Ads que<br />
                            <span className="text-classic">nunca duerme.</span>
                        </h1>
                        <p
                            className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-xl mb-10 font-medium"
                        >
                            Worker Brain analiza tus creativos 24/7, detecta oportunidades de escala,
                            alerta fatiga y genera insights accionables — mientras vos tomas las decisiones.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <a
                                href={DEMO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-classic text-special px-8 py-4 text-[12px] font-black uppercase tracking-widest hover:brightness-110 transition-all text-center"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                Agendar Demo
                            </a>
                            <a
                                href="#como-funciona"
                                className="border border-argent text-zinc-400 px-8 py-4 text-[12px] font-black uppercase tracking-widest hover:border-classic hover:text-text-primary transition-all text-center"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                Como Funciona
                            </a>
                        </div>
                    </div>
                    <div className="hidden lg:flex items-center justify-center flex-shrink-0">
                        <img src="/img/logo-v-worker-brain-x2.png" alt="Worker Brain" className="w-64" />
                    </div>
                </div>
            </section>

            {/* ── PAIN POINTS ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { num: "500+", title: "creativos para auditar", desc: "Revisar cada anuncio a mano no escala. El tiempo de tu equipo se pierde en tareas repetitivas." },
                            { num: "3x", title: "oportunidades perdidas", desc: "Los creativos con potencial de escala pasan desapercibidos. Budget que podria estar rindiendo mas." },
                            { num: "72hs", title: "tarde para detectar fatiga", desc: "Cuando el CPA ya subio y la frecuencia exploto, el dano ya esta hecho. Necesitas alertas tempranas." },
                        ].map((pain, i) => (
                            <div key={i} className="border border-argent p-8">
                                <span
                                    className="text-classic text-3xl font-black block mb-3"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {pain.num}
                                </span>
                                <h3
                                    className="text-text-primary font-black text-sm uppercase tracking-widest mb-3"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {pain.title}
                                </h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">{pain.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── COMO FUNCIONA ── */}
            <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-24">
                <h2
                    className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Como funciona
                </h2>
                <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                    Tres pasos para pasar de auditorias manuales a inteligencia automatizada.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {[
                        {
                            step: "01",
                            title: "Conecta tu cuenta Meta",
                            desc: "Sync automatico diario de todos tus creativos activos. Deteccion de formatos, deduplicacion por fingerprint y normalizacion de datos.",
                            detail: "IMAGE / VIDEO / CAROUSEL / CATALOG"
                        },
                        {
                            step: "02",
                            title: "El AI clasifica y analiza",
                            desc: "6 categorias automaticas, scoring inteligente con pesos configurables, deteccion de patrones ganadores y clustering para reducir tokens ~80%.",
                            detail: "SCORING / CLUSTERING / PATTERNS"
                        },
                        {
                            step: "03",
                            title: "Recibis alertas y reportes",
                            desc: "Alertas en Slack por canal de cliente, digest diario a las 9 AM, dashboard de decisiones y auditorias GEM on-demand.",
                            detail: "SLACK / DASHBOARD / DECISION BOARD"
                        },
                    ].map((item, i) => (
                        <div key={i} className="relative">
                            <span
                                className="text-6xl font-black text-argent/30 absolute -top-2 -left-1"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                {item.step}
                            </span>
                            <div className="pt-14">
                                <h3
                                    className="text-text-primary font-black text-sm uppercase tracking-widest mb-4"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {item.title}
                                </h3>
                                <p className="text-zinc-400 text-sm leading-relaxed mb-4">{item.desc}</p>
                                <span
                                    className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {item.detail}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CLASIFICACION CREATIVA ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-24">
                    <h2
                        className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                    >
                        6 categorias. <span className="text-classic">Cero ambiguedad.</span>
                    </h2>
                    <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                        Cada creativo se clasifica automaticamente segun su rendimiento real. Sin reglas manuales, sin suposiciones.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((cat, i) => (
                            <div key={i} className={`border ${cat.border} ${cat.bg} p-6 transition-all hover:scale-[1.01]`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-2 h-2 ${cat.color.replace('text-', 'bg-')}`} />
                                    <h4
                                        className={`${cat.color} font-black text-[11px] uppercase tracking-widest`}
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {cat.name}
                                    </h4>
                                </div>
                                <p className="text-zinc-400 text-sm leading-relaxed">{cat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FEATURES GRID ── */}
            <section className="max-w-6xl mx-auto px-6 py-24">
                <h2
                    className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Todo lo que necesitas
                </h2>
                <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                    Un sistema completo de inteligencia creativa para agencias que gestionan Meta Ads a escala.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((f, i) => (
                        <div key={i} className="border border-argent p-8 hover:border-argent/80 transition-all group">
                            <span
                                className="text-classic text-[10px] font-black tracking-widest block mb-4"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                {f.icon}
                            </span>
                            <h3
                                className="text-text-primary font-black text-sm uppercase tracking-widest mb-3"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                {f.title}
                            </h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CEREBRO ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-24">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span
                                className="text-classic text-[10px] font-black uppercase tracking-widest block mb-6"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                No es una caja negra
                            </span>
                            <h2
                                className="text-3xl md:text-4xl font-black tracking-tighter mb-6"
                                style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                            >
                                Edita como piensa<br />
                                <span className="text-classic">la AI.</span>
                            </h2>
                            <p className="text-zinc-400 text-base leading-relaxed mb-8">
                                Desde el Cerebro de Worker podes ajustar los prompts del sistema,
                                los umbrales de decision, las instrucciones criticas y los esquemas
                                de output. Control total sobre la logica de analisis.
                            </p>
                            <div className="space-y-4">
                                {["Prompts editables por tipo de reporte", "Umbrales de fatiga y escala por cliente", "Instrucciones criticas con override desde DB", "Consola de pruebas integrada"].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 bg-classic" />
                                        <span
                                            className="text-text-primary text-sm font-medium"
                                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                        >
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="border border-argent p-8 bg-stellar">
                            <div className="space-y-3">
                                {["report", "creative-audit", "creative-variations", "recommendations_v1", "concept_briefs_v1"].map((key, i) => (
                                    <div key={i} className="flex items-center justify-between border border-argent/50 px-4 py-3 hover:border-classic/30 transition-all">
                                        <span
                                            className="text-text-primary text-[11px] font-bold uppercase tracking-wider"
                                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                        >
                                            {key}
                                        </span>
                                        <span className="text-[9px] font-bold text-synced uppercase tracking-widest">ACTIVO</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 pt-4 border-t border-argent/50">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">5 generadores AI configurables</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── PARA QUIEN ── */}
            <section className="max-w-6xl mx-auto px-6 py-24">
                <h2
                    className="text-3xl md:text-4xl font-black tracking-tighter mb-16"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Pensado para equipos<br />
                    que <span className="text-classic">escalan.</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { role: "Media Buyers", desc: "Automatiza el analisis repetitivo y enfocate en las decisiones estrategicas. Recibi alertas antes de que los problemas escalen.", stat: "70-80%", statLabel: "menos tiempo en auditorias" },
                        { role: "Agencias", desc: "Gestiona multiples clientes con configuracion independiente. Escala operaciones sin contratar mas analistas.", stat: "10+", statLabel: "senales monitoreadas 24/7" },
                        { role: "Directores", desc: "Transparencia total sobre como piensa la AI. Audita, edita y personaliza la logica desde el Cerebro de Worker.", stat: "100%", statLabel: "control sobre la logica AI" },
                    ].map((profile, i) => (
                        <div key={i} className="border border-argent p-8">
                            <h3
                                className="text-classic font-black text-[11px] uppercase tracking-widest mb-4"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                {profile.role}
                            </h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-8">{profile.desc}</p>
                            <div className="border-t border-argent/50 pt-4">
                                <span
                                    className="text-2xl font-black text-text-primary block"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {profile.stat}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{profile.statLabel}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── VERTICALES ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-24">
                    <h2
                        className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                    >
                        Se adapta a tu vertical
                    </h2>
                    <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                        Configuracion por tipo de negocio. Las metricas, alertas y clasificaciones se ajustan automaticamente.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {verticals.map((v, i) => (
                            <div key={i} className="border border-argent p-6 hover:border-classic/30 transition-all">
                                <h4
                                    className="text-text-primary font-black text-sm uppercase tracking-widest mb-2"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {v.name}
                                </h4>
                                <span
                                    className="text-classic text-[10px] font-black uppercase tracking-widest block mb-3"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {v.metric}
                                </span>
                                <p className="text-zinc-400 text-sm leading-relaxed">{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA FINAL ── */}
            <section className="max-w-6xl mx-auto px-6 py-32 text-center">
                <h2
                    className="text-4xl md:text-5xl font-black tracking-tighter mb-6"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Listo para dejar<br />
                    de <span className="text-classic">adivinar?</span>
                </h2>
                <p className="text-zinc-400 text-lg max-w-md mx-auto mb-10">
                    Agenda una demo y te mostramos como Worker Brain puede transformar
                    la operacion de tu agencia.
                </p>
                <a
                    href={DEMO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-classic text-special px-10 py-5 text-[13px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                >
                    Agendar Demo
                </a>
                <p className="text-zinc-500 text-sm mt-6">
                    O escribinos a{" "}
                    <a href="mailto:hola@worker.ar" className="text-classic hover:underline">hola@worker.ar</a>
                </p>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-argent/50">
                <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <img src="/img/logo-h-worker-brain.png" alt="Worker Brain" className="h-6 w-auto opacity-50" />
                    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                        <Link
                            href="/privacy"
                            className="text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-text-primary transition-colors"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="/terms"
                            className="text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-text-primary transition-colors"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Terms of Use
                        </Link>
                        <Link
                            href="/login"
                            className="text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-text-primary transition-colors"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Iniciar Sesion
                        </Link>
                        <span
                            className="text-[10px] text-text-muted font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Worker &copy; {new Date().getFullYear()}
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
