"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    UnifiedDateRange,
    DatePreset,
    PRESET_LABELS,
    PICKER_PRESETS,
    resolvePreset,
    getComparisonRange,
    validateDateRange,
    formatRangeLabel,
    formatDate,
} from "@/lib/date-utils";

interface DateRangePickerProps {
    value: UnifiedDateRange;
    onChange: (range: UnifiedDateRange) => void;
    enableCompare?: boolean;
    compareValue?: UnifiedDateRange | null;
    onCompareChange?: (range: UnifiedDateRange | null) => void;
    className?: string;
}

export default function DateRangePicker({
    value,
    onChange,
    enableCompare = false,
    compareValue = null,
    onCompareChange,
    className = "",
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tempRange, setTempRange] = useState<UnifiedDateRange>(value);
    const [selectedPreset, setSelectedPreset] = useState<DatePreset | "custom">(value.preset || "last_7d");
    const [compareEnabled, setCompareEnabled] = useState(!!compareValue);
    const [quickDays, setQuickDays] = useState("30");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync temp state when value changes externally
    useEffect(() => {
        setTempRange(value);
        setSelectedPreset(value.preset || "custom");
    }, [value.start, value.end]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setTempRange(value);
                setSelectedPreset(value.preset || "custom");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, value]);

    const handlePresetClick = useCallback((preset: DatePreset) => {
        const range = resolvePreset(preset);
        setTempRange(range);
        setSelectedPreset(preset);
    }, []);

    const handleApply = useCallback(() => {
        const validation = validateDateRange(tempRange);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }
        onChange(tempRange);
        if (enableCompare && onCompareChange) {
            onCompareChange(compareEnabled ? getComparisonRange(tempRange) : null);
        }
        setIsOpen(false);
    }, [tempRange, compareEnabled, enableCompare, onChange, onCompareChange]);

    const handleCancel = useCallback(() => {
        setTempRange(value);
        setSelectedPreset(value.preset || "custom");
        setIsOpen(false);
    }, [value]);

    const applyQuickDays = useCallback((untilToday: boolean) => {
        const days = parseInt(quickDays);
        if (!days || days < 1 || days > 90) return;
        const ref = new Date();
        if (!untilToday) ref.setDate(ref.getDate() - 1);
        const start = new Date(ref);
        start.setDate(ref.getDate() - days + 1);
        setTempRange({
            start: formatDate(start),
            end: formatDate(ref),
            label: untilToday ? `${days} días hasta hoy` : `${days} días hasta ayer`,
            preset: "custom",
        });
        setSelectedPreset("custom");
    }, [quickDays]);

    // Preview info for preset selection
    const previewLabel = selectedPreset !== "custom"
        ? `${formatShortDate(tempRange.start)} – ${formatShortDate(tempRange.end)}`
        : null;

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-stellar border border-argent px-4 py-2 text-[12px] font-bold text-text-primary hover:border-classic/50 transition-all flex items-center gap-2 min-w-[220px]"
            >
                <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="flex-1 text-left truncate">{formatRangeLabel(value)}</span>
                <svg className={`w-3 h-3 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full mt-1 right-0 bg-special border border-argent shadow-2xl z-50 w-[640px]">
                    <div className="grid grid-cols-12 divide-x divide-argent/30">
                        {/* Left: Presets */}
                        <div className="col-span-4 p-3 space-y-0.5 max-h-[420px] overflow-y-auto">
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2 px-2">
                                Rangos
                            </p>
                            <button
                                onClick={() => {
                                    setSelectedPreset("custom");
                                    setTempRange({ ...tempRange, preset: "custom" });
                                }}
                                className={`w-full text-left px-2 py-1.5 text-[11px] transition-all ${
                                    selectedPreset === "custom"
                                        ? "bg-classic text-stellar font-bold"
                                        : "text-text-primary hover:bg-argent/10"
                                }`}
                            >
                                Personalizado
                            </button>
                            {PICKER_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => handlePresetClick(preset)}
                                    className={`w-full text-left px-2 py-1.5 text-[11px] transition-all ${
                                        selectedPreset === preset
                                            ? "bg-classic text-stellar font-bold"
                                            : "text-text-primary hover:bg-argent/10"
                                    }`}
                                >
                                    {PRESET_LABELS[preset]}
                                </button>
                            ))}
                        </div>

                        {/* Right: Detail Panel */}
                        <div className="col-span-8 p-4 flex flex-col">
                            {selectedPreset === "custom" ? (
                                <div className="space-y-4 flex-1">
                                    {/* Date inputs */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                                                Fecha de inicio
                                            </label>
                                            <input
                                                type="date"
                                                value={tempRange.start}
                                                onChange={(e) =>
                                                    setTempRange({
                                                        ...tempRange,
                                                        start: e.target.value,
                                                        label: "Personalizado",
                                                        preset: "custom",
                                                    })
                                                }
                                                className="w-full mt-1 bg-stellar border border-argent px-3 py-2 text-[12px] text-text-primary focus:border-classic outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                                                Fecha de final
                                            </label>
                                            <input
                                                type="date"
                                                value={tempRange.end}
                                                onChange={(e) =>
                                                    setTempRange({
                                                        ...tempRange,
                                                        end: e.target.value,
                                                        label: "Personalizado",
                                                        preset: "custom",
                                                    })
                                                }
                                                className="w-full mt-1 bg-stellar border border-argent px-3 py-2 text-[12px] text-text-primary focus:border-classic outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Quick inputs */}
                                    <div className="border-t border-argent/30 pt-3">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2">
                                            Accesos rápidos
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={quickDays}
                                                onChange={(e) => setQuickDays(e.target.value)}
                                                min="1"
                                                max="90"
                                                className="w-16 bg-stellar border border-argent px-2 py-1.5 text-[12px] text-text-primary focus:border-classic outline-none text-center font-mono"
                                            />
                                            <button
                                                onClick={() => applyQuickDays(true)}
                                                className="px-2.5 py-1.5 bg-argent/20 text-text-primary text-[10px] font-bold hover:bg-argent/30 transition-all"
                                            >
                                                días hasta hoy
                                            </button>
                                            <button
                                                onClick={() => applyQuickDays(false)}
                                                className="px-2.5 py-1.5 bg-argent/20 text-text-primary text-[10px] font-bold hover:bg-argent/30 transition-all"
                                            >
                                                días hasta ayer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-6">
                                    <p className="text-text-primary text-[13px] font-bold">
                                        {PRESET_LABELS[selectedPreset as DatePreset]}
                                    </p>
                                    {previewLabel && (
                                        <p className="text-text-muted text-[11px] mt-1 font-mono">
                                            {previewLabel}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Compare toggle */}
                            {enableCompare && (
                                <div className="border-t border-argent/30 pt-3 mt-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={compareEnabled}
                                            onChange={(e) => setCompareEnabled(e.target.checked)}
                                            className="w-3.5 h-3.5 accent-classic"
                                        />
                                        <span className="text-[11px] text-text-primary">
                                            Comparar
                                        </span>
                                        {compareEnabled && (
                                            <span className="text-[10px] text-text-muted font-mono">
                                                ({formatShortDate(getComparisonRange(tempRange).start)} – {formatShortDate(getComparisonRange(tempRange).end)})
                                            </span>
                                        )}
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-argent/30 px-4 py-3 flex justify-end gap-2">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-1.5 text-[11px] font-bold text-text-muted hover:text-text-primary transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-1.5 bg-classic text-stellar text-[11px] font-bold hover:bg-classic/80 transition-all"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
}
