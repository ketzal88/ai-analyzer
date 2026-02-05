"use client";

import React, { useState, useEffect } from "react";
import { Client } from "@/types";
import { parseImportData, ParsedRow } from "@/utils/importParser";

interface ImportClientsModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingClients: Client[];
    onImportComplete: () => void;
}

export default function ImportClientsModal({ isOpen, onClose, existingClients, onImportComplete }: ImportClientsModalProps) {
    const [rawText, setRawText] = useState("");
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

    useEffect(() => {
        if (rawText) {
            const rows = parseImportData(rawText, existingClients);
            setParsedRows(rows);
        } else {
            setParsedRows([]);
        }
    }, [rawText, existingClients]);

    if (!isOpen) return null;

    const handleImport = async () => {
        const validRows = parsedRows.filter(r => r.status !== "error");
        if (validRows.length === 0) return;

        setIsImporting(true);
        try {
            const res = await fetch("/api/clients/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clients: validRows.map(r => r.client) })
            });

            if (!res.ok) throw new Error("Import failed");

            setImportResult({ success: validRows.length, failed: parsedRows.length - validRows.length });
            setTimeout(() => {
                onImportComplete();
                onClose();
                reset();
            }, 2000);
        } catch (err) {
            alert("Error importing clients");
        } finally {
            setIsImporting(false);
        }
    };

    const reset = () => {
        setRawText("");
        setParsedRows([]);
        setImportResult(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stellar/80 backdrop-blur-sm">
            <div className="bg-special border border-argent rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-argent flex items-center justify-between bg-stellar">
                    <div>
                        <h2 className="text-subheader text-text-primary">Import Clients</h2>
                        <p className="text-small text-text-muted">Paste your TSV/CSV data from Sheets or Excel.</p>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Input Area */}
                    <div>
                        <label className="block text-small font-bold text-text-muted uppercase mb-2">Paste Data Here (Including Headers)</label>
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Nombre	Canal de Slack publico	Canal de Slack Interno	Cuenta de FB	activo	ecommerce	google	Google Ads Account..."
                            className="w-full h-32 font-mono text-small bg-stellar p-4 border border-argent rounded-lg focus:border-classic outline-none resize-none"
                        />
                    </div>

                    {/* Preview Table */}
                    {parsedRows.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-small font-bold text-text-primary uppercase tracking-wider">Data Preview (First 10 Rows)</h3>
                                <div className="flex gap-4 text-small">
                                    <span className="text-synced flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-synced"></span> {parsedRows.filter(r => r.status === "new").length} New
                                    </span>
                                    <span className="text-classic flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-classic"></span> {parsedRows.filter(r => r.status === "update").length} Updates
                                    </span>
                                    <span className="text-red-400 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-400"></span> {parsedRows.filter(r => r.status === "error").length} Errors
                                    </span>
                                </div>
                            </div>

                            <div className="border border-argent rounded-lg overflow-hidden">
                                <table className="w-full text-left text-small">
                                    <thead className="bg-stellar border-b border-argent font-bold text-text-muted">
                                        <tr>
                                            <th className="px-4 py-2">Status</th>
                                            <th className="px-4 py-2">Client Name</th>
                                            <th className="px-4 py-2">Meta Acc ID</th>
                                            <th className="px-4 py-2">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-argent">
                                        {parsedRows.slice(0, 10).map((row, i) => (
                                            <tr key={i} className={row.status === "error" ? "bg-red-500/5 text-red-100" : "hover:bg-special"}>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.status === "new" ? "bg-synced/20 text-synced" :
                                                            row.status === "update" ? "bg-classic/20 text-classic" : "bg-red-500/20 text-red-400"
                                                        }`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 font-medium">{row.client.name || "N/A"}</td>
                                                <td className="px-4 py-2 font-mono text-[11px]">{row.client.metaAdAccountId || "-"}</td>
                                                <td className="px-4 py-2 text-text-muted italic">
                                                    {row.error || (row.status === "update" ? "Merging with existing data" : "Ready to import")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-argent bg-stellar flex items-center justify-between">
                    <div className="text-body flex-1">
                        {importResult && (
                            <span className="text-synced font-bold animate-in fade-in">
                                ✅ Imported {importResult.success} clients successfully!
                            </span>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="btn-secondary">CANCEL</button>
                        <button
                            onClick={handleImport}
                            disabled={isImporting || parsedRows.length === 0 || parsedRows.every(r => r.status === "error")}
                            className="btn-primary min-w-[140px]"
                        >
                            {isImporting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                            ) : (
                                `IMPORT ${parsedRows.filter(r => r.status !== "error").length} CLIENTS`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
