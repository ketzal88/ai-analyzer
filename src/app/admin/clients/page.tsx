"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { Client } from "@/types";
import ClientsActionBar from "@/components/admin/clients/ClientsActionBar";
import ClientsFilters from "@/components/admin/clients/ClientsFilters";
import ClientsTable from "@/components/admin/clients/ClientsTable";
import ImportClientsModal from "@/components/admin/clients/ImportClientsModal";

/**
 * Mission 9: Admin Clients List (STRICT STITCH UI)
 */
export default function AdminClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
    const [filterEcommerce, setFilterEcommerce] = useState(false);
    const [filterGoogle, setFilterGoogle] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const fetchClients = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/clients");
            if (!res.ok) throw new Error("Failed to load clients");
            const data = await res.json();
            setClients(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const toggleActive = async (client: Client) => {
        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !client.active })
            });
            if (res.ok) fetchClients();
        } catch (err) {
            console.error("Failed to toggle status", err);
        }
    };

    const archiveClient = async (id: string) => {
        if (!confirm("Are you sure you want to archive this client?")) return;
        try {
            const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
            if (res.ok) fetchClients();
        } catch (err) {
            console.error("Failed to archive client", err);
        }
    };

    const filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesActive = filterActive === "all" || (filterActive === "active" ? c.active : !c.active);
        const matchesEcommerce = !filterEcommerce || c.isEcommerce;
        const matchesGoogle = !filterGoogle || c.isGoogle;
        return matchesSearch && matchesActive && matchesEcommerce && matchesGoogle;
    });

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto">
                <ClientsActionBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onOpenImport={() => setIsImportModalOpen(true)}
                />

                <ClientsFilters
                    filterActive={filterActive}
                    setFilterActive={setFilterActive}
                    filterEcommerce={filterEcommerce}
                    setFilterEcommerce={setFilterEcommerce}
                    filterGoogle={filterGoogle}
                    setFilterGoogle={setFilterGoogle}
                />

                <div className="card p-0 overflow-hidden relative min-h-[400px]">
                    {isLoading && <LoadingState />}
                    {error && <ErrorState error={error} />}
                    {!isLoading && !error && filteredClients.length === 0 && (
                        <EmptyState isFiltered={clients.length > 0} />
                    )}

                    {!isLoading && !error && filteredClients.length > 0 && (
                        <ClientsTable
                            clients={filteredClients}
                            onToggleActive={toggleActive}
                            onArchive={archiveClient}
                        />
                    )}
                </div>

                <ImportClientsModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    existingClients={clients}
                    onImportComplete={fetchClients}
                />
            </div>
        </AppLayout>
    );
}

// --- UI STATES (STRICT STITCH STYLE) ---

function LoadingState() {
    return (
        <div className="absolute inset-0 bg-stellar/50 flex items-center justify-center z-10 backdrop-blur-[2px]">
            <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}

function ErrorState({ error }: { error: string }) {
    return (
        <div className="p-12 text-center">
            <h3 className="text-subheader text-red-500 mb-2">Failed to load clients</h3>
            <p className="text-body text-text-secondary">{error}</p>
        </div>
    );
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
    return (
        <div className="p-20 text-center">
            <div className="w-16 h-16 bg-special rounded-full flex items-center justify-center mx-auto mb-4 border border-argent">
                <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            </div>
            <h3 className="text-subheader text-text-primary mb-2">
                {isFiltered ? "No clients match your filters" : "No clients found"}
            </h3>
            <p className="text-body text-text-secondary max-w-sm mx-auto">
                {isFiltered ? "Try adjusting your search or filters to find the client you are looking for." : "Start by adding your first client to the dashboard."}
            </p>
        </div>
    );
}
