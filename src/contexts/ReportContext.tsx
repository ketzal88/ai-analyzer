"use client";

import React, { createContext, useContext, useState } from "react";
import { DiagnosticReport } from "@/types";

interface ReportContextType {
    reports: Record<string, DiagnosticReport>;
    setReport: (clientId: string, report: DiagnosticReport) => void;
    clearCache: (clientId?: string) => void;
    getReport: (clientId: string) => DiagnosticReport | null;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({ children }: { children: React.ReactNode }) {
    const [reports, setReports] = useState<Record<string, DiagnosticReport>>({});

    const setReport = (clientId: string, report: DiagnosticReport) => {
        setReports(prev => ({
            ...prev,
            [clientId]: report
        }));
    };

    const clearCache = (clientId?: string) => {
        if (clientId) {
            setReports(prev => {
                const newReports = { ...prev };
                delete newReports[clientId];
                return newReports;
            });
        } else {
            setReports({});
        }
    };

    const getReport = (clientId: string) => reports[clientId] || null;

    return (
        <ReportContext.Provider value={{ reports, setReport, clearCache, getReport }}>
            {children}
        </ReportContext.Provider>
    );
}

export function useReport() {
    const context = useContext(ReportContext);
    if (context === undefined) {
        throw new Error("useReport must be used within a ReportProvider");
    }
    return context;
}
