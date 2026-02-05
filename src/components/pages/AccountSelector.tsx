"use client";

import React, { useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { AdAccount } from "@/types";

interface AccountSelectorProps {
    accounts?: AdAccount[];
    isLoading?: boolean;
    error?: string | null;
}

import { Client } from "@/types";

export default function AccountSelector() {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchClients = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/clients");
            if (!res.ok) throw new Error("Failed to fetch clients");
            const data = await res.json();
            // Only show active clients for selection
            setClients(data.filter((c: Client) => c.active));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchClients();
    }, []);

    const handleSelect = (clientId: string) => {
        window.location.href = `/dashboard?clientId=${clientId}`;
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.metaAdAccountId?.includes(searchQuery)
    );

    const totalClients = clients.length;
    const isEmpty = !isLoading && !error && clients.length === 0;

    return (
        <AppLayout>
            <div className="max-w-6xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-hero text-text-primary mb-2">Select an Ad Account</h1>
                    <p className="text-body text-text-secondary">
                        Choose a synced Meta Ad Account to begin your comprehensive technical diagnostic report.
                        We only display accounts with active permissions.
                    </p>
                </div>

                {/* Search and Filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                        <svg
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by client name or Meta ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12"
                        />
                    </div>
                </div>

                {/* Content Area */}
                <div className="card overflow-hidden p-0 relative min-h-[400px]">
                    {isLoading && (
                        <div className="absolute inset-0 bg-stellar/50 flex items-center justify-center z-10 backdrop-blur-[2px]">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-body text-text-secondary">Loading clients...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-12 flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-subheader text-text-primary mb-2">Failed to load clients</h3>
                            <p className="text-body text-text-secondary mb-6 max-w-md">{error}</p>
                            <button onClick={fetchClients} className="btn-primary">Retry</button>
                        </div>
                    )}

                    {isEmpty && (
                        <div className="p-12 flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-argent/10 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-subheader text-text-primary mb-2">No active clients found</h3>
                            <p className="text-body text-text-secondary mb-6 max-w-md">
                                You don't have any active clients assigned. Please contact an administrator.
                            </p>
                        </div>
                    )}

                    {!isLoading && !error && !isEmpty && (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-argent">
                                    <th className="text-left px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">
                                        Client Name
                                    </th>
                                    <th className="text-left px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">
                                        Platform IDs
                                    </th>
                                    <th className="text-center px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">
                                        Integrations
                                    </th>
                                    <th className="text-center px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="text-right px-6 py-4 text-small font-bold text-text-muted uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map((client, index) => (
                                    <tr
                                        key={client.id}
                                        className={`border-b border-argent last:border-b-0 hover:bg-special transition-colors ${index % 2 === 0 ? "bg-stellar" : "bg-special"
                                            }`}
                                    >
                                        <td className="px-6 py-4 font-medium text-text-primary">
                                            {client.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-small text-text-secondary font-mono">Meta: {client.metaAdAccountId || "N/A"}</span>
                                                {client.isGoogle && (
                                                    <span className="text-small text-text-secondary font-mono">Google: {client.googleAdsId || "N/A"}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${client.metaAdAccountId ? "bg-synced" : "bg-text-muted/20"}`} title="Meta Connect" />
                                                <span className={`w-2 h-2 rounded-full ${client.isEcommerce ? "bg-synced" : "bg-text-muted/20"}`} title="Ecommerce" />
                                                <span className={`w-2 h-2 rounded-full ${client.isGoogle ? "bg-classic" : "bg-text-muted/20"}`} title="Google Ads" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="status-badge status-synced border-none shadow-none">
                                                <div className="w-1.5 h-1.5 rounded-full bg-synced" />
                                                ACTIVE
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleSelect(client.id)}
                                                className="btn-primary text-small px-6 py-2"
                                            >
                                                SELECT
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {!isLoading && !error && !isEmpty && (
                    <div className="flex items-center justify-between mt-6">
                        <span className="text-body text-text-muted">
                            Showing {filteredClients.length} of {totalClients} clients
                        </span>
                        <div className="flex items-center gap-2">
                            <button className="w-8 h-8 bg-second border border-argent rounded hover:bg-argent transition-colors flex items-center justify-center">
                                <svg className="w-4 h-4 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button className="w-8 h-8 bg-classic text-white rounded font-medium">1</button>
                            <button className="w-8 h-8 bg-second border border-argent rounded hover:bg-argent transition-colors text-text-primary font-medium">
                                2
                            </button>
                            <button className="w-8 h-8 bg-second border border-argent rounded hover:bg-argent transition-colors text-text-primary font-medium">
                                3
                            </button>
                            <button className="w-8 h-8 bg-second border border-argent rounded hover:bg-argent transition-colors flex items-center justify-center">
                                <svg className="w-4 h-4 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
