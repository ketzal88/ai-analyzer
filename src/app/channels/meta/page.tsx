"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";

/**
 * Meta channel page — thin wrapper that shows the existing Meta dashboard
 * by redirecting to the main dashboard (which is Meta-focused).
 * In the future this can be a dedicated Meta channel view.
 */
export default function MetaChannelPage() {
    const { selectedClientId: clientId } = useClient();

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                        Meta Ads
                    </h1>
                    <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                        Facebook & Instagram • Datos de Command Center
                    </p>
                </header>

                <div className="card p-8 flex flex-col items-center gap-4">
                    <p className="text-text-muted text-small text-center">
                        Los datos de Meta Ads se visualizan en el Command Center y Ads Manager.
                    </p>
                    <div className="flex gap-3">
                        <a
                            href="/dashboard"
                            className="px-4 py-2 bg-classic text-stellar text-[11px] font-black uppercase tracking-widest hover:bg-classic/80 transition-all"
                        >
                            Command Center
                        </a>
                        <a
                            href="/ads-manager"
                            className="px-4 py-2 border border-argent text-text-secondary text-[11px] font-black uppercase tracking-widest hover:border-classic/30 transition-all"
                        >
                            Ads Manager
                        </a>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
