"use client";

import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { DatePreset } from "@/lib/date-utils";
import { PanoramaResponse } from "@/types/panorama";
import PanoramaFilters from "@/components/admin/panorama/PanoramaFilters";
import PanoramaTable from "@/components/admin/panorama/PanoramaTable";

interface TeamOption {
    id: string;
    name: string;
}

export default function PanoramaPage() {
    const [data, setData] = useState<PanoramaResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [preset, setPreset] = useState<DatePreset>("mtd");
    const [filterTeam, setFilterTeam] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/admin/panorama?preset=${preset}`);
                if (!res.ok) throw new Error(`Error ${res.status}`);
                const json: PanoramaResponse = await res.json();
                setData(json);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error al cargar datos");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [preset]);

    // Extract unique teams for the filter dropdown
    const teamOptions: TeamOption[] = useMemo(() => {
        if (!data) return [];
        return data.teams
            .filter((t) => t.teamId !== null)
            .map((t) => ({ id: t.teamId!, name: t.teamName }));
    }, [data]);

    // Client-side team filtering
    const filteredTeams = useMemo(() => {
        if (!data) return [];
        if (filterTeam === "all") return data.teams;
        return data.teams.filter((t) => t.teamId === filterTeam);
    }, [data, filterTeam]);

    // Count total clients
    const totalClients = useMemo(
        () => filteredTeams.reduce((s, t) => s + t.clients.length, 0),
        [filteredTeams]
    );

    return (
        <AppLayout>
            <div className="px-1">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-hero text-text-primary mb-1">Panorama General</h1>
                    <p className="text-body text-text-secondary">
                        Vista ejecutiva de KPIs por equipo y canal
                    </p>
                </div>

                {/* Filters */}
                <PanoramaFilters
                    teams={teamOptions}
                    filterTeam={filterTeam}
                    onFilterTeamChange={setFilterTeam}
                    preset={preset}
                    onPresetChange={setPreset}
                    periodLabel={data?.period.label || ""}
                    comparisonLabel={data?.comparisonPeriod.label || ""}
                />

                {/* Content */}
                <div className="relative">
                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-stellar/50 flex items-center justify-center backdrop-blur-[2px] z-30">
                            <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}

                    {/* Error */}
                    {error && !isLoading && (
                        <div className="card p-12 text-center">
                            <p className="text-red-500 text-body">{error}</p>
                        </div>
                    )}

                    {/* Empty */}
                    {!error && !isLoading && totalClients === 0 && (
                        <div className="card p-12 text-center">
                            <p className="text-text-muted text-body">No hay clientes activos</p>
                        </div>
                    )}

                    {/* Table */}
                    {!error && data && totalClients > 0 && (
                        <PanoramaTable teams={filteredTeams} />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
