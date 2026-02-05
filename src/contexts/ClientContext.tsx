"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Client } from "@/types";

interface ClientContextType {
    selectedClientId: string | null;
    setSelectedClientId: (id: string | null) => void;
    activeClients: Client[];
    isLoading: boolean;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: React.ReactNode }) {
    const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);
    const [activeClients, setActiveClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const setSelectedClientId = (id: string | null) => {
        setSelectedClientIdState(id);
        if (id) {
            localStorage.setItem("selectedClientId", id);
        } else {
            localStorage.removeItem("selectedClientId");
        }
    };

    useEffect(() => {
        // 1. Check URL first
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("clientId");

        // 2. Check localStorage
        const storedId = localStorage.getItem("selectedClientId");

        if (urlId) {
            setSelectedClientIdState(urlId);
            localStorage.setItem("selectedClientId", urlId);
        } else if (storedId) {
            setSelectedClientIdState(storedId);
        }

        const fetchClients = async () => {
            try {
                const res = await fetch("/api/clients");
                if (res.ok) {
                    const data = await res.json();
                    setActiveClients(data.filter((c: Client) => c.active));
                }
            } catch (err) {
                console.error("Failed to fetch clients for switcher:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchClients();
    }, []);

    return (
        <ClientContext.Provider value={{ selectedClientId, setSelectedClientId, activeClients, isLoading }}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClient() {
    const context = useContext(ClientContext);
    if (context === undefined) {
        throw new Error("useClient must be used within a ClientProvider");
    }
    return context;
}
