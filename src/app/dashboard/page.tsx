"use client";

import React, { useEffect, useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useReport } from "@/contexts/ReportContext";
import Dashboard from "@/components/pages/Dashboard";
import { DashboardReport } from "@/types";
import { UnifiedDateRange, resolvePreset } from "@/lib/date-utils";

export default function DashboardPage() {
    const { selectedClientId: clientId } = useClient();
    const { getReport, setReport } = useReport();

    const [report, setReportInState] = useState<DashboardReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<UnifiedDateRange>(() => resolvePreset("last_7d"));

    const fetchDashboardData = async (forceRefresh = false) => {
        if (!clientId) return;
        try {
            setIsLoading(true);
            setError(null);
            setReportInState(null);
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    currentRangeCustom: { start: range.start, end: range.end },
                    flags: { forceRefresh, syncIfMissing: true }
                })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Error en análisis");
            }
            const data = await response.json();
            const { snapshot, findingsRun, alerts } = data;
            if (!snapshot) throw new Error("No se pudo obtener el análisis para este rango.");
            const finalReport: DashboardReport = {
                id: snapshot.id,
                clientId: snapshot.clientId,
                generatedAt: snapshot.createdAt,
                dateRange: snapshot.currentRange,
                comparisonRange: snapshot.compareRange,
                kpis: snapshot.kpis,
                config: snapshot.config,
                findings: findingsRun?.findings || [],
                alerts: alerts || [],
                gemSummary: data.gemSummary
            };
            setReportInState(finalReport);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (clientId) {
            fetchDashboardData(false);
        }
    }, [clientId, range.start, range.end]);

    return <Dashboard
        report={report || undefined}
        isLoading={isLoading}
        error={error}
        onRefresh={() => fetchDashboardData(true)}
        range={range}
        onRangeChange={setRange}
    />;
}
