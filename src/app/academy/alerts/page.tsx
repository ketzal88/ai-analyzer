"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";

const ALERT_TYPES = [
    {
        id: "SCALING_OPPORTUNITY",
        title: "Oportunidad de Escala",
        severity: "INFO",
        channel: "slack_immediate",
        logic: "CPA por debajo del target + velocidad de gasto estable + frecuencia controlada (< umbral).",
        description: "El algoritmo encontro una veta de eficiencia que puede absorber mas presupuesto sin romper el CPA. Es la senal mas valiosa del sistema: un creativo que esta funcionando y tiene margen para crecer.",
        example: "Oportunidad de Escala: Campaña Prospección\nSeñal consolidada. CPA $12.5 (target: $15.0). Velocidad estable. Frecuencia 1.8 OK.",
        action: "Incrementar presupuesto entre 20% y 30% cada 48hs. No hagas cambios bruscos para evitar reinicio de learning."
    },
    {
        id: "CPA_SPIKE",
        title: "Pico de CPA",
        severity: "CRITICAL",
        channel: "slack_immediate",
        logic: "CPA incremental > umbral de spike (default 25%) respecto al rolling de 7 dias.",
        description: "El costo por adquisicion subio bruscamente. Puede ser fatiga creativa, un cambio en el entorno de subasta o una audiencia agotada. Es una alerta que necesita atencion rapida antes de que el gasto se descontrole.",
        example: "Pico de CPA en Conjunto Retargeting\nEl CPA ha subido un 35% en comparación con el período anterior ($18.0 vs $13.3).",
        action: "Auditar los anuncios con mayor gasto en ese adset. Verificar si el CTR cayo o si la frecuencia subio."
    },
    {
        id: "BUDGET_BLEED",
        title: "Fuga de Presupuesto",
        severity: "CRITICAL",
        channel: "slack_immediate",
        logic: "Gasto > 2x Target CPA sin ninguna conversion registrada.",
        description: "Se esta quemando dinero en un asset que no devuelve ninguna senal de conversion. Es la alerta mas urgente del sistema — cada hora que pasa sin accion es dinero perdido.",
        example: "Fuga de Presupuesto: Adset Intereses\nSe han gastado $45.0 (> 2x Target CPA) sin registrar conversiones.",
        action: "Apagar el adset o rotar creativos inmediatamente. No esperes mas data."
    },
    {
        id: "LEARNING_RESET_RISK",
        title: "Riesgo de Reinicio de Learning",
        severity: "WARNING",
        channel: "slack_weekly",
        logic: "Cambio de presupuesto > 30% en el adset + edicion reciente detectada.",
        description: "Un cambio brusco en el presupuesto puede resetear la fase de aprendizaje de Meta. Cuando eso pasa, el algoritmo pierde la optimizacion acumulada y vuelve a explorar, lo que sube el CPA temporalmente.",
        example: "Riesgo de Reinicio de Learning: Campaña Advantage+\nCambio de budget de 45% (> 30%) con edición reciente.",
        action: "Escalar de forma gradual: maximo 20% por vez, cada 48-72hs."
    },
    {
        id: "ROTATE_CONCEPT",
        title: "Rotar Creativo",
        severity: "CRITICAL",
        channel: "slack_immediate",
        logic: "Clasificacion de fatiga: REAL / CONCEPT_DECAY / AUDIENCE_SATURATION.",
        description: "El publico ya vio demasiado este anuncio. El hook rate baja, la frecuencia sube y el CPA se dispara. Es momento de introducir una variante nueva antes de que el deterioro sea irreversible.",
        example: "Rotar Creativo: Video Testimonial v1\nFatiga detectada. Hook rate 12% con frecuencia 4.2.",
        action: "Introducir una nueva variante visual o cambiar el angulo del mensaje. Mantener el adset activo con el nuevo creativo."
    }
];

const ALL_ALERTS_REFERENCE = [
    { type: "SCALING_OPPORTUNITY", severity: "INFO", channel: "Slack diario", trigger: "CPA < target + velocidad estable + frecuencia OK", action: "Escalar budget 20-30% cada 48hs" },
    { type: "LEARNING_RESET_RISK", severity: "WARNING", channel: "Slack semanal", trigger: "Budget change >30% + edicion reciente (adset)", action: "Escalar max 20% por vez" },
    { type: "CPA_SPIKE", severity: "CRITICAL", channel: "Slack diario", trigger: "CPA delta > umbral de spike", action: "Auditar anuncios de mayor gasto" },
    { type: "BUDGET_BLEED", severity: "CRITICAL", channel: "Slack diario", trigger: "0 conversiones + gasto > 2x target CPA", action: "Apagar adset o rotar creativos" },
    { type: "CPA_VOLATILITY", severity: "WARNING", channel: "Slack semanal", trigger: "Budget change > umbral de volatilidad", action: "Estabilizar presupuesto" },
    { type: "ROTATE_CONCEPT", severity: "CRITICAL", channel: "Slack diario", trigger: "Fatiga REAL / CONCEPT_DECAY / AUDIENCE_SATURATION", action: "Introducir variante nueva" },
    { type: "CONSOLIDATE", severity: "WARNING", channel: "Slack semanal", trigger: "Estructura FRAGMENTED / OVERCONCENTRATED", action: "Consolidar o diversificar adsets" },
    { type: "KILL_RETRY", severity: "WARNING", channel: "Slack semanal", trigger: "Decision engine: KILL_RETRY", action: "Pausar y relanzar con cambios" },
    { type: "INTRODUCE_BOFU_VARIANTS", severity: "INFO", channel: "Panel", trigger: "Decision engine: INTRODUCE_BOFU_VARIANTS", action: "Crear variantes de cierre" },
    { type: "HOOK_KILL", severity: "CRITICAL", channel: "Slack diario", trigger: "Video hook rate < 20% + gasto > $50", action: "Cambiar los primeros 3 segundos" },
    { type: "BODY_WEAK", severity: "WARNING", channel: "Slack semanal", trigger: "Hook > 25% pero hold < 30%", action: "Mejorar el cuerpo del video" },
    { type: "CTA_WEAK", severity: "WARNING", channel: "Slack semanal", trigger: "Hook + hold OK pero CTR < 0.8%", action: "Reforzar el call-to-action" },
    { type: "VIDEO_DROPOFF", severity: "INFO", channel: "Panel", trigger: "Drop-off significativo en p50/p75/p100", action: "Analizar punto de abandono" },
    { type: "IMAGE_INVISIBLE", severity: "WARNING", channel: "Slack semanal", trigger: "CTR < 0.5% + impresiones > 2000", action: "Cambiar visual o copy principal" },
    { type: "IMAGE_NO_CONVERT", severity: "WARNING", channel: "Slack semanal", trigger: "CTR > 1.5% pero CPA > 2x target", action: "Problema de landing, no de ad" },
    { type: "CREATIVE_MIX_IMBALANCE", severity: "WARNING", channel: "Slack semanal", trigger: "Baja diversidad o >80% spend en 1 formato", action: "Diversificar formatos activos" },
];

export default function AlertsAcademyPage() {
    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-20">
                {/* ── HEADER ── */}
                <div className="mb-12">
                    <h1 className="text-hero text-text-primary mb-2">AI Handbook: Como piensa Worker Brain</h1>
                    <p className="text-body text-text-secondary max-w-2xl">
                        Este manual explica la logica detras del motor de optimizacion. Usa estas guias para entender por que recibes cada alerta en Slack, como se clasifican tus creativos y que acciones tomar en cada caso.
                    </p>
                </div>

                {/* ── TABLE OF CONTENTS ── */}
                <div className="mb-20 p-8 bg-special border border-argent/50">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-classic/10 flex items-center justify-center text-classic">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </div>
                        <h2 className="text-small font-black text-text-primary uppercase tracking-widest">Estructura del Manual</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { href: "#alerts-catalog", num: "01", title: "Alertas Principales", desc: "Las 5 alertas mas criticas en detalle." },
                            { href: "#alerts-reference", num: "02", title: "Referencia Completa", desc: "Las 16 alertas en tabla resumida." },
                            { href: "#intent-logic", num: "03", title: "Logica de Intencion", desc: "TOFU / MOFU / BOFU scoring." },
                            { href: "#creative-categories", num: "04", title: "Clasificacion", desc: "6 categorias automaticas de creativos." },
                            { href: "#account-health", num: "05", title: "Salud de Cuenta", desc: "Monitoreo automatico de Meta." },
                            { href: "#business-objectives", num: "06", title: "Objetivos de Negocio", desc: "Metricas por tipo de vertical." },
                            { href: "#control-panel", num: "07", title: "Cerebro de Worker", desc: "IA y logica configurable." },
                            { href: "#ai-analyst", num: "08", title: "AI Analyst", desc: "Chat inteligente por canal." },
                            { href: "#brain-sync", num: "09", title: "Sincronizacion", desc: "Cronograma de operaciones diarias." },
                            { href: "#technical-notes", num: "10", title: "Notas Tecnicas", desc: "Detalles de implementacion." },
                        ].map((item) => (
                            <a key={item.href} href={item.href} className="flex items-start gap-3 p-4 hover:bg-stellar/50 transition-colors group">
                                <span
                                    className="text-small font-black text-text-muted group-hover:text-classic transition-colors"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {item.num}
                                </span>
                                <div>
                                    <p className="text-small font-bold text-text-primary mb-0.5">{item.title}</p>
                                    <p className="text-tiny text-text-muted">{item.desc}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>

                {/* ── ALERT CATALOG (Top 5 detailed) ── */}
                <div id="alerts-catalog" className="scroll-mt-24 mb-8">
                    <h2 className="text-subheader text-text-primary mb-2">Alertas Principales</h2>
                    <p className="text-body text-text-secondary max-w-2xl mb-12">
                        Las 5 alertas mas importantes del sistema, explicadas en detalle con ejemplos reales de como aparecen en Slack.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-20">
                    {ALERT_TYPES.map((alert) => (
                        <section key={alert.id} className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start scroll-mt-20 group" id={alert.id}>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-8 ${alert.severity === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' :
                                            alert.severity === 'WARNING' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' :
                                                'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                                            }`} />
                                        <h2 className="text-subheader text-text-primary tracking-tight font-bold">{alert.title}</h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black px-2 py-1 border overflow-hidden ${alert.severity === 'CRITICAL' ? 'border-red-500/20 text-red-500 bg-red-500/5' :
                                            alert.severity === 'WARNING' ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' :
                                                'border-emerald-500/20 text-emerald-500 bg-emerald-500/5'
                                            }`}>
                                            {alert.severity}
                                        </span>
                                        <span className="text-[9px] font-bold text-zinc-500 border border-argent/50 px-2 py-1">
                                            {alert.channel === 'slack_immediate' ? 'SLACK DIARIO' : alert.channel === 'slack_weekly' ? 'SLACK SEMANAL' : 'PANEL'}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-5 bg-special/50 border border-argent/50 group-hover:border-classic/30 transition-all duration-500">
                                    <p className="text-tiny font-bold text-text-muted uppercase mb-2 tracking-widest">Criterio Tecnico</p>
                                    <p className="text-small text-text-primary font-mono leading-relaxed">{alert.logic}</p>
                                </div>

                                <div className="space-y-4 px-1">
                                    <p className="text-body text-text-secondary leading-relaxed">
                                        {alert.description}
                                    </p>

                                    <div className="p-4 bg-classic/5 border-l-2 border-classic">
                                        <div className="flex items-center gap-2 text-classic mb-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            <span className="text-tiny font-black uppercase tracking-tighter">Accion Sugerida</span>
                                        </div>
                                        <div className="text-small text-text-primary font-medium">
                                            {alert.action}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-tiny font-bold text-text-muted uppercase px-1">Ejemplo en Slack</p>
                                <div className="bg-[#1A1D21] text-[#D1D2D3] p-5 border border-white/10 font-sans">
                                    <div className="flex gap-3">
                                        <div className="w-9 h-9 bg-classic flex items-center justify-center text-white font-black text-xs flex-shrink-0">AI</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white text-[15px]">Worker Brain</span>
                                                <span className="text-[12px] text-[#ABABAD]">9:41 AM</span>
                                            </div>
                                            <div className="text-[15px] leading-normal border-l-4 border-classic pl-3 py-1 bg-classic/5">
                                                {alert.example.split('\n').map((line, i) => (
                                                    <div key={i} className={i === 0 ? "font-bold text-white mb-1" : ""}>
                                                        {line.includes('*') ? line.replace(/\*/g, '') : line}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                {/* ── ALERT REFERENCE TABLE (All 16) ── */}
                <div id="alerts-reference" className="mt-32 space-y-8 scroll-mt-24">
                    <div>
                        <h2 className="text-subheader text-text-primary mb-2">Referencia Completa: 16 Alertas</h2>
                        <p className="text-body text-text-secondary max-w-2xl">
                            Tabla resumida de todas las alertas del sistema. Usa esto como cheat sheet para saber que significa cada notificacion y que hacer.
                        </p>
                    </div>

                    <div className="border border-argent overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-argent bg-special">
                                    <th className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 py-3" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Alerta</th>
                                    <th className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 py-3" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Severidad</th>
                                    <th className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 py-3" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Canal</th>
                                    <th className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 py-3" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Cuando se dispara</th>
                                    <th className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 py-3" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>Que hacer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ALL_ALERTS_REFERENCE.map((alert, i) => (
                                    <tr key={alert.type} className={`border-b border-argent/50 ${i % 2 === 0 ? 'bg-stellar' : 'bg-special/30'} hover:bg-classic/5 transition-colors`}>
                                        <td className="px-4 py-3">
                                            <span className="text-[11px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                                                {alert.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 border ${alert.severity === 'CRITICAL' ? 'border-red-500/20 text-red-500 bg-red-500/5' :
                                                alert.severity === 'WARNING' ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' :
                                                    'border-emerald-500/20 text-emerald-500 bg-emerald-500/5'
                                                }`}>
                                                {alert.severity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[11px] text-text-secondary">{alert.channel}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[11px] text-text-secondary leading-relaxed">{alert.trigger}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[11px] text-classic font-medium">{alert.action}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border border-argent/50 bg-special/30">
                        <p className="text-tiny text-text-muted">
                            <strong className="text-text-secondary">Routing:</strong> Las alertas CRITICAL + SCALING_OPPORTUNITY van en el digest diario de Slack.
                            Las WARNING van en el resumen semanal (lunes). Las INFO solo son visibles en el dashboard.
                            Todos los umbrales son configurables desde el Cerebro de Worker.
                        </p>
                    </div>
                </div>

                {/* ── INTENT LOGIC ── */}
                <div id="intent-logic" className="mt-32 space-y-8 scroll-mt-24">
                    <div>
                        <h2 className="text-subheader text-text-primary mb-2">Logica de Intencion (TOFU / MOFU / BOFU)</h2>
                        <p className="text-body text-text-secondary max-w-xl">
                            Como la AI clasifica tus anuncios segun su posicion en el funnel de ventas. Esto determina que metricas se priorizan y que alertas se disparan.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                stage: "TOFU",
                                name: "Top of Funnel",
                                color: "border-blue-500/30 bg-blue-500/5",
                                logic: "Score < 0.35",
                                desc: "Prospeccion pura. Meta detecta interes inicial pero la venta no es inmediata. Se evalua por alcance y CTR, no por conversiones."
                            },
                            {
                                stage: "MOFU",
                                name: "Middle of Funnel",
                                color: "border-amber-500/30 bg-amber-500/5",
                                logic: "Score 0.35 - 0.65",
                                desc: "Consideracion. El usuario ya interactuo o inicio checkout pero no cerro. Se evalua por engagement y senales de intencion."
                            },
                            {
                                stage: "BOFU",
                                name: "Bottom of Funnel",
                                color: "border-emerald-500/30 bg-emerald-500/5",
                                logic: "Score > 0.65",
                                desc: "Cierre. Alta intencion de compra. Aqui el motor busca la escala agresiva y prioriza CPA y ROAS como metricas primarias."
                            }
                        ].map((s) => (
                            <div key={s.stage} className={`p-6 border ${s.color} hover:border-classic/40 transition-all duration-300`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <span
                                        className="text-classic text-lg font-black"
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {s.stage}
                                    </span>
                                    <span className="text-tiny text-text-muted">{s.name}</span>
                                </div>
                                <p className="text-tiny text-classic font-mono mb-3">{s.logic}</p>
                                <p className="text-tiny text-text-secondary leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-special/30 border border-argent/50">
                        <h4 className="text-tiny font-bold text-text-primary uppercase mb-4 tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-classic"></span>
                            Algoritmo de Scoring (Ponderacion)
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: "FITR", value: "30%", detail: "Sales / Clicks" },
                                { label: "Conv Rate", value: "25%", detail: "Sales / Imps" },
                                { label: "CPA", value: "25%", detail: "Efficiency" },
                                { label: "CTR", value: "20%", detail: "Relevance" }
                            ].map(m => (
                                <div key={m.label} className="text-center py-3 bg-stellar/50 border border-argent/20">
                                    <div className="text-small font-black text-text-primary">{m.value}</div>
                                    <div className="text-[10px] text-text-muted font-bold uppercase">{m.label}</div>
                                    <div className="text-[9px] text-classic">{m.detail}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── CREATIVE CATEGORIES ── */}
                <div id="creative-categories" className="mt-32 space-y-8 scroll-mt-24">
                    <div>
                        <h2 className="text-subheader text-text-primary mb-2">Clasificacion Automatica de Creativos</h2>
                        <p className="text-body text-text-secondary max-w-xl">
                            Cada creativo activo se clasifica en 1 de 6 categorias segun su rendimiento real. Esto te permite priorizar al instante que necesita atencion.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                category: "Dominante Escalable",
                                color: "border-emerald-500/40 bg-emerald-500/5",
                                badge: "bg-emerald-500/10 text-emerald-500",
                                condition: "Alto gasto + CPA eficiente",
                                desc: "Tu mejor creativo. Convierte bien y tiene margen para absorber mas presupuesto sin romper metricas.",
                                action: "Escalar budget 20% cada 48h."
                            },
                            {
                                category: "Ganador Saturandose",
                                color: "border-amber-500/40 bg-amber-500/5",
                                badge: "bg-amber-500/10 text-amber-500",
                                condition: "Frecuencia alta + CPA subiendo",
                                desc: "Fue ganador pero muestra fatiga. El publico ya lo vio demasiado y el rendimiento esta cayendo.",
                                action: "Rotar variantes, preparar reemplazo."
                            },
                            {
                                category: "BOFU Oculto",
                                color: "border-blue-500/40 bg-blue-500/5",
                                badge: "bg-blue-500/10 text-blue-500",
                                condition: "Poco gasto + excelente conversion",
                                desc: "Joya escondida. Convierte muy bien pero no tiene suficiente presupuesto asignado. Meta no le esta dando delivery.",
                                action: "Subir presupuesto inmediatamente."
                            },
                            {
                                category: "TOFU Ineficiente",
                                color: "border-red-500/40 bg-red-500/5",
                                badge: "bg-red-500/10 text-red-500",
                                condition: "Mucho gasto + poca eficiencia",
                                desc: "Quema presupuesto sin devolver resultados proporcionales. Cada hora activo es dinero perdido.",
                                action: "Pausar o reestructurar urgente."
                            },
                            {
                                category: "Zombie",
                                color: "border-gray-500/40 bg-gray-500/5",
                                badge: "bg-gray-500/10 text-gray-400",
                                condition: "Gasto minimo + resultados minimos",
                                desc: "No aporta nada significativo. Ni gasta mucho ni convierte. Ocupa lugar en el adset sin justificacion.",
                                action: "Pausar o refrescar creativo."
                            },
                            {
                                category: "Nuevo (Sin Data)",
                                color: "border-purple-500/40 bg-purple-500/5",
                                badge: "bg-purple-500/10 text-purple-400",
                                condition: "<48h activo o <2000 impresiones",
                                desc: "Demasiado nuevo para clasificar. Necesita mas data antes de que cualquier decision tenga sentido.",
                                action: "Esperar y monitorear."
                            }
                        ].map((c) => (
                            <div key={c.category} className={`p-6 border ${c.color} transition-all duration-300 hover:scale-[1.02]`}>
                                <div className="mb-4">
                                    <h3 className="text-small font-bold text-text-primary mb-1">{c.category}</h3>
                                    <span className={`text-[10px] font-black px-2 py-0.5 ${c.badge}`}>{c.condition}</span>
                                </div>
                                <p className="text-tiny text-text-secondary leading-relaxed mb-3">{c.desc}</p>
                                <div className="p-3 bg-stellar/50 border border-argent/20">
                                    <p className="text-tiny text-classic font-medium">{c.action}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── ACCOUNT HEALTH ── */}
                <div id="account-health" className="mt-32 space-y-8 scroll-mt-24">
                    <div>
                        <h2 className="text-subheader text-text-primary mb-2">Salud de Cuenta (Account Health)</h2>
                        <p className="text-body text-text-secondary max-w-xl">
                            Monitoreo automatico del estado de tu cuenta de Meta Ads cada 2 horas. Te evita sorpresas que paren el delivery.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                title: "Estado de Cuenta",
                                desc: "Detecta cambios en el estado (activa, deshabilitada, no liquidada). Si Meta pausa tu cuenta a las 9 AM, lo sabras antes del mediodia.",
                                alert: "Alerta inmediata en Slack si el estado cambia."
                            },
                            {
                                title: "Spend Cap",
                                desc: "Monitorea el gasto acumulado vs el tope configurado en Meta. Te alerta cuando superas el 80% del limite para que no te quedes sin delivery.",
                                alert: "Alerta cuando el gasto se acerca al tope."
                            },
                            {
                                title: "Transiciones de Estado",
                                desc: "Registra cada cambio de estado como un evento auditable. Podes ver el historial completo en la seccion de Sistema.",
                                alert: "Log permanente de todos los cambios."
                            }
                        ].map((h) => (
                            <div key={h.title} className="p-6 bg-special/30 border border-argent/40">
                                <h3 className="text-small font-bold text-text-primary mb-2">{h.title}</h3>
                                <p className="text-tiny text-text-secondary leading-relaxed mb-3">{h.desc}</p>
                                <p className="text-tiny text-classic font-medium">{h.alert}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── BUSINESS OBJECTIVES ── */}
                <div id="business-objectives" className="mt-32 space-y-12 scroll-mt-24">
                    <div>
                        <h2 className="text-subheader text-text-primary mb-2">Objetivos de Negocio y Metricas</h2>
                        <p className="text-body text-text-secondary max-w-2xl">
                            El cerebro adapta su analisis segun tu modelo de negocio. No es lo mismo vender online que generar leads — las metricas, alertas y clasificaciones cambian automaticamente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                type: "eCommerce",
                                metric: "Ventas / Compras",
                                kpi: "ROAS & CPA",
                                logic: "Enfoque en retorno de inversion y costo por venta. Trackea revenue, margenes y valor de orden promedio.",
                                color: "bg-emerald-500"
                            },
                            {
                                type: "Lead Gen",
                                metric: "Leads / Registros",
                                kpi: "CPL",
                                logic: "Optimizacion por volumen de prospeccion y costo por contacto cualificado. ROAS no aplica.",
                                color: "bg-blue-500"
                            },
                            {
                                type: "WhatsApp",
                                metric: "Conversaciones",
                                kpi: "Cost per Link Click",
                                logic: "Para modelos de venta directa por chat. Mide eficiencia en iniciar conversaciones nuevas.",
                                color: "bg-green-500"
                            },
                            {
                                type: "App Installs",
                                metric: "Instalaciones",
                                kpi: "CPI",
                                logic: "Adquisicion de usuarios para apps moviles. Monitorea velocidad de descarga y eventos in-app.",
                                color: "bg-purple-500"
                            }
                        ].map((obj) => (
                            <div key={obj.type} className="p-8 bg-stellar/50 border border-argent/40 relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 w-24 h-24 ${obj.color} opacity-5 -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-700`} />
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3
                                            className="text-small font-black text-text-primary uppercase tracking-tighter"
                                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                        >
                                            {obj.type}
                                        </h3>
                                        <span className="text-[10px] font-bold text-text-muted border border-argent px-2 py-0.5">{obj.kpi}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p
                                            className="text-tiny font-bold text-classic uppercase tracking-widest"
                                            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                        >
                                            Metrica Core: {obj.metric}
                                        </p>
                                        <p className="text-small text-text-secondary leading-relaxed">{obj.logic}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CEREBRO DE WORKER ── */}
                <div id="control-panel" className="mt-32 space-y-12 scroll-mt-24">
                    <div>
                        <h2 className="text-subheader text-text-primary mb-2">Cerebro de Worker: Personalizacion de la AI</h2>
                        <p className="text-body text-text-secondary max-w-2xl">
                            El sistema no es una caja negra. Desde el Cerebro de Worker podes ajustar como piensa la AI, sus instrucciones criticas y las reglas de negocio por cliente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {[
                            {
                                title: "Reporte Consolidado",
                                logic: "Instrucciones de Redaccion",
                                desc: "Define el tono de voz y la estructura de los mensajes de Slack. Es la interfaz humana de la AI — controla que tan tecnico o directo suena el reporte.",
                                details: "Metricas prioritarias, formato de saludo, nivel de detalle.",
                                icon: "01"
                            },
                            {
                                title: "Auditoria Creativa",
                                logic: "Criterios de Evaluacion",
                                desc: "Instruye a la AI sobre que observar en un anuncio: hook visual, cuerpo del mensaje, copy, angulo de venta. Define la vara de calidad creativa.",
                                details: "Calificacion de ganchos visuales y relevancia del mensaje.",
                                icon: "02"
                            },
                            {
                                title: "Variantes de Copy",
                                logic: "Frameworks Creativos",
                                desc: "Reglas de escritura para generar nuevos anuncios basados en el historico de performance. Usa frameworks como AIDA, PAS y restricciones de marca.",
                                details: "Tono de marca, longitud maxima, frameworks de copywriting.",
                                icon: "03"
                            },
                            {
                                title: "Briefs de Diseno",
                                logic: "Estructuracion Tecnica",
                                desc: "Transforma los hallazgos de performance en requerimientos claros para el equipo creativo. Formatos, paletas y elementos clave.",
                                details: "Formatos requeridos, colores, elementos visuales.",
                                icon: "04"
                            },
                            {
                                title: "Logica GEM (Core)",
                                logic: "Umbrales de Negocio",
                                desc: "El motor matematico que dispara las alertas. Son las reglas 'si esto, entonces aquello' — target CPA, ROAS minimo, frecuencia limite.",
                                details: "Target CPA, ROAS minimo, frecuencia limite, velocidad de gasto.",
                                icon: "05"
                            }
                        ].map((m) => (
                            <div key={m.title} className="p-8 bg-stellar/50 border border-argent/50 hover:border-classic/40 transition-all duration-500 group">
                                <div className="flex items-start gap-6">
                                    <div
                                        className="text-classic text-2xl font-black flex-shrink-0 mt-1"
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {m.icon}
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="text-small font-black text-text-primary uppercase tracking-tighter">{m.title}</h4>
                                            <p
                                                className="text-[10px] text-classic font-black uppercase tracking-widest"
                                                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                            >
                                                {m.logic}
                                            </p>
                                        </div>
                                        <p className="text-small text-text-secondary leading-relaxed">{m.desc}</p>
                                        <div className="pt-4 border-t border-argent/30">
                                            <p className="text-tiny text-text-muted">
                                                <strong className="text-text-secondary">Configurable:</strong> {m.details}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-10 bg-classic/5 border border-classic/20 relative overflow-hidden mt-16">
                        <h3 className="text-small font-black text-classic uppercase mb-4 tracking-tighter flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-classic"></span>
                            Arquitectura: Metodologia vs. Fisica
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <h4 className="text-tiny font-black text-text-primary uppercase tracking-widest">1. Prompts (La Metodologia)</h4>
                                <p className="text-small text-text-secondary leading-relaxed">
                                    Los prompts definen <strong>como piensa la AI</strong>. Son el manual de estilo y la metodologia de la agencia. Si queres que la AI sea agresiva, tecnica o conservadora, se define aca. Es el estandar de calidad unificado para todos los clientes.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-tiny font-black text-text-primary uppercase tracking-widest">2. Config (La Fisica)</h4>
                                <p className="text-small text-text-secondary leading-relaxed">
                                    Los umbrales definen <strong>la tolerancia al error</strong> de cada cliente. Dependen del CPA objetivo, la madurez de la cuenta y el volumen diario. Lo que para un cliente es un exito, para otro es una fuga de presupuesto. Es la sintonía fina del motor.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── AI ANALYST ── */}
                <div id="ai-analyst" className="mt-32 space-y-12 scroll-mt-24">
                    <div>
                        <h2 className="text-subheader text-text-primary mb-2">AI Analyst: Chat Inteligente por Canal</h2>
                        <p className="text-body text-text-secondary max-w-2xl">
                            Un analista conversacional que entiende tu data en tiempo real. Hacele preguntas sobre cualquier canal y recibis respuestas con contexto completo de tu cuenta — no es un chatbot generico, es un especialista entrenado en cada plataforma.
                        </p>
                    </div>

                    {/* How it works */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                step: "01",
                                title: "Abris el panel",
                                desc: "Desde cualquier canal (Meta, Google, Ecommerce, Email) tocas 'Analizar con IA'. Se abre un chat a la derecha con preguntas sugeridas segun el canal."
                            },
                            {
                                step: "02",
                                title: "Preguntas lo que quieras",
                                desc: "El analyst recibe automaticamente toda la data de tu cuenta: metricas, campanas, productos, atribucion. No necesitas copiar y pegar nada."
                            },
                            {
                                step: "03",
                                title: "Respuesta con contexto",
                                desc: "La respuesta incluye benchmarks de la industria, diagnosticos especificos y recomendaciones accionables. Podes hacer follow-ups en la misma conversacion."
                            }
                        ].map((s) => (
                            <div key={s.step} className="p-6 bg-special/30 border border-argent/40 hover:border-classic/30 transition-all duration-300">
                                <span
                                    className="text-classic text-2xl font-black block mb-3"
                                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                >
                                    {s.step}
                                </span>
                                <h4 className="text-small font-bold text-text-primary mb-2">{s.title}</h4>
                                <p className="text-tiny text-text-secondary leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Prompt Stacking Architecture */}
                    <div className="p-10 bg-classic/5 border border-classic/20 relative overflow-hidden">
                        <h3 className="text-small font-black text-classic uppercase mb-6 tracking-tighter flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-classic"></span>
                            Como piensa el Analyst (Prompt Stacking)
                        </h3>
                        <p className="text-small text-text-secondary leading-relaxed mb-8 max-w-2xl">
                            El Analyst no es un chatbot generico — tiene 4 capas de conocimiento que se apilan para cada conversacion. Esto es lo que lo hace un especialista y no un asistente generico.
                        </p>

                        <div className="space-y-4">
                            {[
                                {
                                    layer: "1",
                                    name: "Rol Base",
                                    desc: "Define la personalidad: analista senior de performance marketing, responde en espanol, max 250 palabras, termina con recomendacion accionable.",
                                    color: "border-blue-500/30 bg-blue-500/5",
                                    tag: "FIJO"
                                },
                                {
                                    layer: "2",
                                    name: "Expertise del Canal",
                                    desc: "Conocimiento profundo de cada plataforma. Para Meta: framework de 6 Elements, benchmarks de hook rate, diagnostico de fatiga. Para Google: Quality Score, Impression Share, GAQL. Para Ecommerce: LTV, abandoned carts, benchmarks LATAM. Para Email: deliverability, engagement rates, flows vs campaigns.",
                                    color: "border-emerald-500/30 bg-emerald-500/5",
                                    tag: "EDITABLE"
                                },
                                {
                                    layer: "3",
                                    name: "Contexto del Negocio",
                                    desc: "Perfil del cliente: nombre, industria, growth mode, tolerancia a fatiga, funnel priority, LTV. Se inyecta automaticamente desde la configuracion del cliente.",
                                    color: "border-amber-500/30 bg-amber-500/5",
                                    tag: "AUTOMATICO"
                                },
                                {
                                    layer: "4",
                                    name: "Data en Vivo",
                                    desc: "Metricas reales del periodo seleccionado: KPIs, campanas, productos top, atribucion, creativos. Se genera en cada conversacion a partir de la data sincronizada.",
                                    color: "border-purple-500/30 bg-purple-500/5",
                                    tag: "AUTOMATICO"
                                }
                            ].map((l) => (
                                <div key={l.layer} className={`p-5 border ${l.color} flex items-start gap-5`}>
                                    <span
                                        className="text-classic text-lg font-black flex-shrink-0 mt-0.5"
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        L{l.layer}
                                    </span>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="text-small font-bold text-text-primary">{l.name}</h4>
                                            <span className="text-[9px] font-black text-text-muted border border-argent px-1.5 py-0.5 uppercase tracking-widest">
                                                {l.tag}
                                            </span>
                                        </div>
                                        <p className="text-tiny text-text-secondary leading-relaxed">{l.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Channel specializations */}
                    <div>
                        <h3 className="text-small font-black text-text-primary uppercase mb-6 tracking-tighter">Especializaciones por Canal</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                {
                                    channel: "Meta Ads",
                                    expertise: "Framework 6 Elements, hook rate > 25%, hold rate > 30%, diagnostico de fatiga creativa, CPM por vertical, optimizacion por objetivo (ventas, leads, WhatsApp).",
                                    color: "border-blue-500/30"
                                },
                                {
                                    channel: "Google Ads",
                                    expertise: "Quality Score por componente, Impression Share diagnostics, tabla comparativa Search vs PMax vs Shopping vs Display, search terms analysis, video metrics.",
                                    color: "border-emerald-500/30"
                                },
                                {
                                    channel: "Ecommerce",
                                    expertise: "Gross vs Net revenue, customer LTV por cohorte, abandoned carts (>70% normal LATAM), atribucion UTM, dependency de productos, metricas por plataforma (Shopify/TN/WooCommerce).",
                                    color: "border-amber-500/30"
                                },
                                {
                                    channel: "Email Marketing",
                                    expertise: "Deliverability (bounce < 2%, spam < 0.1%), engagement benchmarks LATAM, diagnostic tree (Open Rate + Click Rate), campaigns vs flows revenue split, Klaviyo vs Perfit specifics.",
                                    color: "border-purple-500/30"
                                }
                            ].map((ch) => (
                                <div key={ch.channel} className={`p-6 border ${ch.color} bg-stellar/50`}>
                                    <h4 className="text-small font-bold text-text-primary mb-2">{ch.channel}</h4>
                                    <p className="text-tiny text-text-secondary leading-relaxed">{ch.expertise}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Customization note */}
                    <div className="p-4 border border-argent/50 bg-special/30">
                        <p className="text-tiny text-text-muted">
                            <strong className="text-text-secondary">Personalizable:</strong> La Capa 2 (expertise del canal) se puede editar desde el Cerebro de Worker, pestana &quot;AI Analyst&quot;.
                            Si modificas el prompt de un canal, se marca con un punto naranja y se usa tu version personalizada en lugar del default.
                            Los cambios aplican a todas las conversaciones nuevas — las existentes mantienen el prompt con el que empezaron.
                        </p>
                    </div>
                </div>

                {/* ── BRAIN SYNC TIMELINE ── */}
                <div id="brain-sync" className="mt-32 p-10 bg-special/20 border border-argent/30 relative overflow-hidden scroll-mt-24">
                    <h2 className="text-subheader text-text-primary mb-8">Operatividad del Cerebro (Sincronizacion)</h2>

                    <div className="space-y-12 relative">
                        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-argent/30 border-dashed border-l" />

                        {[
                            {
                                time: "09:00 AM",
                                title: "Channel Sync (Meta, Google, Ecommerce, Email)",
                                desc: "El sistema descarga la data completa del dia anterior de todos los canales configurados: Meta Ads, Google Ads, Ecommerce (Shopify/TiendaNube/WooCommerce) y Email (Klaviyo/Perfit). Se escribe 1 snapshot por canal por cliente en channel_snapshots."
                            },
                            {
                                time: "10:00 AM",
                                title: "Data Sync + Rolling Metrics",
                                desc: "Con la data de canales ya sincronizada, se calculan las metricas rolling (7d y 14d) de Meta, se generan los client_snapshots con alertas y clasificaciones, y se envia el Daily Digest a Slack."
                            },
                            {
                                time: "10:30 AM",
                                title: "AI Assessment (Gemini)",
                                desc: "La AI analiza los nuevos creativos y los cambios de tendencia. Identifica fatiga, reclasifica anuncios en el funnel y actualiza patrones ganadores."
                            },
                            {
                                time: "Cada 2 horas",
                                title: "Account Health Check",
                                desc: "El sistema verifica el estado de la cuenta de Meta (activa/deshabilitada), gasto acumulado vs spend cap y detecta cualquier transicion de estado."
                            },
                            {
                                time: "Lunes 9 AM",
                                title: "Weekly Digest",
                                desc: "Resumen semanal con KPIs WoW (week-over-week) y todas las alertas WARNING acumuladas. Ideal para la revision de inicio de semana."
                            },
                            {
                                time: "Al crear cliente",
                                title: "Backfill Automatico",
                                desc: "Cuando se crea un cliente nuevo o se habilita un canal, el sistema automaticamente descarga la data historica del quarter actual (ej: 1 de enero a ayer). No es necesario correr scripts manuales."
                            }
                        ].map((step, i) => (
                            <div key={i} className="relative pl-12">
                                <div className="absolute left-0 top-1.5 w-8 h-8 bg-stellar border-2 border-classic flex items-center justify-center font-bold text-classic text-[10px] z-10">
                                    {i + 1}
                                </div>
                                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                                    <span
                                        className="text-tiny font-black text-classic bg-classic/10 px-2 py-0.5 uppercase tracking-tighter"
                                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                                    >
                                        {step.time}
                                    </span>
                                    <h4 className="text-small font-bold text-text-primary">{step.title}</h4>
                                </div>
                                <p className="text-small text-text-secondary leading-relaxed max-w-2xl">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── TECHNICAL NOTES ── */}
                <div id="technical-notes" className="mt-20 p-8 bg-stellar border border-argent border-dashed scroll-mt-24">
                    <h3
                        className="text-small font-bold text-text-primary uppercase mb-6"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                    >
                        Notas Tecnicas para Media Buyers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-small text-text-secondary">
                        <div className="space-y-4">
                            <div className="p-4 border border-argent/30">
                                <p className="text-tiny font-bold text-text-primary uppercase mb-1 tracking-widest">Ventana de Atribucion</p>
                                <p>El sistema procesa la data completa una vez al dia para respetar la ventana de atribucion de Meta. No usa data parcial del dia en curso.</p>
                            </div>
                            <div className="p-4 border border-argent/30">
                                <p className="text-tiny font-bold text-text-primary uppercase mb-1 tracking-widest">Rolling 7D</p>
                                <p>Usamos una ventana de 7 dias para que un dia malo o excepcional no sesgue las decisiones de la AI.</p>
                            </div>
                            <div className="p-4 border border-argent/30">
                                <p className="text-tiny font-bold text-text-primary uppercase mb-1 tracking-widest">Cache de Navegacion</p>
                                <p>El sistema cachea snapshots en memoria. Saltar entre Dashboard y Ads Manager no genera esperas de carga.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 border border-argent/30">
                                <p className="text-tiny font-bold text-text-primary uppercase mb-1 tracking-widest">Prompts Auditables</p>
                                <p>Todos los prompts e instrucciones criticas se pueden ver y editar desde el Cerebro de Worker en Admin.</p>
                            </div>
                            <div className="p-4 border border-argent/30">
                                <p className="text-tiny font-bold text-text-primary uppercase mb-1 tracking-widest">Deteccion de Fatiga</p>
                                <p>Se cruza el incremento de frecuencia con la degradacion del CTR en las ultimas 72hs. No depende de un solo indicador.</p>
                            </div>
                            <div className="p-4 border border-argent/30">
                                <p className="text-tiny font-bold text-text-primary uppercase mb-1 tracking-widest">Creative DNA</p>
                                <p>Gemini Vision analiza atributos visuales y de copy de cada creativo: estilo, hook, color, texto, producto, tono emocional.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
