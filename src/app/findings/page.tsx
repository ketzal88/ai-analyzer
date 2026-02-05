"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";

export default function FindingsPage() {
    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-display font-black text-text-primary mb-2">HALLAZGOS DIAGNÓSTICOS</h1>
                    <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                        Detección de anomalías y señales de rendimiento
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="card p-12 text-center border-dashed border-2 border-argent bg-special/30">
                        <div className="w-16 h-16 bg-classic/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-classic" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <h3 className="text-subheader text-text-primary font-bold mb-2">MOTOR LISTO</h3>
                        <p className="text-body text-text-secondary max-w-sm mx-auto">
                            El motor de análisis está listo para procesar tus señales. Usa el selector para iniciar el diagnóstico.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
