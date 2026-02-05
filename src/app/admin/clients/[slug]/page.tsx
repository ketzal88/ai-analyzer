"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import ClientForm from "@/components/admin/clients/ClientForm";
import { Client } from "@/types";

/**
 * Mission 10: Edit Existing Client
 */
export default function EditClientPage({ params }: { params: { slug: string } }) {
    const { slug } = params;
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchClient = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`/api/clients/by-slug/${slug}`);
                if (!res.ok) {
                    if (res.status === 404) throw new Error("Client not found.");
                    throw new Error("Failed to load client details.");
                }
                const data = await res.json();
                setClient(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchClient();
    }, [slug]);

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-hero text-text-primary mb-2">Edit Client Settings</h1>
                    <p className="text-body text-text-secondary">
                        Modify configuration, account IDs, and integration settings for <strong>{client?.name || slug}</strong>.
                    </p>
                </div>

                {isLoading ? (
                    <div className="card flex items-center justify-center p-20">
                        <div className="w-8 h-8 border-2 border-classic border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : error ? (
                    <div className="card p-12 text-center">
                        <h3 className="text-subheader text-red-500 mb-2">Error</h3>
                        <p className="text-body text-text-secondary mb-6">{error}</p>
                        <button
                            onClick={() => window.location.href = "/admin/clients"}
                            className="btn-primary"
                        >
                            BACK TO LIST
                        </button>
                    </div>
                ) : client ? (
                    <div className="card">
                        <ClientForm initialData={client} isEditing={true} />
                    </div>
                ) : null}
            </div>
        </AppLayout>
    );
}
