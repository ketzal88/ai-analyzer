import React, { useState } from "react";
import { GemReportV1, GemSection, GemInsight, GemAction } from "@/types/gem-report";

interface GemReportRendererProps {
    report: GemReportV1;
}

export default function GemReportRenderer({ report }: GemReportRendererProps) {
    const [activeSectionId, setActiveSectionId] = useState<string>(report.sections[0]?.id || "");

    const activeSection = report.sections.find(s => s.id === activeSectionId) || report.sections[0];

    return (
        <div className="space-y-6">
            {/* Meta Header */}
            <div className="bg-stellar border border-argent rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-body font-bold text-text-primary uppercase tracking-widest">
                        Auditoría {report.meta.model}
                    </h2>
                    <div className="flex gap-4 text-[11px] font-bold text-text-muted mt-1">
                        {report.meta.period ? (
                            <span>{report.meta.period.start} - {report.meta.period.end}</span>
                        ) : (
                            <span>Periodo: N/A</span>
                        )}
                        {report.meta.account && (
                            <span>{report.meta.account.currency || "USD"} / {report.meta.account.timezone || "UTC"}</span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <span className="px-2 py-1 bg-classic/10 text-classic text-[10px] font-black uppercase rounded">
                        {report.meta.schemaVersion}
                    </span>
                    <span className="px-2 py-1 bg-synced/10 text-synced text-[10px] font-black uppercase rounded">
                        {report.meta.generatedAt.split("T")[0]}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-2 pb-2 border-b border-argent">
                {report.sections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSectionId(section.id)}
                        className={`px-4 py-2 rounded-lg text-small font-bold transition-all whitespace-nowrap ${activeSectionId === section.id
                            ? "bg-classic text-white shadow-lg shadow-classic/20"
                            : "bg-argent/10 text-text-muted hover:bg-argent/20"
                            }`}
                    >
                        {section.title}
                    </button>
                ))}
            </div>

            {/* Section Content */}
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeSection?.summary && (
                    <div className="p-4 bg-classic/5 border-l-4 border-classic rounded-r-lg">
                        <p className="text-body text-text-secondary italic">{activeSection.summary}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                    {(activeSection?.insights || []).map(insight => (
                        <InsightCard key={insight.id} insight={insight} />
                    ))}
                    {(!activeSection?.insights || activeSection.insights.length === 0) && (
                        <div className="text-center p-8 text-text-muted italic border border-dashed border-argent rounded-lg">
                            No insights available for this section.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InsightCard({ insight }: { insight: GemInsight }) {
    const severityColors = {
        CRITICAL: "bg-red-500/10 text-red-500 border-red-500/20",
        WARNING: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        INFO: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        SUCCESS: "bg-green-500/10 text-green-500 border-green-500/20"
    };

    const confidenceOpacity = {
        HIGH: 1,
        MEDIUM: 0.7,
        LOW: 0.4
    };

    const colorClasses = severityColors[insight.severity as keyof typeof severityColors] || severityColors.INFO;

    return (
        <div className={`card border-l-4 ${colorClasses.replace("bg-", "border-l-")}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border ${colorClasses}`}>
                            {insight.severity || "INFO"}
                        </span>
                        <span className="text-[10px] font-bold text-text-muted tracking-wide uppercase">
                            {insight.classification}
                        </span>
                    </div>
                    <h3 className="text-subheader font-bold text-text-primary">{insight.title}</h3>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase text-text-muted" title="Confidence Level">
                        <div className="flex gap-0.5">
                            {[1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className={`w-1 h-3 rounded-sm bg-current transition-opacity`}
                                    style={{ opacity: i <= (insight.confidence === "HIGH" ? 3 : insight.confidence === "MEDIUM" ? 2 : 1) ? 1 : 0.2 }}
                                />
                            ))}
                        </div>
                        {insight.confidence}
                    </div>
                </div>
            </div>

            {/* Core Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                    <div>
                        <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Observación</h4>
                        <p className="text-body text-text-secondary">{insight.observation}</p>
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Interpretación Algorítmica</h4>
                        <p className="text-small text-text-muted">{insight.interpretation}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Evidence Table */}
                    {(insight.evidence?.metrics || []).length > 0 ? (
                        <div className="bg-stellar border border-argent rounded-lg overflow-hidden">
                            <table className="w-full text-left text-[11px]">
                                <thead className="bg-argent/10 text-text-muted font-bold uppercase">
                                    <tr>
                                        <th className="p-2">Métrica</th>
                                        <th className="p-2 text-right">Valor</th>
                                        <th className="p-2 text-right">Ref</th>
                                        <th className="p-2 text-right">Δ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-argent">
                                    {(insight.evidence?.metrics || []).map((m, i) => (
                                        <tr key={i}>
                                            <td className="p-2 font-medium text-text-primary">{m.label}</td>
                                            <td className="p-2 text-right text-text-secondary">{m.value}</td>
                                            <td className="p-2 text-right text-text-muted">{m.comparisonValue || "-"}</td>
                                            <td className={`p-2 text-right font-bold ${m.delta && m.delta > 0 ? "text-synced" : "text-red-400"}`}>
                                                {m.delta ? `${m.delta > 0 ? "+" : ""}${m.delta}%` : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-3 bg-argent/5 border border-dashed border-argent rounded-lg text-center">
                            <span className="text-[10px] font-bold text-text-muted uppercase">Evidencia Insuficiente</span>
                        </div>
                    )}

                    <div>
                        <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Implicación Operativa</h4>
                        <p className="text-small text-text-secondary font-medium">{insight.implication}</p>
                    </div>
                </div>
            </div>

            {/* Actions Table */}
            {(insight.actions || []).length > 0 && (
                <div className="mt-4 border-t border-argent pt-4">
                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3">Plan de Acción Recomendado</h4>
                    <div className="grid gap-2">
                        {(insight.actions || []).map((action, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-stellar rounded-lg border border-argent">
                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${action.type === "DO" ? "bg-synced/20 text-synced" :
                                    action.type === "DONT" ? "bg-red-500/20 text-red-500" : "bg-classic/20 text-classic"
                                    }`}>
                                    {action.type}
                                </span>
                                <div className="flex-1">
                                    <p className="text-[12px] font-bold text-text-primary">{action.description}</p>
                                    {action.expectedImpact && (
                                        <p className="text-[10px] text-synced mt-1">Impacto: {action.expectedImpact}</p>
                                    )}
                                </div>
                                <span className="text-[9px] font-bold text-text-muted uppercase bg-argent/10 px-2 py-1 rounded">
                                    {action.horizon}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
