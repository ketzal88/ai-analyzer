"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";

const ALERT_TYPES = [
    {
        id: "SCALING_OPPORTUNITY",
        title: "Oportunidad de Escala",
        severity: "LOW",
        logic: "CPA por debajo del target + Gasto estable + Frecuencia controlada (< 4).",
        description: "Señal consolidada. El algoritmo ha encontrado una veta de eficiencia que puede absorber más presupuesto sin romper el CPA.",
        example: "Oportunidad de Escala: Campaña Prospección\nSeñal consolidada. CPA $12.5 (target: $15.0). Velocidad estable. Frecuencia 1.8 OK.",
        action: "Incrementar presupuesto entre 20% y 30% cada 48hs."
    },
    {
        id: "CPA_SPIKE",
        title: "Pico de CPA (CPA Spike)",
        severity: "MEDIUM",
        logic: "CPA incremental > 25% respecto a los últimos 7 días.",
        description: "Alerta de desviación. El costo por adquisición ha subido bruscamente, indicando una posible fatiga o un cambio en el entorno de subasta.",
        example: "Pico de CPA en Conjunto Retargeting\nEl CPA ha subido un 35% en comparación con el período anterior ($18.0 vs $13.3).",
        action: "Auditar anuncios con mayor gasto. Verificar si el CTR ha caído."
    },
    {
        id: "BUDGET_BLEED",
        title: "Fuga de Presupuesto (Budget Bleed)",
        severity: "CRITICAL",
        logic: "Gasto > 2x Target CPA sin ninguna conversión registrada.",
        description: "Alerta crítica de ineficiencia. Se está quemando dinero en un asset que no está devolviendo señales de conversión.",
        example: "Fuga de Presupuesto: Adset Intereses\nSe han gastado $45.0 (> 2x Target CPA) sin registrar conversiones.",
        action: "Apagar el adset o rotar creativos inmediatamente."
    },
    {
        id: "LEARNING_RESET_RISK",
        title: "Riesgo de Reinicio de Aprendizaje",
        severity: "MEDIUM",
        logic: "Cambio de presupuesto > 30% en menos de 48-72hs.",
        description: "Evita que el algoritmo vuelva a fase de aprendizaje ('Learning'). Los cambios bruscos resetean la optimización de Meta.",
        example: "Riesgo de Reinicio de Aprendizaje: Campaña Advantage+\nCambio de budget de 45% (> 30%) con edición reciente.",
        action: "Escalar de forma más gradual (máximo 20% por vez)."
    },
    {
        id: "ROTATE_CONCEPT",
        title: "Rotar Creativo (Concept Fatigue)",
        severity: "MEDIUM",
        logic: "Frecuencia > 4 + CPA arriba del target.",
        description: "El público ya vio demasiado el anuncio. El Hook Rate suele bajar y el CPA subir.",
        example: "Rotar Creativo: Video Testimonial v1\nFatiga detectada. Hook rate 12% con frecuencia 4.2.",
        action: "Introducir una nueva variante visual o cambiar el ángulo del mensaje."
    }
];

export default function AlertsAcademyPage() {
    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-20">
                <div className="mb-12">
                    <h1 className="text-hero text-text-primary mb-2">AI Handbook: Guía de Alertas</h1>
                    <p className="text-body text-text-secondary max-w-2xl">
                        Este manual explica la lógica detrás del cerebro de optimización. Utiliza estas guías para entender por qué recibes cada notificación en Slack y qué acciones tomar.
                    </p>
                </div>

                {/* Glosario / Table of Contents */}
                <div className="mb-20 p-8 bg-special border border-argent/50 rounded-3xl shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-classic/10 flex items-center justify-center text-classic">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </div>
                        <h2 className="text-small font-black text-text-primary uppercase tracking-widest">Estructura del Manual</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <a href="#alerts-catalog" className="flex items-start gap-4 p-4 rounded-xl hover:bg-stellar/50 transition-colors group">
                            <span className="text-small font-black text-text-muted group-hover:text-classic transition-colors">01</span>
                            <div>
                                <p className="text-small font-bold text-text-primary mb-1">Alertas</p>
                                <p className="text-tiny text-text-muted">Notificaciones y acciones.</p>
                            </div>
                        </a>
                        <a href="#intent-logic" className="flex items-start gap-4 p-4 rounded-xl hover:bg-stellar/50 transition-colors group">
                            <span className="text-small font-black text-text-muted group-hover:text-classic transition-colors">02</span>
                            <div>
                                <p className="text-small font-bold text-text-primary mb-1">Intención</p>
                                <p className="text-tiny text-text-muted">TOFU / MOFU / BOFU.</p>
                            </div>
                        </a>
                        <a href="#creative-categories" className="flex items-start gap-4 p-4 rounded-xl hover:bg-stellar/50 transition-colors group">
                            <span className="text-small font-black text-text-muted group-hover:text-classic transition-colors">03</span>
                            <div>
                                <p className="text-small font-bold text-text-primary mb-1">Clasificación</p>
                                <p className="text-tiny text-text-muted">6 categorías de creativos.</p>
                            </div>
                        </a>
                        <a href="#account-health" className="flex items-start gap-4 p-4 rounded-xl hover:bg-stellar/50 transition-colors group">
                            <span className="text-small font-black text-text-muted group-hover:text-classic transition-colors">04</span>
                            <div>
                                <p className="text-small font-bold text-text-primary mb-1">Salud de Cuenta</p>
                                <p className="text-tiny text-text-muted">Monitoreo automático Meta.</p>
                            </div>
                        </a>
                        <a href="#control-panel" className="flex items-start gap-4 p-4 rounded-xl hover:bg-stellar/50 transition-colors group">
                            <span className="text-small font-black text-text-muted group-hover:text-classic transition-colors">05</span>
                            <div>
                                <p className="text-small font-bold text-text-primary mb-1">Cerebro</p>
                                <p className="text-tiny text-text-muted">IA y lógica configurables.</p>
                            </div>
                        </a>
                        <a href="#brain-sync" className="flex items-start gap-4 p-4 rounded-xl hover:bg-stellar/50 transition-colors group">
                            <span className="text-small font-black text-text-muted group-hover:text-classic transition-colors">06</span>
                            <div>
                                <p className="text-small font-bold text-text-primary mb-1">Sincronización</p>
                                <p className="text-tiny text-text-muted">Cronograma de operaciones.</p>
                            </div>
                        </a>
                    </div>
                </div>

                <div id="alerts-catalog" className="grid grid-cols-1 gap-20 scroll-mt-24">
                    {ALERT_TYPES.map((alert) => (
                        <section key={alert.id} className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start scroll-mt-20 group" id={alert.id}>
                            {/* Logic & Description */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-8 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' :
                                            alert.severity === 'MEDIUM' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' :
                                                'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                                            }`} />
                                        <h2 className="text-subheader text-text-primary tracking-tight font-bold">{alert.title}</h2>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-1 rounded border overflow-hidden ${alert.severity === 'CRITICAL' ? 'border-red-500/20 text-red-500 bg-red-500/5' :
                                        alert.severity === 'MEDIUM' ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' :
                                            'border-emerald-500/20 text-emerald-500 bg-emerald-500/5'
                                        }`}>
                                        {alert.severity}
                                    </span>
                                </div>

                                <div className="p-5 bg-special/50 backdrop-blur-md border border-argent/50 rounded-xl group-hover:border-classic/30 transition-all duration-500 shadow-lg">
                                    <p className="text-tiny font-bold text-text-muted uppercase mb-2 tracking-widest">Criterio Técnico</p>
                                    <p className="text-small text-text-primary font-mono leading-relaxed">{alert.logic}</p>
                                </div>

                                <div className="space-y-4 px-1">
                                    <p className="text-body text-text-secondary leading-relaxed first-letter:text-2xl first-letter:font-bold first-letter:text-text-primary">
                                        {alert.description}
                                    </p>

                                    <div className="p-4 bg-classic/5 border-l-2 border-classic rounded-r-lg">
                                        <div className="flex items-center gap-2 text-classic mb-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            <span className="text-tiny font-black uppercase tracking-tighter">Acción Sugerida</span>
                                        </div>
                                        <div className="text-small text-text-primary font-medium italic">
                                            {alert.action}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* visual Example */}
                            <div className="space-y-3">
                                <p className="text-tiny font-bold text-text-muted uppercase px-1">Visualización en Slack (Ejemplo)</p>
                                <div className="bg-[#1A1D21] text-[#D1D2D3] p-5 rounded-lg border border-white/10 font-sans shadow-xl">
                                    <div className="flex gap-3">
                                        <div className="w-9 h-9 bg-classic rounded flex items-center justify-center text-white font-black text-xs">AI</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white text-[15px]">AI Analyzer Bot</span>
                                                <span className="text-[12px] text-[#ABABAD]">9:41 AM</span>
                                            </div>
                                            <div className="text-[15px] leading-normal border-l-4 border-classic pl-3 py-1 bg-classic/5 rounded">
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

                {/* Intent Engine Guide */}
                <div id="intent-logic" className="mt-32 space-y-8 scroll-mt-24">
                    <div className="text-center">
                        <h2 className="text-subheader text-text-primary mb-2">Lógica de Intención (TOFU/MOFU/BOFU)</h2>
                        <p className="text-body text-text-secondary max-w-xl mx-auto">
                            Cómo la IA clasifica tus anuncios según su posición en el embudo de ventas.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                stage: "TOFU",
                                name: "Top of Funnel",
                                icon: "🏔️",
                                logic: "Score < 0.35",
                                desc: "Anuncios de prospección pura. Meta detecta interés inicial pero la venta no es inmediata."
                            },
                            {
                                stage: "MOFU",
                                name: "Middle of Funnel",
                                icon: "🌓",
                                logic: "Score 0.35 - 0.65",
                                desc: "Consideración. El usuario ya interactuó o inició checkout pero no cerró la compra."
                            },
                            {
                                stage: "BOFU",
                                name: "Bottom of Funnel",
                                icon: "🎯",
                                logic: "Score > 0.65",
                                desc: "Cierre. Alta intención de compra. Aquí es donde el motor busca la escala agresiva."
                            }
                        ].map((s) => (
                            <div key={s.stage} className="p-6 bg-stellar/30 border border-argent/40 rounded-2xl hover:border-classic/40 transition-all duration-300">
                                <div className="text-3xl mb-4">{s.icon}</div>
                                <h3 className="text-small font-bold text-text-primary mb-1">{s.name}</h3>
                                <p className="text-tiny text-classic font-mono mb-3">{s.logic}</p>
                                <p className="text-tiny text-text-muted leading-relaxed">
                                    {s.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-special/30 border border-argent/50 rounded-xl">
                        <h4 className="text-tiny font-bold text-text-primary uppercase mb-4 tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-classic rounded-full"></span>
                            Algoritmo de Scoring (Ponderación)
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: "FITR", value: "30%", detail: "Sales / Clicks" },
                                { label: "Conv Rate", value: "25%", detail: "Sales / Imps" },
                                { label: "CPA", value: "25%", detail: "Efficiency" },
                                { label: "CTR", value: "20%", detail: "Relevance" }
                            ].map(m => (
                                <div key={m.label} className="text-center py-3 bg-stellar/50 rounded-lg border border-argent/20">
                                    <div className="text-small font-black text-text-primary">{m.value}</div>
                                    <div className="text-[10px] text-text-muted font-bold uppercase">{m.label}</div>
                                    <div className="text-[9px] text-classic italic">{m.detail}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Creative Categories */}
                <div id="creative-categories" className="mt-32 space-y-8 scroll-mt-24">
                    <div className="text-center">
                        <h2 className="text-subheader text-text-primary mb-2">Clasificación Automática de Creativos</h2>
                        <p className="text-body text-text-secondary max-w-xl mx-auto">
                            El sistema clasifica cada creativo en una de 6 categorías según su rendimiento. Esto te permite priorizar rápidamente qué necesita atención.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                category: "Dominante Escalable",
                                icon: "🚀",
                                color: "border-emerald-500/40 bg-emerald-500/5",
                                badge: "bg-emerald-500/10 text-emerald-500",
                                condition: "Alto gasto + CPA eficiente",
                                desc: "Tu mejor creativo. Está convirtiendo bien y tiene margen para absorber más presupuesto.",
                                action: "Escalar presupuesto gradualmente (20% cada 48h)."
                            },
                            {
                                category: "Ganador Saturándose",
                                icon: "⚠️",
                                color: "border-amber-500/40 bg-amber-500/5",
                                badge: "bg-amber-500/10 text-amber-500",
                                condition: "Frecuencia alta + CPA subiendo",
                                desc: "Fue un ganador pero muestra señales de fatiga. El público ya lo vio demasiado.",
                                action: "Rotar variantes, preparar reemplazo."
                            },
                            {
                                category: "BOFU Oculto",
                                icon: "💎",
                                color: "border-blue-500/40 bg-blue-500/5",
                                badge: "bg-blue-500/10 text-blue-500",
                                condition: "Poco gasto + excelente conversión",
                                desc: "Joya escondida. Convierte muy bien pero no tiene suficiente presupuesto asignado.",
                                action: "Subir presupuesto inmediatamente."
                            },
                            {
                                category: "TOFU Ineficiente",
                                icon: "🔥",
                                color: "border-red-500/40 bg-red-500/5",
                                badge: "bg-red-500/10 text-red-500",
                                condition: "Mucho gasto + poca eficiencia",
                                desc: "Está quemando presupuesto sin devolver resultados proporcionales.",
                                action: "Pausar o reestructurar urgente."
                            },
                            {
                                category: "Zombie",
                                icon: "👻",
                                color: "border-gray-500/40 bg-gray-500/5",
                                badge: "bg-gray-500/10 text-gray-400",
                                condition: "Gasto mínimo + resultados mínimos",
                                desc: "No aporta nada significativo. Ni gasta mucho ni convierte.",
                                action: "Pausar o refrescar creativo."
                            },
                            {
                                category: "Nuevo (Sin Data)",
                                icon: "🆕",
                                color: "border-purple-500/40 bg-purple-500/5",
                                badge: "bg-purple-500/10 text-purple-400",
                                condition: "<48h activo o <2000 impresiones",
                                desc: "Demasiado nuevo para clasificar. Necesita más data antes de tomar decisiones.",
                                action: "Esperar y monitorear."
                            }
                        ].map((c) => (
                            <div key={c.category} className={`p-6 border rounded-2xl ${c.color} transition-all duration-300 hover:scale-[1.02]`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-2xl">{c.icon}</span>
                                    <div>
                                        <h3 className="text-small font-bold text-text-primary">{c.category}</h3>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${c.badge}`}>{c.condition}</span>
                                    </div>
                                </div>
                                <p className="text-tiny text-text-secondary leading-relaxed mb-3">{c.desc}</p>
                                <div className="p-3 bg-stellar/50 rounded-lg border border-argent/20">
                                    <p className="text-tiny text-classic font-medium">{c.action}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Account Health */}
                <div id="account-health" className="mt-32 space-y-8 scroll-mt-24">
                    <div className="text-center">
                        <h2 className="text-subheader text-text-primary mb-2">Salud de Cuenta (Account Health)</h2>
                        <p className="text-body text-text-secondary max-w-xl mx-auto">
                            Monitoreo automático del estado de tu cuenta de Meta Ads cada 2 horas. Te evita sorpresas.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                title: "Estado de Cuenta",
                                icon: "🔒",
                                desc: "Detecta cambios en el estado de tu cuenta (activa, deshabilitada, no liquidada). Si Meta pausa tu cuenta a las 9 AM, lo sabrás antes del mediodía.",
                                alert: "Alerta inmediata en Slack si el estado cambia."
                            },
                            {
                                title: "Spend Cap (Tope de Gasto)",
                                icon: "📊",
                                desc: "Monitorea el gasto acumulado vs el tope configurado en Meta. Te alerta cuando superas el 80% del límite para que no te quedes sin delivery.",
                                alert: "Alerta cuando el gasto se acerca al tope."
                            },
                            {
                                title: "Transiciones de Estado",
                                icon: "🔄",
                                desc: "Registra cada cambio de estado como un evento auditable. Puedes ver el historial completo en la sección de Sistema.",
                                alert: "Log permanente de todos los cambios."
                            }
                        ].map((h) => (
                            <div key={h.title} className="p-6 bg-stellar/30 border border-argent/40 rounded-2xl">
                                <div className="text-3xl mb-4">{h.icon}</div>
                                <h3 className="text-small font-bold text-text-primary mb-2">{h.title}</h3>
                                <p className="text-tiny text-text-secondary leading-relaxed mb-3">{h.desc}</p>
                                <p className="text-tiny text-classic font-medium italic">{h.alert}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Business Objectives & Metrics */}
                <div id="business-objectives" className="mt-32 space-y-12 scroll-mt-24">
                    <div className="text-center">
                        <h2 className="text-subheader text-text-primary mb-2">Objetivos de Negocio y Métricas Primarias</h2>
                        <p className="text-body text-text-secondary max-w-2xl mx-auto">
                            El cerebro adapta su análisis según el modelo de negocio del cliente, priorizando diferentes KPIs para las alertas y recomendaciones.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                type: "eCommerce",
                                metric: "Ventas / Compras",
                                kpi: "ROAS & CPA",
                                logic: "Enfoque en retorno de inversión publicitaria y costo por venta. El motor rastrea revenue y márgenes.",
                                color: "bg-emerald-500"
                            },
                            {
                                type: "Lead Gen",
                                metric: "Leads / Registros",
                                kpi: "CPL (Cost Per Lead)",
                                logic: "Optimización basada en volumen de prospección y costo por contacto cualificado. Ignora ROAS.",
                                color: "bg-blue-500"
                            },
                            {
                                type: "WhatsApp",
                                metric: "Conversaciones",
                                kpi: "Cost per Link Click",
                                logic: "Ideal para modelos de venta directa por chat. Mide la eficiencia en iniciar conversaciones nuevas.",
                                color: "bg-green-500"
                            },
                            {
                                type: "App Installs",
                                metric: "Instalaciones",
                                kpi: "CPI (Cost Per Install)",
                                logic: "Enfoque en adquisición de usuarios para aplicaciones móviles. Monitorea la velocidad de descarga.",
                                color: "bg-purple-500"
                            }
                        ].map((obj) => (
                            <div key={obj.type} className="p-8 bg-stellar/50 border border-argent/40 rounded-3xl relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 w-24 h-24 ${obj.color} opacity-5 -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-700`} />
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-small font-black text-text-primary uppercase tracking-tighter">{obj.type}</h3>
                                        <span className="text-[10px] font-bold text-text-muted border border-argent px-2 py-0.5 rounded">{obj.kpi}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-tiny font-bold text-classic uppercase tracking-widest">Métrica Core: {obj.metric}</p>
                                        <p className="text-small text-text-secondary leading-relaxed">
                                            {obj.logic}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Control Panel Section */}
                <div id="control-panel" className="mt-32 space-y-12 scroll-mt-24">
                    <div className="text-center">
                        <h2 className="text-subheader text-text-primary mb-2">Cerebro de Worker: Personalización de la IA</h2>
                        <p className="text-body text-text-secondary max-w-2xl mx-auto">
                            El sistema no es una &quot;caja negra&quot;. Desde el Cerebro de Worker (Admin), puedes ajustar cómo piensa la IA, sus instrucciones críticas y las reglas de negocio por cliente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {[
                            {
                                title: "Reporte (Consolidado)",
                                logic: "Instrucciones de Redacción",
                                desc: "Define el tono de voz y la estructura de los mensajes de Slack. Es la interfaz humana de la IA.",
                                details: "Métricas prioritarias, formato de saludo, nivel de detalle técnico.",
                                icon: "📝"
                            },
                            {
                                title: "Auditoría Creativa",
                                logic: "Criterios de Evaluación",
                                desc: "Instruye a la IA sobre qué observar en un anuncio (Visual Hook, Cuerpo, Copy, Ángulo).",
                                details: "Calificación de ganchos visuales y relevancia del mensaje.",
                                icon: "👁️"
                            },
                            {
                                title: "Ads Copy (Variantes)",
                                logic: "Frameworks Creativos",
                                desc: "Reglas de escritura para generar nuevos anuncios basados en el histórico de performance.",
                                details: "Uso de AIDA, PAS, tono de marca y restricciones de longitud.",
                                icon: "✍️"
                            },
                            {
                                title: "Briefs de Diseño",
                                logic: "Estructuración Técnica",
                                desc: "Transforma hallazgos de performance en requerimientos claros para el equipo creativo.",
                                details: "Formatos requeridos, paletas de colores y elementos visuales clave.",
                                icon: "🎨"
                            },
                            {
                                title: "Lógica GEM (Core)",
                                logic: "Umbrales de Negocio",
                                desc: "El motor matemático que dispara las alertas. Son las reglas 'Si esto, entonces aquello'.",
                                details: "Target CPA, ROAS mínimo, Frecuencia límite y velocidad de gasto.",
                                icon: "⚙️"
                            }
                        ].map((m) => (
                            <div key={m.title} className="p-8 bg-stellar/50 border border-argent/50 rounded-3xl hover:border-classic/40 transition-all duration-500 group">
                                <div className="flex items-start gap-6">
                                    <div className="text-4xl bg-special p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">{m.icon}</div>
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="text-small font-black text-text-primary uppercase tracking-tighter">{m.title}</h4>
                                            <p className="text-[10px] text-classic font-black uppercase tracking-widest">{m.logic}</p>
                                        </div>
                                        <p className="text-small text-text-secondary leading-relaxed">
                                            {m.desc}
                                        </p>
                                        <div className="pt-4 border-t border-argent/30">
                                            <p className="text-tiny text-text-muted italic">
                                                <strong>Configurable:</strong> {m.details}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-10 bg-classic/5 border border-classic/20 rounded-3xl relative overflow-hidden group mt-16">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                            <svg className="w-24 h-24 text-classic" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                            </svg>
                        </div>
                        <h3 className="text-small font-black text-classic uppercase mb-4 tracking-tighter flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-classic rounded-full"></span>
                            Arquitectura Estratégica: Metodología vs. Física
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <h4 className="text-tiny font-black text-text-primary uppercase tracking-widest">1. Prompts (La Metodología)</h4>
                                <p className="text-small text-text-secondary leading-relaxed">
                                    Los prompts definen <strong>cómo piensa la IA</strong>. Son el manual de estilo y la metodología de la agencia. Si decides que la IA debe ser agresiva o técnica, eso se define aquí y aplica a toda la operación. Es el estándar de calidad unificado.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-tiny font-black text-text-primary uppercase tracking-widest">2. Configuración (La Física)</h4>
                                <p className="text-small text-text-secondary leading-relaxed">
                                    Los umbrales definen <strong>la tolerancia al error</strong> de cada cliente. Depende del CPA objetivo, la madurez de la cuenta y el volumen diario. Lo que para un cliente es un "éxito", para otro puede ser una "fuga de presupuesto". Es la sintonía fina del motor.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Brain Operations Section */}
                <div id="brain-sync" className="mt-32 p-10 bg-special/20 border border-argent/30 rounded-3xl relative overflow-hidden scroll-mt-24">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                        </svg>
                    </div>

                    <h2 className="text-subheader text-text-primary mb-8 flex items-center gap-3">
                        🧠 Operatividad del Cerebro (Sincronización)
                    </h2>

                    <div className="space-y-12 relative">
                        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-argent/30 border-dashed border-l" />

                        {[
                            {
                                time: "08:00 AM",
                                title: "Data Sync (Meta ↔ DB)",
                                desc: "El sistema descarga toda la data de la API de Meta del día anterior. Se calculan las métricas 'Rolling' (últimos 7 y 14 días) para normalizar la data."
                            },
                            {
                                time: "08:30 AM",
                                title: "AI Assessment (Gemini)",
                                desc: "La IA analiza los nuevos creativos y los cambios de tendencia. Identifica fatiga y reclasifica los anuncios en el embudo (TOFU/MOFU/BOFU)."
                            },
                            {
                                time: "09:00 AM",
                                title: "Daily Digest & Alertas",
                                desc: "Se dispara el reporte consolidado a Slack. Las alertas de optimización (Escala, Rotación) se organizan según su importancia."
                            },
                            {
                                time: "Cada 2 Horas",
                                title: "Account Health Check",
                                desc: "El sistema verifica el estado de la cuenta de Meta (activa/deshabilitada), gasto acumulado vs spend cap y detecta transiciones de estado."
                            },
                            {
                                time: "En Tiempo Real",
                                title: "Auditoría de Creativos",
                                desc: "Cada vez que subes un nuevo anuncio a Meta, el sistema lo detecta, crea su huella digital y le pide a la IA un reporte creativo inicial."
                            }
                        ].map((step, i) => (
                            <div key={i} className="relative pl-12">
                                <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-stellar border-2 border-classic flex items-center justify-center font-bold text-classic text-[10px] z-10 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                    {i + 1}
                                </div>
                                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                                    <span className="text-tiny font-black text-classic bg-classic/10 px-2 py-0.5 rounded uppercase tracking-tighter">
                                        {step.time}
                                    </span>
                                    <h4 className="text-small font-bold text-text-primary">{step.title}</h4>
                                </div>
                                <p className="text-small text-text-secondary leading-relaxed max-w-2xl">
                                    {step.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Technical Specs Footer */}
                <div className="mt-20 p-8 bg-stellar border border-argent rounded-xl border-dashed">
                    <h3 className="text-small font-bold text-text-primary uppercase mb-4">Notas Técnicas para Media Buyers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-small text-text-secondary">
                        <ul className="space-y-2 list-disc pl-4">
                            <li>El sistema procesa la data completa una vez al día para respetar la ventana de atribución de Meta.</li>
                            <li>Utilizamos una ventana de 7 días (Rolling 7d) para que un día 'malo' o 'excepcional' no sesgue la IA.</li>
                            <li><strong>Navegación Instantánea:</strong> Hemos implementado un sistema de caché que permite saltar entre el Dashboard y el Ads Manager sin esperas de carga.</li>
                        </ul>
                        <ul className="space-y-2 list-disc pl-4">
                            <li>Los <strong>Prompts de IA</strong> e instrucciones críticas se pueden auditar y editar desde el <strong>Cerebro de Worker</strong> en Administración.</li>
                            <li>La fatiga creativa se detecta cruzando el incremento de frecuencia con la degradación del CTR en las últimas 72hs.</li>
                            <li><strong>Clasificación Automática:</strong> Cada creativo se clasifica en 1 de 6 categorías (Dominante, Saturándose, BOFU Oculto, TOFU Ineficiente, Zombie, Nuevo).</li>
                            <li><strong>Account Health:</strong> Se verifica el estado de la cuenta Meta cada 2 horas para detectar problemas antes de que impacten el delivery.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
