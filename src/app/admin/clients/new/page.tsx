"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";
import ClientForm from "@/components/admin/clients/ClientForm";

/**
 * Mission 10: Create New Client
 */
export default function NewClientPage() {
    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-hero text-text-primary mb-2">Configure New Client</h1>
                    <p className="text-body text-text-secondary">
                        Set up a new client profile and connect their advertising accounts for diagnostic auditing.
                    </p>
                </div>

                <div className="card">
                    <ClientForm />
                </div>
            </div>
        </AppLayout>
    );
}
