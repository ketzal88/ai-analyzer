import React from "react";
import { Team } from "@/types";

interface ClientsFiltersProps {
    filterActive: "all" | "active" | "inactive" | "archived";
    setFilterActive: (val: "all" | "active" | "inactive" | "archived") => void;
    filterEcommerce: boolean;
    setFilterEcommerce: (val: boolean) => void;
    filterGoogle: boolean;
    setFilterGoogle: (val: boolean) => void;
    filterTeam: string;
    setFilterTeam: (val: string) => void;
    teams: Team[];
}

export default function ClientsFilters({
    filterActive, setFilterActive,
    filterEcommerce, setFilterEcommerce,
    filterGoogle, setFilterGoogle,
    filterTeam, setFilterTeam,
    teams,
}: ClientsFiltersProps) {
    return (
        <div className="flex items-center gap-6 mb-6 text-body text-text-secondary">
            <div className="flex items-center gap-2">
                <span>Status:</span>
                <select
                    value={filterActive}
                    onChange={e => setFilterActive(e.target.value as any)}
                    className="bg-stellar font-medium text-text-primary focus:outline-none cursor-pointer border border-argent rounded-md px-2 py-1"
                >
                    <option value="all" className="bg-stellar text-text-primary">All Status</option>
                    <option value="active" className="bg-stellar text-text-primary">Active Only</option>
                    <option value="inactive" className="bg-stellar text-text-primary">Inactive Only</option>
                    <option value="archived" className="bg-stellar text-text-primary">Archived</option>
                </select>
            </div>
            <div className="flex items-center gap-2">
                <span>Equipo:</span>
                <select
                    value={filterTeam}
                    onChange={e => setFilterTeam(e.target.value)}
                    className="bg-stellar font-medium text-text-primary focus:outline-none cursor-pointer border border-argent rounded-md px-2 py-1"
                >
                    <option value="all" className="bg-stellar text-text-primary">Todos</option>
                    {teams.map(t => (
                        <option key={t.id} value={t.id} className="bg-stellar text-text-primary">{t.name}</option>
                    ))}
                </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={filterEcommerce}
                    onChange={e => setFilterEcommerce(e.target.checked)}
                    className="w-4 h-4 rounded border-argent text-classic focus:ring-0"
                />
                <span className={filterEcommerce ? "text-text-primary font-medium" : ""}>Ecommerce</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={filterGoogle}
                    onChange={e => setFilterGoogle(e.target.checked)}
                    className="w-4 h-4 rounded border-argent text-classic focus:ring-0"
                />
                <span className={filterGoogle ? "text-text-primary font-medium" : ""}>Google Ads</span>
            </label>
        </div>
    );
}
