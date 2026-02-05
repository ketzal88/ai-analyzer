import React from "react";
import Link from "next/link";

interface ClientsActionBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onOpenImport: () => void;
}

export default function ClientsActionBar({ searchQuery, setSearchQuery, onOpenImport }: ClientsActionBarProps) {
    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-hero text-text-primary mb-1">Clients List</h1>
                <p className="text-body text-text-secondary">Manage and monitor technical diagnostics for all connected accounts.</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search clients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-64 bg-special border border-argent rounded-lg focus:outline-none focus:border-classic"
                    />
                </div>
                <button
                    onClick={onOpenImport}
                    className="btn-secondary flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    IMPORT
                </button>
                <Link href="/admin/clients/new" className="btn-primary flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    NEW CLIENT
                </Link>
            </div>
        </div>
    );
}
