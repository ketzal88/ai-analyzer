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

            // 4. Construct UI report object
            const finalReport: DiagnosticReport = {
                id: reportData.id || "latest",
                clientId: clientId,
                generatedAt: reportData.createdAt || new Date().toISOString(),
                kpis: {
                    roas: { label: "ROAS de la Cuenta", value: "4.21", change: 12.4, trend: "up", suffix: "" },
                    spend: { label: "Gasto Diario", value: "$1,482", limit: "Límite: $10k", trend: "neutral" },
                    cpa: { label: "CPA Promedio", value: "$24.05", change: 6.2, trend: "down", suffix: "" },
                },
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
