import React, { useState } from 'react';
import { EngineConfig } from '@/types/engine-config';

interface EngineConfigEditorProps {
    config: EngineConfig;
    onChange: (config: EngineConfig) => void;
    onSave: () => void;
    isSaving: boolean;
}

type Tab = 'fatigue' | 'structure' | 'learning' | 'intent' | 'alerts';

export default function EngineConfigEditor({ config, onChange, onSave, isSaving }: EngineConfigEditorProps) {
    const [activeTab, setActiveTab] = useState<Tab>('learning'); // Default to what user asked for

    const updateConfig = (section: keyof EngineConfig, key: string, value: number) => {
        const sectionData = config[section];
        if (typeof sectionData !== 'object' || sectionData === null) return;

        onChange({
            ...config,
            [section]: {
                ...sectionData,
                [key]: value
            }
        });
    };

    const renderInput = (
        section: keyof EngineConfig,
        key: string,
        label: string,
        description: string,
        step = 1,
        min = 0,
        pct = false
    ) => {
        // @ts-ignore
        const val = config[section]?.[key] ?? 0;

        return (
            <div className="bg-stellar/50 p-4 rounded-xl border border-argent/50">
                <div className="flex justify-between items-start mb-2">
                    <label className="text-[11px] font-black text-text-primary uppercase tracking-widest block">{label}</label>
                    <span className="text-[10px] bg-synced/10 text-synced font-mono px-1.5 py-0.5 rounded">
                        {val}{pct ? (key.includes('Threshold') && val < 0 ? '' : '%') : ''}
                    </span>
                </div>
                <p className="text-[10px] text-text-muted mb-3 h-8 leading-tight overflow-hidden">{description}</p>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        step={step}
                        min={min}
                        value={val}
                        onChange={(e) => updateConfig(section, key, parseFloat(e.target.value))}
                        className="w-full bg-stellar border border-argent rounded px-3 py-2 text-small font-bold text-text-primary focus:border-classic outline-none transition-colors"
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end border-b border-argent pb-4">
                <div>
                    <h2 className="text-subheader font-black text-text-primary uppercase tracking-widest">Reglas del Motor (GEM Engine)</h2>
                    <p className="text-small text-text-secondary mt-1">Configura lógicamente cómo la IA toma decisiones.</p>
                </div>
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="btn-classic px-5 py-2 flex items-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        <>💾 Guardar Reglas</>
                    )}
                </button>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-argent/30 pb-1 overflow-x-auto">
                {(['learning', 'intent', 'fatigue', 'structure', 'alerts'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-t-lg transition-colors border-b-2 ${activeTab === tab
                            ? 'text-classic border-classic bg-classic/5'
                            : 'text-text-muted border-transparent hover:text-text-primary hover:bg-argent/10'
                            }`}
                    >
                        {tab === 'learning' && '🚦 Aprendizaje'}
                        {tab === 'intent' && '🎯 Intención'}
                        {tab === 'fatigue' && '😫 Fatiga'}
                        {tab === 'structure' && '🏗️ Estructura'}
                        {tab === 'alerts' && '🔔 Alertas'}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-special/30 rounded-xl p-6 border border-argent/50">
                {activeTab === 'learning' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderInput('learning', 'unstableDays', 'Días Inestables', 'Si una entidad fue editada hace menos de X días, se considera INESTABLE.', 1, 0, false)}
                        {renderInput('learning', 'explorationDays', 'Fase Exploración (Días)', 'Días iniciales donde no se penaliza el rendimiento por falta de datos.', 1, 0, false)}
                        {renderInput('learning', 'exploitationMinConversions', 'Min. Conversiones (Explotación)', 'Volumen necesario para considerar que el aprendizaje salió de exploración por volumen.', 1, 0, false)}
                    </div>
                )}

                {activeTab === 'intent' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderInput('intent', 'bofuScoreThreshold', 'Umbral BOFU (Alta Intención)', 'Score mínimo (0-1) para clasificar una audiencia como Bottom of Funnel.', 0.05, 0, false)}
                        {renderInput('intent', 'mofuScoreThreshold', 'Umbral MOFU (Media Intención)', 'Score mínimo (0-1) para clasificar como Middle of Funnel.', 0.05, 0, false)}
                        {renderInput('intent', 'volatilityPenalty', 'Penalización Volatilidad', 'Factor multiplicador (0-1) aplicado al score si hay pocos datos (<2000 imp). Ej: 0.6 = 40% castigo.', 0.1, 0.1, false)}
                        {renderInput('intent', 'minImpressionsForPenalty', 'Min Impresiones (Fiabilidad)', 'Umbral de impresiones bajo el cual se aplica la penalización por volatilidad.', 100, 0, false)}
                    </div>
                )}

                {activeTab === 'fatigue' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderInput('fatigue', 'frequencyThreshold', 'Frecuencia Máxima', 'Frecuencia semanal sobre la cual se empieza a buscar fatiga.', 0.1, 1, false)}
                        {renderInput('fatigue', 'cpaMultiplierThreshold', 'Tolerancia CPA (Multiplicador)', 'Si CPA_7d > CPA_14d * X, se considera aumento significativo de costos.', 0.05, 1, false)}
                        {renderInput('fatigue', 'hookRateDeltaThreshold', 'Caída Hook Rate (Delta)', 'Valor negativo. Si el cambio en Hook Rate es peor que X (ej -0.2), es fatiga creativa.', 0.05, -1, true)}
                        {renderInput('fatigue', 'concentrationThreshold', 'Concentración Gasto (Risk)', 'Porcentaje (0-1) del gasto en un solo ad para considerarlo riesgo de concentración.', 0.05, 0, true)}
                    </div>
                )}

                {activeTab === 'structure' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderInput('structure', 'fragmentationAdsetsMax', 'Max Adsets (Fragmentación)', 'Número máximo de adsets permitidos antes de alertar por fragmentación si el volumen es bajo.', 1, 1, false)}
                        {renderInput('structure', 'overconcentrationPct', 'Sobre-Concentración (%)', 'Umbral (0-1) donde un solo ad consume demasiado presupuesto.', 0.05, 0, true)}
                        {renderInput('structure', 'overconcentrationMinSpend', 'Gasto Min. para Análisis', 'Gasto mínimo para activar alertas de concentración.', 10, 0, false)}
                    </div>
                )}

                {activeTab === 'alerts' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderInput('alerts', 'learningResetBudgetChangePct', 'Reinicio Aprendizaje (Budget %)', 'Cambio % de presupuesto que probablemente reinicie la fase de aprendizaje.', 5, 0, true)}
                        {renderInput('alerts', 'scalingFrequencyMax', 'Frecuencia Max para Escala', 'Si la frecuencia supera este valor, no se recomienda escalar aunque el CPA sea bueno.', 0.1, 1, false)}
                    </div>
                )}
            </div>
        </div>
    );
}
