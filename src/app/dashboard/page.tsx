"use client";

import React, { useEffect, useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useReport } from "@/contexts/ReportContext";
import Dashboard from "@/components/pages/Dashboard";
import { DashboardReport } from "@/types";

import { DateRangeOption } from "@/components/pages/Dashboard";

export default function DashboardPage() {
    const { selectedClientId: clientId } = useClient();
    const { getReport, setReport } = useReport();

    const [report, setReportInState] = useState<DashboardReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<DateRangeOption>("last_14d");

    const fetchDashboardData = async (forceRefresh = false) => {
        if (!clientId) {
            setError("No hay cliente seleccionado.");
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Unified Analysis Call
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    currentRangePreset: range,
                    compareMode: "previous_period",
                    flags: {
                        forceRefresh,
                        syncIfMissing: forceRefresh // Only sync if user explicitly refreshes
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Error en análisis");
            }

            const data = await response.json();
            const { snapshot, findingsRun, meta } = data;

            if (!snapshot) throw new Error("No se pudo generar el snapshot.");

            // Map to DashboardReport expected by UI
            const finalReport: DashboardReport = {
                id: snapshot.id,
                clientId: snapshot.clientId,
                generatedAt: snapshot.createdAt,
                dateRange: snapshot.currentRange,
                comparisonRange: snapshot.compareRange,
                config: snapshot.config,
                kpis: snapshot.kpis,
                findings: findingsRun?.findings || []
            };

            setReportInState(finalReport);
            // setReport(clientId, finalReport); // Context cache optional now that backend caches

            if (meta?.cacheHit && !forceRefresh) {
                console.log("Loaded from backend cache:", meta.dataFreshness);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (clientId) {
            // Initial load: Try to get cached data, don't force refresh
            fetchDashboardData(false);
        }
    }, [clientId, range]);

    return <Dashboard
        report={report || undefined}
        isLoading={isLoading}
        error={error}
        onRefresh={() => fetchDashboardData(true)}
        range={range}
        onRangeChange={setRange}
    />;
}
