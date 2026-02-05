"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";

export default function ReportPage() {
    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-display font-black text-text-primary mb-2">IA GROWTH REPORT</h1>
                    <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                        Generative insights & strategy recommendations
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="card p-12 text-center border-dashed border-2 border-argent bg-special/30">
                        <div className="w-16 h-16 bg-classic/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-classic" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-subheader text-text-primary font-bold mb-2">IA CO-PILOT READY</h3>
                        <p className="text-body text-text-secondary max-w-sm mx-auto">
                            Gemini AI is standing by. We need client data to generate your personalized growth strategy.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
