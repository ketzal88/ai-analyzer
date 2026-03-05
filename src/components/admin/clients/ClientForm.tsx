"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Client, Team } from "@/types";
import { EngineConfig, getDefaultEngineConfig } from "@/types/engine-config";

interface ClientFormProps {
    initialData?: Client;
    isEditing?: boolean;
}

export default function ClientForm({ initialData, isEditing = false }: ClientFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState<Partial<Client>>({
        name: initialData?.name || "",
        slug: initialData?.slug || "",
        team: initialData?.team || "",
        active: initialData?.active ?? true,
        businessType: initialData?.businessType || "ecommerce",
        isEcommerce: initialData?.isEcommerce ?? false,
        isGoogle: initialData?.isGoogle ?? false,
        metaAdAccountId: initialData?.metaAdAccountId || "",
        googleAdsId: initialData?.googleAdsId || "",
        perfitApiKey: initialData?.perfitApiKey || "",
        klaviyoApiKey: initialData?.klaviyoApiKey || "",
        klaviyoPublicKey: initialData?.klaviyoPublicKey || "",
        tiendanubeStoreId: initialData?.tiendanubeStoreId || "",
        tiendanubeAccessToken: initialData?.tiendanubeAccessToken || "",
        currency: initialData?.currency || "USD",
        integraciones: initialData?.integraciones || {
            meta: false,
            google: false,
            ga4: false,
            ecommerce: null,
            email: null,
        },
        slackPublicChannel: initialData?.slackPublicChannel || "",
        slackInternalChannel: initialData?.slackInternalChannel || "",

        // Mission 18 Fields
        businessModel: initialData?.businessModel || "",
        description: initialData?.description || "",
        primaryGoal: initialData?.primaryGoal || "efficiency",
        averageTicket: initialData?.averageTicket || 0,
        grossMarginPct: initialData?.grossMarginPct || 0,
        targetCpa: initialData?.targetCpa || 0,
        targetRoas: initialData?.targetRoas || 0,
        conversionSchema: initialData?.conversionSchema || {
            primary: { name: "Purchase", actionType: "purchase", isRevenueEvent: true },
            value: { actionType: "offsite_conversion.fb_pixel_purchase", currency: "USD", isNet: true }
        },

        // Phase 3: Strategic Profile
        growthMode: initialData?.growthMode || "stable",
        ltv: initialData?.ltv || 0,
        seasonalityNotes: initialData?.seasonalityNotes || "",
        funnelPriority: initialData?.funnelPriority || "FULL_FUNNEL",
        constraints: {
            ...initialData?.constraints,
            maxDailyBudget: initialData?.constraints?.maxDailyBudget || 0,
            acceptableVolatilityPct: initialData?.constraints?.acceptableVolatilityPct || 0,
            scalingSpeed: initialData?.constraints?.scalingSpeed || "normal",
            fatigueTolerance: initialData?.constraints?.fatigueTolerance || "normal",
        }
    });

    const [slugModifiedManually, setSlugModifiedManually] = useState(false);
    const [configData, setConfigData] = useState<EngineConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);

    // Fetch teams list
    useEffect(() => {
        fetch("/api/teams").then(r => r.json()).then(setTeams).catch(() => {});
    }, []);

    // Fetch config if editing
    useEffect(() => {
        if (isEditing && initialData?.id) {
            setLoadingConfig(true);
            fetch(`/api/clients/${initialData.id}/engine-config`)
                .then(res => res.json())
                .then(data => {
                    setConfigData(data);
                })
                .catch(err => console.error("Error loading config:", err))
                .finally(() => setLoadingConfig(false));
        } else {
            setConfigData(getDefaultEngineConfig("new-client"));
        }
    }, [isEditing, initialData?.id]);

    // Auto-generate slug from name
    useEffect(() => {
        if (!isEditing && !slugModifiedManually && formData.name) {
            const generatedSlug = formData.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            setFormData(prev => ({ ...prev, slug: generatedSlug }));
        }
    }, [formData.name, isEditing, slugModifiedManually]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        // Validations
        if (!formData.name) {
            setError("Client name is required.");
            setLoading(false);
            return;
        }

        if (formData.integraciones?.meta && !formData.metaAdAccountId) {
            setError("Meta Ad Account ID is required when Meta Ads is enabled.");
            setLoading(false);
            return;
        }

        if (formData.integraciones?.google && !formData.googleAdsId) {
            setError("Google Ads Customer ID is required when Google Ads is enabled.");
            setLoading(false);
            return;
        }

        try {
            const url = isEditing
                ? `/api/clients/${initialData?.id}`
                : "/api/clients";
            const method = isEditing ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save client");
            }

            const savedClient = await res.json();
            const clientId = isEditing ? initialData?.id : savedClient.id;

            // Save Engine Config
            if (configData && clientId) {
                const configRes = await fetch(`/api/clients/${clientId}/engine-config`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(configData)
                });

                if (!configRes.ok) {
                    const configError = await configRes.json();
                    throw new Error(`Client saved, but Engine Config failed: ${configError.error || 'Server error'}`);
                }
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/admin/clients");
                router.refresh();
            }, 1000);
        } catch (err: any) {
            console.error("Submission error:", err);
            setError(err.message);
            setLoading(false); // Ensure loading stops
        } finally {
            // Loading is set to false in catch or after successful redirect/success state
            // But we'll keep the button disabled until redirect
        }
    };

    const handleArchive = async () => {
        if (!initialData?.id || !confirm("Are you sure you want to archive this client? This will disable their diagnostics.")) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/clients/${initialData.id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                router.push("/admin/clients");
                router.refresh();
            } else {
                throw new Error("Failed to archive client");
            }
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-8 pb-20">
            {/* Header Status */}
            <div className="flex items-center justify-between p-4 bg-special border border-argent rounded-lg">
                <div className="flex items-center gap-4">
                    <span className="text-body font-bold text-text-primary">Client Status</span>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, active: !formData.active })}
                        className={`w-12 h-6 rounded-full relative transition-colors ${formData.active ? "bg-synced" : "bg-text-muted/30"}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.active ? "left-7" : "left-1"}`} />
                    </button>
                    <span className={`text-small font-bold ${formData.active ? "text-synced" : "text-text-muted"}`}>
                        {formData.active ? "ACTIVE & SYNCING" : "INACTIVE / PAUSED"}
                    </span>
                </div>
                {isEditing && (
                    <button
                        type="button"
                        onClick={handleArchive}
                        className="text-red-400 text-small font-bold hover:underline"
                    >
                        ARCHIVE CLIENT
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                    <h2 className="text-subheader text-text-primary">Basic Information</h2>

                    <div>
                        <label className="block text-small font-bold text-text-muted uppercase mb-2">Company Name</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Acme Corp"
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-small font-bold text-text-muted uppercase mb-2">URL Slug</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-body select-none">/clients/</span>
                            <input
                                type="text"
                                value={formData.slug}
                                onChange={(e) => {
                                    setFormData({ ...formData, slug: e.target.value });
                                    setSlugModifiedManually(true);
                                }}
                                className="w-full pl-20 font-mono"
                            />
                        </div>
                        {slugModifiedManually && !isEditing && (
                            <p className="mt-2 text-small text-yellow-500">⚠ Manual slug changes may affect SEO and deep links.</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-small font-bold text-text-muted uppercase mb-2">Equipo Asignado</label>
                        <select
                            value={formData.team || ""}
                            onChange={(e) => setFormData({ ...formData, team: e.target.value || undefined })}
                            className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none"
                        >
                            <option value="">Sin equipo asignado</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Slack & Currency */}
                <div className="space-y-6">
                    <h2 className="text-subheader text-text-primary">Slack & Currency</h2>

                    <div>
                        <label className="block text-small font-bold text-text-muted uppercase mb-2">Account Currency</label>
                        <select
                            value={formData.currency}
                            onChange={(e) => {
                                const newCurr = e.target.value as any;
                                setFormData({
                                    ...formData,
                                    currency: newCurr,
                                    conversionSchema: formData.conversionSchema ? {
                                        ...formData.conversionSchema,
                                        value: formData.conversionSchema.value ? {
                                            ...formData.conversionSchema.value,
                                            currency: newCurr
                                        } : { actionType: "", currency: newCurr, isNet: true }
                                    } : undefined
                                });
                            }}
                            className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none font-bold"
                        >
                            <option value="USD">USD - US Dollar</option>
                            <option value="COP">COP - Colombian Peso</option>
                            <option value="ARS">ARS - Argentine Peso</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="BRL">BRL - Brazilian Real</option>
                            <option value="MXN">MXN - Mexican Peso</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="CAD">CAD - Canadian Dollar</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                        </select>
                        <p className="mt-1 text-small text-text-muted">Primary currency for insights & financial metrics.</p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-small font-bold text-text-muted uppercase mb-2">Slack Integration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold">PUBLIC CHANNEL</label>
                                <input
                                    type="text"
                                    value={formData.slackPublicChannel || ""}
                                    onChange={(e) => setFormData({ ...formData, slackPublicChannel: e.target.value })}
                                    placeholder="e.g. C02GBS..."
                                    className="w-full text-small font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold">INTERNAL CHANNEL</label>
                                <input
                                    type="text"
                                    value={formData.slackInternalChannel || ""}
                                    onChange={(e) => setFormData({ ...formData, slackInternalChannel: e.target.value })}
                                    placeholder="e.g. C02GBS..."
                                    className="w-full text-small font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Business Context - Mission 18 */}
            <div className="col-span-1 md:col-span-2 space-y-6 pt-6 border-t border-argent">
                <h2 className="text-subheader text-text-primary">Business Context & Targets</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Strategy */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Business Model</label>
                            <input
                                type="text"
                                value={formData.businessModel}
                                onChange={(e) => setFormData({ ...formData, businessModel: e.target.value })}
                                placeholder="e.g. SaaS, E-commerce Drop"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Primary Objective (Engine)</label>
                            <select
                                value={formData.businessType}
                                onChange={(e) => {
                                    const val = e.target.value as any;
                                    setFormData({ ...formData, businessType: val, isEcommerce: val === 'ecommerce' });
                                    if (configData) {
                                        setConfigData({ ...configData, businessType: val });
                                    }
                                }}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none"
                            >
                                <option value="ecommerce" className="bg-stellar text-text-primary">eCommerce (ROAS/CPA Focused)</option>
                                <option value="leads" className="bg-stellar text-text-primary">Lead Gen (CPL/Schedule Focused)</option>
                                <option value="whatsapp" className="bg-stellar text-text-primary">WhatsApp (Cost per Link Click)</option>
                                <option value="apps" className="bg-stellar text-text-primary">App Installs (CPI Focused)</option>
                            </select>
                            <p className="mt-1 text-tiny text-text-muted italic">This selection optimizes how the AI analyzes the funnel.</p>
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Primary Goal</label>
                            <select
                                value={formData.primaryGoal}
                                onChange={(e) => setFormData({ ...formData, primaryGoal: e.target.value as any })}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none"
                            >
                                <option value="scale" className="bg-stellar text-text-primary">Aggressive Scale</option>
                                <option value="efficiency" className="bg-stellar text-text-primary">Profitability / Efficiency</option>
                                <option value="stability" className="bg-stellar text-text-primary">Stability / Maintenance</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Description / Notes</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full h-24"
                                placeholder="Key context about the client's business..."
                            />
                        </div>
                    </div>

                    {/* Financials */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-small font-bold text-text-muted uppercase mb-2">Avg Ticket ($)</label>
                                <input
                                    type="number"
                                    value={formData.averageTicket}
                                    onChange={(e) => setFormData({ ...formData, averageTicket: Number(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-small font-bold text-text-muted uppercase mb-2">Gross Margin (%)</label>
                                <input
                                    type="number"
                                    value={formData.grossMarginPct}
                                    onChange={(e) => setFormData({ ...formData, grossMarginPct: Number(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-small font-bold text-text-muted uppercase mb-2">Target CPA</label>
                                <input
                                    type="number"
                                    value={formData.targetCpa}
                                    onChange={(e) => setFormData({ ...formData, targetCpa: Number(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-small font-bold text-text-muted uppercase mb-2">Target ROAS</label>
                                <input
                                    type="number"
                                    value={formData.targetRoas}
                                    onChange={(e) => setFormData({ ...formData, targetRoas: Number(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategic Profile — Phase 3 */}
                <div className="p-4 bg-special/20 rounded-lg border border-argent space-y-4">
                    <h3 className="text-body font-bold text-text-primary">Strategic Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Growth Mode</label>
                            <select
                                value={formData.growthMode || "stable"}
                                onChange={(e) => setFormData({ ...formData, growthMode: e.target.value as any })}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none"
                            >
                                <option value="aggressive">Aggressive — Scale fast, higher risk tolerance</option>
                                <option value="stable">Stable — Balanced growth (default)</option>
                                <option value="conservative">Conservative — Protect margins, minimal scaling</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Funnel Priority</label>
                            <select
                                value={formData.funnelPriority || "FULL_FUNNEL"}
                                onChange={(e) => setFormData({ ...formData, funnelPriority: e.target.value as any })}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none"
                            >
                                <option value="TOFU">Top of Funnel — Awareness & Reach</option>
                                <option value="MOFU">Mid Funnel — Consideration & Engagement</option>
                                <option value="BOFU">Bottom of Funnel — Conversions</option>
                                <option value="FULL_FUNNEL">Full Funnel — Balanced</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">LTV ($)</label>
                            <input
                                type="number"
                                value={formData.ltv || 0}
                                onChange={(e) => setFormData({ ...formData, ltv: Number(e.target.value) })}
                                placeholder="Lifetime Value"
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Scaling Speed</label>
                            <select
                                value={formData.constraints?.scalingSpeed || "normal"}
                                onChange={(e) => setFormData({ ...formData, constraints: { ...formData.constraints, scalingSpeed: e.target.value as any } })}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none"
                            >
                                <option value="slow">Slow</option>
                                <option value="normal">Normal</option>
                                <option value="fast">Fast</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Fatigue Tolerance</label>
                            <select
                                value={formData.constraints?.fatigueTolerance || "normal"}
                                onChange={(e) => setFormData({ ...formData, constraints: { ...formData.constraints, fatigueTolerance: e.target.value as any } })}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none"
                            >
                                <option value="low">Low — Strict frequency limits</option>
                                <option value="normal">Normal</option>
                                <option value="high">High — Tolerates higher frequency</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Max Daily Budget ($)</label>
                            <input
                                type="number"
                                value={formData.constraints?.maxDailyBudget || 0}
                                onChange={(e) => setFormData({ ...formData, constraints: { ...formData.constraints, maxDailyBudget: Number(e.target.value) } })}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Volatility Tolerance (%)</label>
                            <input
                                type="number"
                                value={formData.constraints?.acceptableVolatilityPct || 0}
                                onChange={(e) => setFormData({ ...formData, constraints: { ...formData.constraints, acceptableVolatilityPct: Number(e.target.value) } })}
                                placeholder="e.g. 30"
                                className="w-full"
                            />
                            <p className="mt-1 text-[10px] text-text-muted italic">0 = use system default threshold</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-small font-bold text-text-muted uppercase mb-2">Seasonality Notes</label>
                        <input
                            type="text"
                            value={formData.seasonalityNotes || ""}
                            onChange={(e) => setFormData({ ...formData, seasonalityNotes: e.target.value })}
                            placeholder="e.g. Peak in Nov-Dec, low in Jan-Feb"
                            className="w-full"
                        />
                    </div>
                </div>

                {/* Conversion Schema Override */}
                <div className="p-4 bg-special/20 rounded-lg border border-argent space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-body font-bold text-text-primary">Advanced Conversion Mapping</h3>
                        <span className="text-[10px] font-bold text-classic bg-classic/10 px-2 py-0.5 rounded uppercase">
                            Preset: {formData.businessType?.toUpperCase()}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Primary Action (Meta)</label>
                            <select
                                value={formData.conversionSchema?.primary.actionType || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    conversionSchema: {
                                        ...formData.conversionSchema!,
                                        primary: { ...formData.conversionSchema!.primary, actionType: e.target.value }
                                    }
                                })}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none text-small font-mono"
                            >
                                {formData.businessType === 'ecommerce' && (
                                    <>
                                        <option value="purchase">Purchase (Default)</option>
                                        <option value="add_to_cart">Add to Cart</option>
                                        <option value="initiate_checkout">Initiate Checkout</option>
                                    </>
                                )}
                                {formData.businessType === 'leads' && (
                                    <>
                                        <option value="lead">Lead (Default)</option>
                                        <option value="complete_registration">Complete Registration</option>
                                        <option value="contact">Contact</option>
                                        <option value="schedule">Schedule</option>
                                    </>
                                )}
                                {formData.businessType === 'whatsapp' && (
                                    <>
                                        <option value="contact">Contact (WhatsApp Link)</option>
                                        <option value="lead">Lead</option>
                                        <option value="custom.whatsapp_click">Custom: WhatsApp Click</option>
                                    </>
                                )}
                                {formData.businessType === 'apps' && (
                                    <>
                                        <option value="app_install">App Install (Default)</option>
                                        <option value="app_custom_event">Custom App Event</option>
                                    </>
                                )}
                                <option value="other">--- Custom / Manual ---</option>
                            </select>
                            {/* Allow manual override if they choose "other" or want to type it */}
                            <input
                                type="text"
                                placeholder="Manual override..."
                                value={formData.conversionSchema?.primary.actionType || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    conversionSchema: {
                                        ...formData.conversionSchema!,
                                        primary: { ...formData.conversionSchema!.primary, actionType: e.target.value }
                                    }
                                })}
                                className="mt-2 w-full font-mono text-[11px] opacity-70"
                            />
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Value Action (Meta)</label>
                            <select
                                value={formData.conversionSchema?.value?.actionType || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    conversionSchema: {
                                        ...formData.conversionSchema!,
                                        value: { ...formData.conversionSchema!.value!, actionType: e.target.value }
                                    }
                                })}
                                className="w-full bg-stellar border border-argent rounded-lg px-3 py-2 text-text-primary focus:border-classic outline-none text-small font-mono"
                            >
                                <option value="offsite_conversion.fb_pixel_purchase">FB Pixel Purchase Value</option>
                                <option value="oms_purchase_value">OMS Purchase Value (Server)</option>
                                <option value="">No Value Tracking</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Manual override..."
                                value={formData.conversionSchema?.value?.actionType || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    conversionSchema: {
                                        ...formData.conversionSchema!,
                                        value: { ...formData.conversionSchema!.value!, actionType: e.target.value }
                                    }
                                })}
                                className="mt-2 w-full font-mono text-[11px] opacity-70"
                            />
                        </div>
                        <div className="flex flex-col justify-end gap-2 pb-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.conversionSchema?.primary.isRevenueEvent || false}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        conversionSchema: {
                                            ...formData.conversionSchema!,
                                            primary: { ...formData.conversionSchema!.primary, isRevenueEvent: e.target.checked }
                                        }
                                    })}
                                    className="w-4 h-4 rounded border-argent text-classic focus:ring-0"
                                />
                                <span className="text-small font-bold text-text-secondary group-hover:text-text-primary transition-colors">IS REVENUE EVENT?</span>
                            </label>
                            <p className="text-[10px] text-text-muted italic">Enable to calculate ROAS and total revenue for this action.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Channel Integrations — Consolidated */}
            <div className="col-span-1 md:col-span-2 p-6 bg-stellar border border-argent rounded-lg space-y-6">
                <h2 className="text-subheader text-text-primary">Channel Integrations</h2>
                <p className="text-small text-text-muted -mt-4">Enable channels and configure credentials in one place.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Meta Ads */}
                    <div className="p-4 border border-argent rounded-lg space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.integraciones?.meta || !!formData.metaAdAccountId}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setFormData({
                                        ...formData,
                                        integraciones: { ...formData.integraciones!, meta: checked },
                                        ...(checked ? {} : { metaAdAccountId: "" }),
                                    });
                                }}
                                className="w-4 h-4 rounded border-argent text-classic focus:ring-0"
                            />
                            <span className="text-body font-bold text-text-primary">Meta Ads</span>
                        </label>
                        {(formData.integraciones?.meta || !!formData.metaAdAccountId) && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">AD ACCOUNT ID</label>
                                    <input
                                        type="text"
                                        value={formData.metaAdAccountId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData({
                                                ...formData,
                                                metaAdAccountId: val,
                                                integraciones: { ...formData.integraciones!, meta: !!val },
                                            });
                                        }}
                                        placeholder="act_xxxxxxxxxxxx"
                                        className="w-full bg-stellar border border-argent rounded px-3 py-2 text-small text-text-primary font-mono placeholder:text-text-muted/50 focus:border-classic outline-none"
                                    />
                                </div>
                                <p className="text-tiny text-text-muted">Uses global META_ACCESS_TOKEN.</p>
                            </div>
                        )}
                    </div>

                    {/* Google Ads */}
                    <div className="p-4 border border-argent rounded-lg space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.integraciones?.google || !!formData.googleAdsId}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setFormData({
                                        ...formData,
                                        integraciones: { ...formData.integraciones!, google: checked },
                                        isGoogle: checked,
                                        ...(checked ? {} : { googleAdsId: "" }),
                                    });
                                }}
                                className="w-4 h-4 rounded border-argent text-classic focus:ring-0"
                            />
                            <span className="text-body font-bold text-text-primary">Google Ads</span>
                        </label>
                        {(formData.integraciones?.google || !!formData.googleAdsId) && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">CUSTOMER ID</label>
                                    <input
                                        type="text"
                                        value={formData.googleAdsId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData({
                                                ...formData,
                                                googleAdsId: val,
                                                isGoogle: !!val,
                                                integraciones: { ...formData.integraciones!, google: !!val },
                                            });
                                        }}
                                        placeholder="xxx-xxx-xxxx"
                                        className="w-full bg-stellar border border-argent rounded px-3 py-2 text-small text-text-primary font-mono placeholder:text-text-muted/50 focus:border-classic outline-none"
                                    />
                                </div>
                                <p className="text-tiny text-text-muted">Uses global OAuth credentials.</p>
                            </div>
                        )}
                    </div>

                    {/* Ecommerce / Tienda Nube */}
                    <div className="p-4 border border-argent rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-body font-bold text-text-primary">Ecommerce</span>
                            <select
                                value={formData.integraciones?.ecommerce || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    integraciones: { ...formData.integraciones!, ecommerce: (e.target.value || null) as any }
                                })}
                                className="bg-stellar border border-argent rounded px-2 py-1 text-small text-text-primary focus:border-classic outline-none"
                            >
                                <option value="">Disabled</option>
                                <option value="tiendanube">Tienda Nube</option>
                                <option value="shopify">Shopify</option>
                                <option value="woocommerce">WooCommerce</option>
                            </select>
                        </div>
                        {formData.integraciones?.ecommerce === 'shopify' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                {initialData?.shopifyAccessToken ? (
                                    <div className="flex items-center gap-2 p-2 bg-synced/10 border border-synced/30 rounded">
                                        <div className="w-2 h-2 bg-synced rounded-full" />
                                        <span className="text-small font-bold text-synced">Connected</span>
                                        <span className="text-tiny text-text-muted font-mono">{initialData.shopifyStoreDomain}</span>
                                    </div>
                                ) : isEditing && initialData?.id ? (
                                    <a
                                        href={`/api/integrations/shopify/auth?shop=&clientId=${initialData.id}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const shop = prompt("Ingresá el dominio de Shopify del cliente:", "mi-tienda.myshopify.com");
                                            if (shop) {
                                                window.location.href = `/api/integrations/shopify/auth?shop=${encodeURIComponent(shop)}&clientId=${initialData.id}`;
                                            }
                                        }}
                                        className="block text-center py-2 px-4 bg-classic/20 text-classic font-bold text-small rounded hover:bg-classic/30 transition-colors cursor-pointer"
                                    >
                                        CONECTAR SHOPIFY
                                    </a>
                                ) : (
                                    <p className="text-tiny text-yellow-500">Guardá el cliente primero, luego conectá Shopify.</p>
                                )}
                            </div>
                        )}
                        {formData.integraciones?.ecommerce === 'tiendanube' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                {initialData?.tiendanubeAccessToken ? (
                                    <div className="flex items-center gap-2 p-2 bg-synced/10 border border-synced/30 rounded">
                                        <div className="w-2 h-2 bg-synced rounded-full" />
                                        <span className="text-small font-bold text-synced">Connected</span>
                                        <span className="text-tiny text-text-muted font-mono">Store #{initialData.tiendanubeStoreId}</span>
                                    </div>
                                ) : (
                                    <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                                        <p className="text-small text-yellow-400 font-bold">Pendiente de instalacion</p>
                                        <p className="text-tiny text-text-muted mt-1">
                                            El cliente debe instalar la app &quot;Worker Brain&quot; desde el marketplace de Tienda Nube.
                                            Las credenciales se configuran automaticamente via OAuth.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {formData.integraciones?.ecommerce === 'woocommerce' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                {initialData?.woocommerceConsumerKey ? (
                                    <div className="flex items-center gap-2 p-2 bg-synced/10 border border-synced/30 rounded">
                                        <div className="w-2 h-2 bg-synced rounded-full" />
                                        <span className="text-small font-bold text-synced">Connected</span>
                                        <span className="text-tiny text-text-muted font-mono">{initialData.woocommerceStoreDomain}</span>
                                    </div>
                                ) : null}
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">STORE DOMAIN</label>
                                    <input
                                        type="text"
                                        value={formData.woocommerceStoreDomain || ""}
                                        onChange={(e) => setFormData({ ...formData, woocommerceStoreDomain: e.target.value })}
                                        placeholder="mitienda.com"
                                        className="w-full bg-stellar border border-argent rounded px-3 py-2 text-small text-text-primary font-mono placeholder:text-text-muted/50 focus:border-classic outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">CONSUMER KEY</label>
                                    <input
                                        type="text"
                                        value={formData.woocommerceConsumerKey || ""}
                                        onChange={(e) => setFormData({ ...formData, woocommerceConsumerKey: e.target.value })}
                                        placeholder="ck_..."
                                        className="w-full bg-stellar border border-argent rounded px-3 py-2 text-small text-text-primary font-mono placeholder:text-text-muted/50 focus:border-classic outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">CONSUMER SECRET</label>
                                    <input
                                        type="password"
                                        value={formData.woocommerceConsumerSecret || ""}
                                        onChange={(e) => setFormData({ ...formData, woocommerceConsumerSecret: e.target.value })}
                                        placeholder="cs_..."
                                        className="w-full bg-stellar border border-argent rounded px-3 py-2 text-small text-text-primary font-mono placeholder:text-text-muted/50 focus:border-classic outline-none"
                                    />
                                </div>
                                <p className="text-tiny text-text-muted">
                                    Las API keys se generan en WooCommerce &rarr; Settings &rarr; Advanced &rarr; REST API.
                                    Permisos: Read.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Email / Perfit */}
                    <div className="p-4 border border-argent rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-body font-bold text-text-primary">Email Marketing</span>
                            <select
                                value={formData.integraciones?.email || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    integraciones: { ...formData.integraciones!, email: (e.target.value || null) as any }
                                })}
                                className="bg-stellar border border-argent rounded px-2 py-1 text-small text-text-primary focus:border-classic outline-none"
                            >
                                <option value="">Disabled</option>
                                <option value="perfit">Perfit</option>
                                <option value="klaviyo">Klaviyo</option>
                            </select>
                        </div>
                        {formData.integraciones?.email === 'perfit' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">API KEY</label>
                                    <input
                                        type="password"
                                        value={formData.perfitApiKey || ""}
                                        onChange={(e) => setFormData({ ...formData, perfitApiKey: e.target.value })}
                                        placeholder="accountId-secret"
                                        className="w-full text-small font-mono"
                                    />
                                    <p className="text-[10px] text-text-muted mt-1">Format: {"{accountId}-{secret}"}. Account ID is extracted automatically.</p>
                                </div>
                            </div>
                        )}
                        {formData.integraciones?.email === 'klaviyo' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">PRIVATE API KEY</label>
                                    <input
                                        type="password"
                                        value={formData.klaviyoApiKey || ""}
                                        onChange={(e) => setFormData({ ...formData, klaviyoApiKey: e.target.value })}
                                        placeholder="pk_xxxxxxxxxxxx"
                                        className="w-full text-small font-mono"
                                    />
                                    <p className="text-[10px] text-text-muted mt-1">Private API Key from Klaviyo Settings → API Keys. Server-side, para traer métricas.</p>
                                </div>
                                <div>
                                    <label className="block text-tiny text-text-muted mb-1 font-bold">PUBLIC API KEY / SITE ID</label>
                                    <input
                                        type="text"
                                        value={formData.klaviyoPublicKey || ""}
                                        onChange={(e) => setFormData({ ...formData, klaviyoPublicKey: e.target.value })}
                                        placeholder="AbCdEf"
                                        className="w-full text-small font-mono"
                                    />
                                    <p className="text-[10px] text-text-muted mt-1">Public API Key (6 caracteres). Identifica la cuenta.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Engine Tuning - Phase 1 Enhancements */}
            {configData && (
                <div className="col-span-1 md:col-span-2 space-y-6 pt-6 border-t border-argent">
                    <div className="flex items-center justify-between">
                        <h2 className="text-subheader text-text-primary">AI Engine Tuning</h2>
                        <span className="text-small text-text-muted bg-special px-2 py-1 rounded">V2 CONFIG</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Fatigue Tuning */}
                        <div className="p-4 bg-special border border-argent rounded-lg space-y-4">
                            <h3 className="text-small font-bold text-text-primary border-b border-argent pb-2 uppercase">Fatigue</h3>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">Frequency Limit</label>
                                <input
                                    type="number" step="0.5"
                                    value={configData.fatigue.frequencyThreshold}
                                    onChange={(e) => setConfigData({ ...configData, fatigue: { ...configData.fatigue, frequencyThreshold: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">CPA Mult (Δ)</label>
                                <input
                                    type="number" step="0.05"
                                    value={configData.fatigue.cpaMultiplierThreshold}
                                    onChange={(e) => setConfigData({ ...configData, fatigue: { ...configData.fatigue, cpaMultiplierThreshold: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                        </div>

                        {/* Structure Tuning */}
                        <div className="p-4 bg-special border border-argent rounded-lg space-y-4">
                            <h3 className="text-small font-bold text-text-primary border-b border-argent pb-2 uppercase">Structure</h3>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">Max Adsets</label>
                                <input
                                    type="number"
                                    value={configData.structure.fragmentationAdsetsMax}
                                    onChange={(e) => setConfigData({ ...configData, structure: { ...configData.structure, fragmentationAdsetsMax: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">Over-concent %</label>
                                <input
                                    type="number" step="0.05"
                                    value={configData.structure.overconcentrationPct}
                                    onChange={(e) => setConfigData({ ...configData, structure: { ...configData.structure, overconcentrationPct: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                        </div>

                        {/* Alert Tuning */}
                        <div className="p-4 bg-special border border-argent rounded-lg space-y-4">
                            <h3 className="text-small font-bold text-text-primary border-b border-argent pb-2 uppercase">Sensitivity</h3>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">Budget Δ% (Limit)</label>
                                <input
                                    type="number"
                                    value={configData.alerts.learningResetBudgetChangePct}
                                    onChange={(e) => setConfigData({ ...configData, alerts: { ...configData.alerts, learningResetBudgetChangePct: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">Scaling Cap</label>
                                <input
                                    type="number" step="0.5"
                                    value={configData.alerts.scalingFrequencyMax}
                                    onChange={(e) => setConfigData({ ...configData, alerts: { ...configData.alerts, scalingFrequencyMax: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                        </div>

                        {/* Findings Tuning */}
                        <div className="p-4 bg-special border border-argent rounded-lg space-y-4">
                            <h3 className="text-small font-bold text-text-primary border-b border-argent pb-2 uppercase">Findings</h3>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">CPA Spike %</label>
                                <input
                                    type="number" step="0.05"
                                    value={configData.findings.cpaSpikeThreshold}
                                    onChange={(e) => setConfigData({ ...configData, findings: { ...configData.findings, cpaSpikeThreshold: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                            <div>
                                <label className="block text-tiny text-text-muted mb-1 font-bold uppercase">Volatility (CoV)</label>
                                <input
                                    type="number" step="0.1"
                                    value={configData.findings.volatilityThreshold}
                                    onChange={(e) => setConfigData({ ...configData, findings: { ...configData.findings, volatilityThreshold: Number(e.target.value) } })}
                                    className="w-full bg-stellar border border-argent p-1 text-small rounded outline-none focus:border-classic"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback & Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-argent">
                <div className="flex-1">
                    {error && (
                        <div className="text-red-500 text-body flex items-center gap-2 animate-in fade-in">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="text-synced text-body flex items-center gap-2 animate-in fade-in">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Client {isEditing ? "updated" : "created"} successfully!
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="btn-secondary"
                    >
                        CANCEL
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary min-w-[120px]"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                        ) : (
                            isEditing ? "SAVE CHANGES" : "CREATE CLIENT"
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
