import Link from "next/link";

const DEMO_URL = "https://calendar.app.google/Eo3YfiNsUt7Au1s8A";

const categories = [
    { name: "Dominante Escalable", desc: "CPA eficiente con margen. Aumenta budget 20% cada 48hs.", color: "text-synced", border: "border-synced/30", bg: "bg-synced/5" },
    { name: "Winner Saturando", desc: "Frecuencia alta, CPA subiendo. Rota el concepto antes de que muera.", color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-400/5" },
    { name: "Hidden BOFU", desc: "Convierte excelente pero tiene poco budget. Dale mas presupuesto ya.", color: "text-classic", border: "border-classic/30", bg: "bg-classic/5" },
    { name: "TOFU Ineficiente", desc: "Quema presupuesto sin devolver. Pausa o reestructura urgente.", color: "text-red-400", border: "border-red-400/30", bg: "bg-red-400/5" },
    { name: "Zombie", desc: "No gasta ni convierte. Ocupa lugar sin aportar. Pausa o refresca.", color: "text-text-muted", border: "border-argent", bg: "bg-argent/5" },
    { name: "Nuevo / Sin Datos", desc: "Menos de 48hs activo. Dejalo correr antes de tomar decisiones.", color: "text-text-secondary", border: "border-argent/50 border-dashed", bg: "bg-transparent" },
];

const features = [
    { icon: "01", title: "16 Alertas Inteligentes", desc: "CPA Spike, Budget Bleed, fatiga creativa, oportunidades de escala — te enterás antes de que el daño escale." },
    { icon: "02", title: "Clasificacion Automatica", desc: "Cada creativo cae en 1 de 6 categorias. Sabes al instante qué escalar, qué pausar y qué rotar." },
    { icon: "03", title: "Reportes en Slack", desc: "Digest diario a las 9 AM con los KPIs del mes y las alertas priorizadas. Sin abrir el dashboard." },
    { icon: "04", title: "Multi-Cliente", desc: "Cada cuenta tiene su propia config, umbrales y canal de Slack. Gestiona 20 clientes como si fuera 1." },
    { icon: "05", title: "Cerebro Configurable", desc: "Edita los prompts, los umbrales y la logica de decisiones. Vos controlas como piensa la AI." },
    { icon: "06", title: "Auditoria con Gemini", desc: "Diagnosticos, planes de accion y variaciones creativas generados por AI. On-demand, cuando los necesites." },
];

const verticals = [
    { name: "eCommerce", metric: "ROAS + Compras", desc: "Trackea revenue, margenes y retorno. Las alertas se disparan por compras, no por clicks." },
    { name: "Lead Gen", metric: "CPL + Volumen", desc: "Foco en costo por lead y volumen de formularios. ROAS no aplica, CPL manda." },
    { name: "WhatsApp / Messaging", metric: "Costo por Conversacion", desc: "Para ventas por chat directo. Mide eficiencia en iniciar conversaciones, no compras web." },
    { name: "Apps", metric: "CPI + Installs", desc: "Costo por instalacion y eventos in-app. Alertas calibradas para volumen de descarga." },
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
                            Deja de apagar<br />
                            incendios.<br />
                            <span className="text-classic">Empieza a escalar.</span>
                        </h1>
                        <p className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-xl mb-4 font-medium">
                            Worker Brain monitorea tus creativos de Meta Ads 24/7, detecta oportunidades de escala antes que vos,
                            y te alerta cuando algo se rompe — para que dejes de revisar a mano y te enfoques en las decisiones que mueven la aguja.
                        </p>
                        <p
                            className="text-zinc-500 text-sm mb-10"
                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                        >
                            Usado por agencias que gestionan +$500K/mes en Meta Ads.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <a
                                href={DEMO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-classic text-special px-8 py-4 text-[12px] font-black uppercase tracking-widest hover:brightness-110 transition-all text-center"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                Agendar Demo Gratis
                            </a>
                            <a
                                href="#como-funciona"
                                className="border border-argent text-zinc-400 px-8 py-4 text-[12px] font-black uppercase tracking-widest hover:border-classic hover:text-text-primary transition-all text-center"
                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                            >
                                Ver Como Funciona
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
                    <h2
                        className="text-2xl md:text-3xl font-black tracking-tighter mb-4"
                        style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                    >
                        El problema que ya conoces
                    </h2>
                    <p className="text-zinc-500 text-sm mb-12 max-w-lg">
                        Si gestionas mas de 3 cuentas de Meta Ads, estos numeros te van a sonar familiares.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { num: "500+", title: "creativos sin auditar", desc: "Revisarlos a mano no escala. Tu equipo pierde horas en tareas repetitivas que una maquina resuelve en segundos." },
                            { num: "3x", title: "oportunidades invisibles", desc: "Tenes creativos con CPA excelente que nadie vio porque estan enterrados. Budget que podria estar rindiendo 3 veces mas." },
                            { num: "72hs", title: "tarde para reaccionar", desc: "Para cuando el CPA ya exploto y la frecuencia esta por las nubes, el presupuesto ya se quemo. Necesitas alertas, no dashboards." },
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

            {/* ── SOCIAL PROOF STRIP ── */}
            <section className="border-b border-argent/50">
                <div className="max-w-6xl mx-auto px-6 py-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { num: "16", label: "tipos de alertas" },
                            { num: "6", label: "categorias automaticas" },
                            { num: "24/7", label: "monitoreo continuo" },
                            { num: "9 AM", label: "digest diario en Slack" },
                        ].map((stat, i) => (
                            <div key={i}>
                                <span
                                    className="text-classic text-2xl md:text-3xl font-black block"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {stat.num}
                                </span>
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
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
                    Tres pasos. Cero configuracion tecnica. Resultados desde el dia uno.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {[
                        {
                            step: "01",
                            title: "Conecta tu cuenta",
                            desc: "Linkeas tu cuenta de Meta Ads y el sistema sincroniza automaticamente todos tus creativos activos cada dia. Detecta formatos, elimina duplicados y normaliza la data.",
                            detail: "IMAGE / VIDEO / CAROUSEL / CATALOG"
                        },
                        {
                            step: "02",
                            title: "La AI clasifica todo",
                            desc: "Cada creativo recibe una clasificacion automatica basada en su rendimiento real. Sin reglas manuales: el sistema aprende de tus metricas y agrupa patrones ganadores.",
                            detail: "6 CATEGORIAS + PATTERN DETECTION"
                        },
                        {
                            step: "03",
                            title: "Recibi alertas y actua",
                            desc: "Te llegan alertas directas a Slack cuando algo necesita atencion. Digest diario a las 9 AM con lo importante. Dashboard de decisiones para profundizar.",
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
                        Cada creativo tiene un<br />
                        <span className="text-classic">diagnostico claro.</span>
                    </h2>
                    <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                        Nada de &quot;esta andando mas o menos&quot;. Cada anuncio cae en 1 de 6 categorias con una accion concreta. Automatico, sin reglas manuales.
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
                    Lo que realmente importa
                </h2>
                <p className="text-zinc-500 text-sm mb-16 max-w-lg">
                    Un sistema completo de inteligencia creativa para equipos que gestionan Meta Ads a escala.
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
                                Transparencia total
                            </span>
                            <h2
                                className="text-3xl md:text-4xl font-black tracking-tighter mb-6"
                                style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                            >
                                Cero cajas negras.<br />
                                Vos controlas <span className="text-classic">la AI.</span>
                            </h2>
                            <p className="text-zinc-400 text-base leading-relaxed mb-8">
                                Desde el Cerebro de Worker podes ver y editar exactamente como piensa el sistema.
                                Ajusta los umbrales, personaliza los reportes y cambia las reglas de negocio por cliente.
                                Si algo no te cierra, lo cambias.
                            </p>
                            <div className="space-y-4">
                                {["Edita el tono y la estructura de los reportes de Slack", "Ajusta umbrales de fatiga y escala por cliente", "Personaliza las reglas de cada tipo de alerta", "Testea cualquier cambio desde la consola integrada"].map((item, i) => (
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
                                {[
                                    { key: "report", label: "Reporte Consolidado" },
                                    { key: "creative-audit", label: "Auditoria Creativa" },
                                    { key: "creative-variations", label: "Variantes de Copy" },
                                    { key: "recommendations_v1", label: "Recomendaciones" },
                                    { key: "concept_briefs_v1", label: "Briefs de Concepto" },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between border border-argent/50 px-4 py-3 hover:border-classic/30 transition-all">
                                        <div>
                                            <span
                                                className="text-text-primary text-[11px] font-bold uppercase tracking-wider block"
                                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                            >
                                                {item.label}
                                            </span>
                                            <span className="text-[9px] text-zinc-500 font-mono">{item.key}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-synced uppercase tracking-widest">ACTIVO</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 pt-4 border-t border-argent/50">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">5 generadores AI — editables desde el panel</span>
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
                        { role: "Media Buyers", desc: "Dejas de perder horas auditando creativos a mano. Las alertas te avisan antes de que los problemas escalen y la clasificacion automatica te dice exactamente que hacer.", stat: "70-80%", statLabel: "menos tiempo en auditorias manuales" },
                        { role: "Agencias", desc: "Cada cliente tiene su propia configuracion, umbrales y canal de Slack. Escalas la operacion sin contratar mas analistas ni perder calidad de servicio.", stat: "10+", statLabel: "clientes gestionados por operador" },
                        { role: "Directores", desc: "Ves exactamente como piensa la AI, que umbrales usa y por que toma cada decision. Auditas, editas y personalizas la logica desde un solo lugar.", stat: "100%", statLabel: "control sobre la logica de analisis" },
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
                        No es lo mismo vender remeras que generar leads. Las metricas, alertas y clasificaciones se ajustan automaticamente segun tu tipo de negocio.
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
                    Tu equipo ya esta<br />
                    perdiendo <span className="text-classic">oportunidades.</span>
                </h2>
                <p className="text-zinc-400 text-lg max-w-md mx-auto mb-10">
                    Cada dia sin alertas automaticas es un dia donde un creativo ganador pasa desapercibido
                    o un Budget Bleed quema presupuesto sin que nadie lo vea.
                </p>
                <a
                    href={DEMO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-classic text-special px-10 py-5 text-[13px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                >
                    Agendar Demo Gratis
                </a>
                <p className="text-zinc-500 text-sm mt-6">
                    O escribinos a{" "}
                    <a href="mailto:hola@worker.ar" className="text-classic hover:underline">hola@worker.ar</a>
                    {" "}— sin compromiso.
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
