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

                <div className="grid grid-cols-1 gap-20">
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
                <div className="mt-24 space-y-8">
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

                {/* Technical Specs Footer */}
                <div className="mt-20 p-8 bg-stellar border border-argent rounded-xl border-dashed">
                    <h3 className="text-small font-bold text-text-primary uppercase mb-4">Notas Técnicas para Media Buyers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-small text-text-secondary">
                        <ul className="space-y-2 list-disc pl-4">
                            <li>Las alertas se procesan cada 1 hora pero solo se notifican una vez al día para evitar spam, a menos que sean <strong>CRÍTICAS</strong>.</li>
                            <li>El sistema utiliza una ventana de 7 días (Rolling 7d) para calcular costos y normalizar fluctuaciones diarias.</li>
                        </ul>
                        <ul className="space-y-2 list-disc pl-4">
                            <li>Si el cliente tiene configurado un <strong>Target CPA</strong>, todas las alertas de eficiencia se calculan en base a ese número.</li>
                            <li>La fatiga creativa se detecta cruzando el incremento de frecuencia con la degradación del CTR en las últimas 72hs.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
