"use client";

import React, { useEffect, useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useReport } from "@/contexts/ReportContext";
import Dashboard from "@/components/pages/Dashboard";
import { DiagnosticReport } from "@/types";

export default function DashboardPage() {
    const { selectedClientId: clientId } = useClient();
    const { getReport, setReport } = useReport();

    const [report, setReportInState] = useState<DiagnosticReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = async (forceRefresh = false) => {
        if (!clientId) {
            setError("No hay cliente seleccionado. Por favor, regresa al selector.");
            setIsLoading(false);
            return;
        }

        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            const cachedReport = getReport(clientId);
            if (cachedReport) {
                setReportInState(cachedReport);
                setIsLoading(false);
                return;
            }
        }

        try {
            setIsLoading(true);
            setError(null);

            // 1. Sync data first
            const syncRes = await fetch(`/api/sync?clientId=${clientId}`, { method: "POST" });
            if (!syncRes.ok) {
                const data = await syncRes.json();
                throw new Error(data.error || "Error al sincronizar datos");
            }

            // 2. Generate findings
            const findingsRes = await fetch(`/api/findings?clientId=${clientId}`, { method: "POST" });
            if (!findingsRes.ok) throw new Error("Error al generar hallazgos");
            const findingsData = await findingsRes.json();

            // 3. Generate/Fetch LLM Report
            const reportRes = await fetch(`/api/report?clientId=${clientId}`, { method: "POST" });
            if (!reportRes.ok) throw new Error("Error al generar reporte");
            const reportData = await reportRes.json();

            const { summary } = findingsData;
            const { currentStats, WoW_Changes } = summary;

            // 4. Construct UI report object
            const finalReport: DiagnosticReport = {
                id: reportData.id || "latest",
                clientId: clientId,
                generatedAt: reportData.createdAt || new Date().toISOString(),
                kpis: [
                    {
                        label: "ROAS de la Cuenta",
                        value: currentStats.roas.toFixed(2),
                        change: Math.abs(Number(WoW_Changes.roas.toFixed(1))),
                        trend: WoW_Changes.roas >= 0 ? "up" : "down"
                    },
                    {
                        label: "Gasto Total",
                        value: `$${Math.round(currentStats.spend).toLocaleString()}`,
                        change: Math.abs(Number(WoW_Changes.spend.toFixed(1))),
                        trend: WoW_Changes.spend >= 0 ? "up" : "down"
                    },
                    {
                        label: "CPA Promedio",
                        value: `$${currentStats.cpa.toFixed(2)}`,
                        change: Math.abs(Number(WoW_Changes.cpa.toFixed(1))),
                        trend: WoW_Changes.cpa <= 0 ? "up" : "down" // Lower CPA is better (up trend color)
                    },
                    {
                        label: "Conversiones",
                        value: currentStats.purchases.toLocaleString(),
                        change: Math.abs(Number(WoW_Changes.purchases.toFixed(1))),
                        trend: WoW_Changes.purchases >= 0 ? "up" : "down"
                    },
                    {
                        label: "CTR",
                        value: `${(currentStats.ctr * 100).toFixed(2)}%`,
                        change: Math.abs(Number(WoW_Changes.ctr.toFixed(1))),
                        trend: WoW_Changes.ctr >= 0 ? "up" : "down"
                    },
                    {
                        label: "CVR",
                        value: `${(currentStats.cvr * 100).toFixed(2)}%`,
                        change: Math.abs(Number(WoW_Changes.cvr.toFixed(1))),
                        trend: WoW_Changes.cvr >= 0 ? "up" : "down"
                    }
                ],
                findings: findingsData.findings,
                campaignPerformance: []
            };

            setReportInState(finalReport);
            setReport(clientId, finalReport); // Save to global cache
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (clientId) fetchDashboardData();
    }, [clientId]);

    return <Dashboard
        report={report || undefined}
        isLoading={isLoading}
        error={error}
        onRefresh={() => fetchDashboardData(true)}
    />;
}
