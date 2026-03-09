"use client";

import { DatePreset } from "@/lib/date-utils";

interface TeamOption {
    id: string;
    name: string;
}

interface Props {
    teams: TeamOption[];
    filterTeam: string;
    onFilterTeamChange: (value: string) => void;
    preset: DatePreset;
    onPresetChange: (value: DatePreset) => void;
    periodLabel: string;
    comparisonLabel: string;
}

const PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
    { value: "mtd", label: "Mes actual (MTD)" },
    { value: "last_month", label: "Mes pasado" },
    { value: "last_30d", label: "Últimos 30 días" },
    { value: "last_7d", label: "Últimos 7 días" },
];

export default function PanoramaFilters({
    teams,
    filterTeam,
    onFilterTeamChange,
    preset,
    onPresetChange,
    periodLabel,
    comparisonLabel,
}: Props) {
    return (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
                {/* Team filter */}
                <div className="flex items-center gap-2">
                    <span className="text-small text-text-muted">Equipo:</span>
                    <select
                        value={filterTeam}
                        onChange={(e) => onFilterTeamChange(e.target.value)}
                        className="bg-stellar border border-argent text-text-primary text-small px-3 py-1.5 focus:border-classic focus:outline-none"
                    >
                        <option value="all">Todos</option>
                        {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Period filter */}
                <div className="flex items-center gap-2">
                    <span className="text-small text-text-muted">Periodo:</span>
                    <select
                        value={preset}
                        onChange={(e) => onPresetChange(e.target.value as DatePreset)}
                        className="bg-stellar border border-argent text-text-primary text-small px-3 py-1.5 focus:border-classic focus:outline-none"
                    >
                        {PRESET_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Period labels */}
            <div className="text-[10px] text-text-muted">
                <span>{periodLabel}</span>
                <span className="mx-2">vs</span>
                <span>{comparisonLabel}</span>
            </div>
        </div>
    );
}
