interface KPICardProps {
    label: string;
    value: string;
    subtitle?: string;
    color?: string;
    /** % change vs previous period */
    delta?: number | null;
    /** When true, negative delta is good (e.g. CPA, bounces) */
    deltaInverse?: boolean;
}

export function calcDelta(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null;
    return ((current - previous) / Math.abs(previous)) * 100;
}

export default function KPICard({ label, value, subtitle, color, delta, deltaInverse }: KPICardProps) {
    const showDelta = delta != null && isFinite(delta);
    const isPositive = showDelta && delta! > 0;
    const isNegative = showDelta && delta! < 0;

    // Green = good, Red = bad. deltaInverse flips the meaning.
    const isGood = deltaInverse ? isNegative : isPositive;
    const isBad = deltaInverse ? isPositive : isNegative;

    const deltaColor = isGood ? "text-synced" : isBad ? "text-red-400" : "text-text-muted";
    const arrow = isPositive ? "▲" : isNegative ? "▼" : "";
    const sign = isPositive ? "+" : "";
    const deltaText = showDelta ? `${sign}${delta!.toFixed(1)}%` : "";

    return (
        <div className="card p-5 hover:border-classic/30 transition-all">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</p>
            <div className="flex items-baseline gap-2 mt-2">
                <p className={`text-2xl font-black font-mono ${color || "text-text-primary"}`}>{value}</p>
                {showDelta && (
                    <span className={`text-[9px] font-mono font-bold ${deltaColor}`}>
                        {arrow} {deltaText}
                    </span>
                )}
            </div>
            {subtitle && <p className="text-[10px] text-text-muted mt-1">{subtitle}</p>}
        </div>
    );
}
