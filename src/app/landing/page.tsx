import Link from "next/link";

const DEMO_URL = "https://calendar.app.google/Eo3YfiNsUt7Au1s8A";

const channels = [
    {
        name: "Meta Ads",
        logos: [{ src: "/img/logos/meta.png", alt: "Meta" }],
        desc: "Clasificación creativa, alertas de fatiga, scoring inteligente y diagnósticos GEM.",
        color: "text-classic",
        border: "border-classic/30",
    },
    {
        name: "Google Ads",
        logos: [{ src: "/img/logos/google.png", alt: "Google" }],
        desc: "Search, Shopping, Display, Video y PMax. Términos de búsqueda y funnel de video.",
        color: "text-synced",
        border: "border-synced/30",
    },
    {
        name: "Ecommerce",
        logos: [
            { src: "/img/logos/shopify.png", alt: "Shopify" },
            { src: "/img/logos/tiendanube.png", alt: "Tienda Nube" },
            { src: "/img/logos/woocomerce.png", alt: "WooCommerce" },
        ],
        desc: "Shopify, Tienda Nube y WooCommerce. Revenue, LTV, atribución UTM y productos top.",
        color: "text-violet-400",
        border: "border-violet-400/30",
    },
    {
        name: "Email Marketing",
        logos: [
            { src: "/img/logos/klaviyo.png", alt: "Klaviyo" },
            { src: "/img/logos/perfit.png", alt: "Perfit" },
        ],
        desc: "Klaviyo y Perfit. Campañas, flujos, open rate, clicks, revenue y automaciones.",
        color: "text-amber-400",
        border: "border-amber-400/30",
    },
];

const features = [
    { icon: "01", title: "4 Canales Unificados", desc: "Meta, Google, Ecommerce y Email en un solo dashboard. Datos cruzados, visión completa." },
    { icon: "02", title: "AI Analyst Conversacional", desc: "Chateá con Claude sobre tus datos. Preguntá lo que quieras, recibís análisis en tiempo real." },
    { icon: "03", title: "16 Tipos de Alertas", desc: "CPA Spike, Budget Bleed, Fatiga, Oportunidades de Escala, Hook Kill, y más. Priorizadas por severidad." },
    { icon: "04", title: "Multi-Cliente", desc: "Gestioná múltiples cuentas con configuración independiente. Umbrales, alertas y lógica por cliente." },
    { icon: "05", title: "Cerebro Configurable", desc: "Editá cómo piensa la AI. Prompts por canal, umbrales de decisión y esquemas de output." },
    { icon: "06", title: "Reportes Slack", desc: "Digest diario con KPIs acumulados, alertas críticas y resumen semanal automático." },
];

const categories = [
    { name: "Dominante Escalable", desc: "Alto gasto + CPA eficiente. Escalar agresivamente.", color: "text-synced", border: "border-synced/30", bg: "bg-synced/5" },
    { name: "Winner Saturando", desc: "Era eficiente pero muestra fatiga. Rotar concepto.", color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-400/5" },
    { name: "Hidden BOFU", desc: "Bajo gasto pero excelentes conversiones. Aumentar budget.", color: "text-classic", border: "border-classic/30", bg: "bg-classic/5" },
    { name: "TOFU Ineficiente", desc: "Alto gasto + pobre eficiencia. Cortar o reestructurar.", color: "text-red-400", border: "border-red-400/30", bg: "bg-red-400/5" },
    { name: "Zombie", desc: "Gasto mínimo, resultados mínimos. Pausar o refrescar.", color: "text-text-muted", border: "border-argent", bg: "bg-argent/5" },
    { name: "Nuevo / Sin Datos", desc: "Menos de 48hs o 2000 impresiones. Esperando data.", color: "text-text-secondary", border: "border-argent/50 border-dashed", bg: "bg-transparent" },
];

const integrations = [
    { name: "Meta Ads", type: "Paid Media", logo: "/img/logos/meta.png" },
    { name: "Google Ads", type: "Paid Media", logo: "/img/logos/google.png" },
    { name: "Shopify", type: "Ecommerce", logo: "/img/logos/shopify.png" },
    { name: "Tienda Nube", type: "Ecommerce", logo: "/img/logos/tiendanube.png" },
    { name: "WooCommerce", type: "Ecommerce", logo: "/img/logos/woocomerce.png" },
    { name: "Klaviyo", type: "Email", logo: "/img/logos/klaviyo.png" },
    { name: "Perfit", type: "Email", logo: "/img/logos/perfit.png" },
];

const verticals = [
    { name: "eCommerce", metric: "ROAS + Revenue + LTV", desc: "Conectá tu tienda, cruzá datos de ads con ventas reales y medí el retorno verdadero." },
    { name: "Lead Gen", metric: "CPL + Volumen", desc: "Foco en costo por lead y volumen de formularios o registros." },
    { name: "WhatsApp / Ventas", metric: "Costo por Conversación", desc: "Para negocios que venden por mensaje directo o WhatsApp Business." },
    { name: "Apps", metric: "CPI + Installs", desc: "Tracking de costo por instalación y eventos in-app." },
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
                            Iniciar Sesión
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
                            className="inline-flex items-center gap-3 px-3 py-1 border border-classic/30 text-classic text-[10px] font-black uppercase tracking-widest mb-8"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            <span>Meta</span>
                            <span className="text-argent">+</span>
                            <span>Google</span>
                            <span className="text-argent">+</span>
                            <span>Ecommerce</span>
                            <span className="text-argent">+</span>
                            <span>Email</span>
                        </div>
                        <h1
                            className="text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tighter mb-8"
                            style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                        >
                            Todos tus canales.<br />
                            Un solo <span className="text-classic">cerebro.</span>
                        </h1>
                        <p
                            className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-xl mb-10 font-medium"
                        >
                            Worker Brain conecta Meta Ads, Google Ads, tu tienda online y email marketing
                            en una plataforma unificada con inteligencia artificial. Análisis automatizado,
                            alertas inteligentes y un AI Analyst que responde tus preguntas en tiempo real.
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
                                href="#canales"
                                className="border border-argent text-zinc-400 px-8 py-4 text-[12px] font-black uppercase tracking-widest hover:border-classic hover:text-text-primary transition-all text-center"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                Ver Canales
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
                            { num: "4+", title: "plataformas para revisar", desc: "Meta, Google, tu tienda y email. Cada una con su dashboard, sus métricas y su lógica. Horas saltando entre pestañas." },
                            { num: "0", title: "visión cross-channel", desc: "Las plataformas no se hablan entre sí. No sabés si tu inversión en ads genera ventas reales o si tu email está recuperando carritos." },
                            { num: "72hs", title: "tarde para detectar problemas", desc: "Cuando el CPA explotó, la fatiga creativa avanzó o el revenue cayó, ya perdiste presupuesto. Necesitás alertas tempranas." },
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

            {/* ── CANALES ── */}
            <section id="canales" className="max-w-6xl mx-auto px-6 py-24">
                <h2
                    className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Cuatro canales. <span className="text-classic">Una verdad.</span>
                </h2>
                <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                    Cada canal tiene métricas, alertas y análisis específicos. Todo unificado en una sola plataforma.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {channels.map((ch, i) => (
                        <div key={i} className={`border ${ch.border} p-8 hover:scale-[1.01] transition-all`}>
                            <div className="flex items-center gap-3 mb-5">
                                {ch.logos.map((logo, j) => (
                                    <div key={j} className="w-8 h-8 bg-white/10 border border-argent/50 flex items-center justify-center p-1.5">
                                        <img src={logo.src} alt={logo.alt} className="w-full h-full object-contain" />
                                    </div>
                                ))}
                                <div className={`flex-1 h-px ${ch.border.replace('border-', 'bg-')}`} />
                            </div>
                            <h3
                                className="text-text-primary font-black text-lg mb-3"
                                style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                            >
                                {ch.name}
                            </h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">{ch.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── AI ANALYST ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-24">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span
                                className="text-classic text-[10px] font-black uppercase tracking-widest block mb-6"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                Powered by Claude AI
                            </span>
                            <h2
                                className="text-3xl md:text-4xl font-black tracking-tighter mb-6"
                                style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                            >
                                Preguntale a tus datos.<br />
                                <span className="text-classic">Te responden.</span>
                            </h2>
                            <p className="text-zinc-400 text-base leading-relaxed mb-8">
                                El AI Analyst entiende todo el contexto de tu negocio — tus campañas, tu tienda,
                                tu email marketing — y responde preguntas complejas en lenguaje natural.
                                Como tener un analista senior disponible 24/7.
                            </p>
                            <div className="space-y-4">
                                {[
                                    "Análisis por canal: Meta, Google, Ecommerce, Email",
                                    "Visión cross-channel con datos cruzados",
                                    "Conversaciones multi-turno con memoria",
                                    "Prompts personalizables desde el Cerebro",
                                ].map((item, i) => (
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
                        <div className="border border-argent p-6 bg-stellar">
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-2 px-3 py-2 bg-classic/10 border border-classic/20">
                                    <span className="text-[9px] font-black text-classic uppercase tracking-widest" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>TÚ</span>
                                    <span className="text-sm text-zinc-300">¿Cuál es mi ROAS real considerando las ventas de Shopify?</span>
                                </div>
                                <div className="flex items-start gap-2 px-3 py-2 bg-argent/10 border border-argent/30">
                                    <span className="text-[9px] font-black text-synced uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>AI</span>
                                    <span className="text-sm text-zinc-400">Cruzando el spend de Meta ($4,200) con las ventas atribuidas en Shopify ($18,900), tu ROAS real es 4.5x. Meta reporta 5.2x, así que hay un gap de atribución del 13%...</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-classic/10 border border-classic/20">
                                    <span className="text-[9px] font-black text-classic uppercase tracking-widest" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>TÚ</span>
                                    <span className="text-sm text-zinc-300">¿Qué campañas debería escalar esta semana?</span>
                                </div>
                            </div>
                            <div className="border-t border-argent/50 pt-3">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Conversación en tiempo real con streaming</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CÓMO FUNCIONA ── */}
            <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-24">
                <h2
                    className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Cómo funciona
                </h2>
                <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                    Tres pasos para pasar de dashboards fragmentados a inteligencia unificada.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {[
                        {
                            step: "01",
                            title: "Conectá tus canales",
                            desc: "Meta Ads, Google Ads, tu tienda (Shopify, Tienda Nube o WooCommerce) y tu plataforma de email (Klaviyo o Perfit). Sync automático diario.",
                            detail: "7 INTEGRACIONES NATIVAS"
                        },
                        {
                            step: "02",
                            title: "La AI analiza todo",
                            desc: "Clasificación creativa, alertas de rendimiento, métricas de video, atribución de ventas, performance de email. Todo procesado y correlacionado.",
                            detail: "GEMINI + CLAUDE / 24-7"
                        },
                        {
                            step: "03",
                            title: "Actuá con datos",
                            desc: "Dashboard unificado, alertas en Slack, AI Analyst para preguntas on-demand y reportes automáticos. Decisiones informadas, no suposiciones.",
                            detail: "ALERTAS / CHAT AI / SLACK"
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

            {/* ── FEATURES GRID ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-24">
                    <h2
                        className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                    >
                        Todo lo que necesitás
                    </h2>
                    <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                        Un sistema completo de inteligencia de marketing para agencias que gestionan campañas a escala.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f, i) => (
                            <div key={i} className="border border-argent p-8 hover:border-argent/80 transition-all group bg-stellar">
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
                </div>
            </section>

            {/* ── CLASIFICACIÓN CREATIVA ── */}
            <section className="max-w-6xl mx-auto px-6 py-24">
                <div className="flex items-start justify-between gap-8 mb-16">
                    <div>
                        <span
                            className="text-classic text-[10px] font-black uppercase tracking-widest block mb-4"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Inteligencia Creativa
                        </span>
                        <h2
                            className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                            style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                        >
                            6 categorías. <span className="text-classic">Cero ambigüedad.</span>
                        </h2>
                        <p className="text-zinc-500 text-sm max-w-lg">
                            Cada creativo de Meta Ads se clasifica automáticamente según su rendimiento real. Scoring inteligente con Gemini Vision para análisis visual y de copy.
                        </p>
                    </div>
                </div>

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
            </section>

            {/* ── INTEGRACIONES ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-24">
                    <h2
                        className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                    >
                        7 integraciones <span className="text-classic">nativas.</span>
                    </h2>
                    <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                        Conectá tu stack completo. Sync automático diario, sin configuración manual.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                        {integrations.map((int, i) => (
                            <div key={i} className="border border-argent p-4 flex flex-col items-center gap-3 hover:border-classic/30 transition-all">
                                <div className="w-10 h-10 bg-white/10 border border-argent/50 flex items-center justify-center p-2">
                                    <img src={int.logo} alt={int.name} className="w-full h-full object-contain" />
                                </div>
                                <div className="text-center">
                                    <h4
                                        className="text-text-primary font-black text-[10px] uppercase tracking-widest mb-1"
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {int.name}
                                    </h4>
                                    <span
                                        className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest"
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {int.type}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CEREBRO ── */}
            <section className="max-w-6xl mx-auto px-6 py-24">
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
                            Editá cómo piensa<br />
                            <span className="text-classic">la AI.</span>
                        </h2>
                        <p className="text-zinc-400 text-base leading-relaxed mb-8">
                            Desde el Cerebro de Worker podés ajustar los prompts del sistema por canal,
                            los umbrales de decisión por cliente, las instrucciones críticas y los esquemas
                            de output. Control total sobre la lógica de análisis.
                        </p>
                        <div className="space-y-4">
                            {[
                                "Prompts de AI Analyst editables por canal",
                                "Umbrales de fatiga y escala por cliente",
                                "5 generadores AI configurables",
                                "Consola de pruebas integrada",
                            ].map((item, i) => (
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
                    <div className="border border-argent p-8 bg-special">
                        <div className="space-y-3">
                            {[
                                { key: "meta_ads", label: "Meta Ads Analyst" },
                                { key: "google_ads", label: "Google Ads Analyst" },
                                { key: "ecommerce", label: "Ecommerce Analyst" },
                                { key: "email", label: "Email Marketing Analyst" },
                                { key: "cross_channel", label: "Cross-Channel Analyst" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between border border-argent/50 px-4 py-3 hover:border-classic/30 transition-all">
                                    <span
                                        className="text-text-primary text-[11px] font-bold uppercase tracking-wider"
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {item.label}
                                    </span>
                                    <span className="text-[9px] font-bold text-synced uppercase tracking-widest">ACTIVO</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 pt-4 border-t border-argent/50">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">5 canales AI con prompts personalizables</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── PARA QUIÉN ── */}
            <section className="border-y border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-24">
                    <h2
                        className="text-3xl md:text-4xl font-black tracking-tighter mb-16"
                        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                    >
                        Pensado para equipos<br />
                        que <span className="text-classic">escalan.</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { role: "Media Buyers", desc: "Automatizá el análisis repetitivo de ads y enfocate en las decisiones estratégicas. Recibí alertas antes de que los problemas escalen.", stat: "16+", statLabel: "alertas automáticas" },
                            { role: "Agencias", desc: "Gestioná múltiples clientes con configuración independiente. Todos los canales unificados. Escalá operaciones sin contratar más analistas.", stat: "4", statLabel: "canales en un solo lugar" },
                            { role: "Directores", desc: "Transparencia total sobre cómo piensa la AI. Audita, editá y personalizá la lógica desde el Cerebro de Worker. Chateá con el AI Analyst.", stat: "100%", statLabel: "control sobre la lógica AI" },
                        ].map((profile, i) => (
                            <div key={i} className="border border-argent p-8 bg-stellar">
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
                </div>
            </section>

            {/* ── VERTICALES ── */}
            <section className="max-w-6xl mx-auto px-6 py-24">
                <h2
                    className="text-3xl md:text-4xl font-black tracking-tighter mb-4"
                    style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                >
                    Se adapta a tu vertical
                </h2>
                <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                    Configuración por tipo de negocio. Las métricas, alertas y clasificaciones se ajustan automáticamente.
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
            </section>

            {/* ── CTA FINAL ── */}
            <section className="border-t border-argent/50 bg-special">
                <div className="max-w-6xl mx-auto px-6 py-32 text-center">
                    <h2
                        className="text-4xl md:text-5xl font-black tracking-tighter mb-6"
                        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                    >
                        ¿Listo para ver<br />
                        <span className="text-classic">todo el panorama?</span>
                    </h2>
                    <p className="text-zinc-400 text-lg max-w-md mx-auto mb-10">
                        Agendá una demo y te mostramos cómo Worker Brain unifica todos tus canales
                        con inteligencia artificial.
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
                </div>
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
                            Iniciar Sesión
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
