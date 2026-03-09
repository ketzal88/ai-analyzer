"use client";

import { PanoramaKPICell, SemaforoColor } from "@/types/panorama";

type FormatType = "currency" | "number" | "percent" | "ratio";

function formatValue(value: number, format: FormatType): string {
    switch (format) {
        case "currency":
            if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
            if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
            return `$${value.toFixed(0)}`;
        case "number":
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
            return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
        case "percent":
            return `${value.toFixed(1)}%`;
        case "ratio":
            return `${value.toFixed(2)}x`;
    }
}

const dotColors: Record<SemaforoColor, string> = {
    green: "bg-synced",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
};

interface Props {
    cell: PanoramaKPICell;
    format: FormatType;
    isInverse?: boolean;
    groupStart?: boolean;
}

export default function KPICell({ cell, format, isInverse, groupStart }: Props) {
    const dotColor = dotColors[cell.status];
    const formatted = formatValue(cell.value, format);

    const hasDelta = cell.momPct !== null;
    const isPositive = hasDelta && cell.momPct! >= 0;
    const isGood = isInverse ? !isPositive : isPositive;

    return (
        <td className={`px-2 py-2.5 whitespace-nowrap ${groupStart ? "border-l-2 border-argent" : ""}`}>
            <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="font-mono text-[11px] text-text-primary">{formatted}</span>
                {hasDelta && (
                    <span
                        className={`text-[9px] font-black ${
                            isGood ? "text-synced" : "text-red-500"
                        }`}
                    >
                        {isPositive ? "+" : ""}
                        {cell.momPct!.toFixed(1)}%
                    </span>
                )}
            </div>
        </td>
    );
}

export function EmptyCell({ groupStart }: { groupStart?: boolean }) {
    return (
        <td className={`px-2 py-2.5 whitespace-nowrap ${groupStart ? "border-l-2 border-argent" : ""}`}>
            <span className="text-text-muted text-[11px]">—</span>
        </td>
    );
}
