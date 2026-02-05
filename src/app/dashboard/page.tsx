"use client";

import React, { useEffect, useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import Dashboard from "@/components/pages/Dashboard";
import { DiagnosticReport } from "@/types";

export default function DashboardPage() {
    const { selectedClientId: clientId } = useClient();

    const [report, setReport] = useState<DiagnosticReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = async () => {
        if (!clientId) {
            setError("No client selected. Please return to the selector.");
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);

            // 1. Sync data first
            const syncRes = await fetch(`/api/sync?clientId=${clientId}`, { method: "POST" });
            if (!syncRes.ok) {
                const data = await syncRes.json();
                throw new Error(data.error || "Failed to sync data");
            }

            // 2. Generate findings
            const findingsRes = await fetch(`/api/findings?clientId=${clientId}`, { method: "POST" });
            if (!findingsRes.ok) throw new Error("Failed to generate findings");
            const findingsData = await findingsRes.json();

            // 3. Generate/Fetch LLM Report
            const reportRes = await fetch(`/api/report?clientId=${clientId}`, { method: "POST" });
            if (!reportRes.ok) throw new Error("Failed to generate report");
            const reportData = await reportRes.json();

            // 4. Construct UI report object
            // Note: In a real app, findings might include more metadata than the brief summary from LLM report
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

            setReport(finalReport);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (clientId) fetchDashboardData();
    }, [clientId]);

    return <Dashboard report={report || undefined} isLoading={isLoading} error={error} />;
}
