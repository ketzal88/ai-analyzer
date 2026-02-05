import React from "react";

interface ClientsFiltersProps {
    filterActive: "all" | "active" | "inactive";
    setFilterActive: (val: "all" | "active" | "inactive") => void;
    filterEcommerce: boolean;
    setFilterEcommerce: (val: boolean) => void;
    filterGoogle: boolean;
    setFilterGoogle: (val: boolean) => void;
}

export default function ClientsFilters({
    filterActive, setFilterActive,
    filterEcommerce, setFilterEcommerce,
    filterGoogle, setFilterGoogle
}: ClientsFiltersProps) {
    return (
        <div className="flex items-center gap-6 mb-6 text-body text-text-secondary">
            <div className="flex items-center gap-2">
                <span>Status:</span>
                <select
                    value={filterActive}
                    onChange={e => setFilterActive(e.target.value as any)}
                    className="bg-transparent font-medium text-text-primary focus:outline-none cursor-pointer"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
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
