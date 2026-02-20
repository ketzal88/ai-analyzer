"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Client, Alert } from "@/types";
import { EntityRollingMetrics, ConceptRollingMetrics } from "@/types/performance-snapshots";
import { EntityClassification } from "@/types/classifications";
import { useAuth } from "@/contexts/AuthContext";

export interface PerformanceData {
    rolling: EntityRollingMetrics[];
    concepts: ConceptRollingMetrics[];
    alerts: Alert[];
    classifications: EntityClassification[];
}

interface ClientContextType {
    selectedClientId: string | null;
    setSelectedClientId: (id: string | null) => void;
    activeClients: Client[];
    isLoading: boolean;
    // Caching
    performanceData: PerformanceData | null;
    isPerformanceLoading: boolean;
    performanceError: string | null;
    refreshPerformance: (date?: string) => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);
    const [activeClients, setActiveClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Performance Data Cache
    const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
    const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
    const [performanceError, setPerformanceError] = useState<string | null>(null);
    const [cacheKey, setCacheKey] = useState<string | null>(null); // clientId + date

    const setSelectedClientId = (id: string | null) => {
        setSelectedClientIdState(id);
        if (id) {
            localStorage.setItem("selectedClientId", id);
        } else {
            localStorage.removeItem("selectedClientId");
        }
        // Clear cache on client change
        setPerformanceData(null);
        setCacheKey(null);
    };

    const refreshPerformance = async (date?: string) => {
        if (!selectedClientId) return;

        const newKey = `${selectedClientId}_${date || 'latest'}`;
        if (performanceData && cacheKey === newKey) {
            console.log("Serving performance data from cache:", newKey);
            return;
        }

        setIsPerformanceLoading(true);
        setPerformanceError(null);
        try {
            console.log("Fetching performance data for:", newKey);
            const url = `/api/performance?clientId=${selectedClientId}${date ? `&date=${date}` : ""}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch performance data");
            const data = await res.json();
            setPerformanceData(data);
            setCacheKey(newKey);
        } catch (err: any) {
            setPerformanceError(err.message);
        } finally {
            setIsPerformanceLoading(false);
        }
    };

    // Restore selected client from URL or localStorage
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("clientId");
        const storedId = localStorage.getItem("selectedClientId");

        if (urlId) {
            setSelectedClientIdState(urlId);
            localStorage.setItem("selectedClientId", urlId);
        } else if (storedId) {
            setSelectedClientIdState(storedId);
        }
    }, []);

    // Fetch clients when user is authenticated
    useEffect(() => {
        if (authLoading || !user) {
            setIsLoading(!authLoading);
            return;
        }

        const fetchClients = async () => {
            setIsLoading(true);
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
    }, [user, authLoading]);

    // Auto-refresh when client changes
    useEffect(() => {
        if (selectedClientId) {
            refreshPerformance();
        }
    }, [selectedClientId]);

    return (
        <ClientContext.Provider value={{
            selectedClientId,
            setSelectedClientId,
            activeClients,
            isLoading,
            performanceData,
            isPerformanceLoading,
            performanceError,
            refreshPerformance
        }}>
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
