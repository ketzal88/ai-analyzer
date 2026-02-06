"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Client } from "@/types";

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
        active: initialData?.active ?? true,
        isEcommerce: initialData?.isEcommerce ?? false,
        isGoogle: initialData?.isGoogle ?? false,
        metaAdAccountId: initialData?.metaAdAccountId || "",
        googleAdsId: initialData?.googleAdsId || "",

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
        }
    });

    const [slugModifiedManually, setSlugModifiedManually] = useState(false);

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

        if (formData.active && !formData.metaAdAccountId) {
            setError("Meta Ad Account ID is required when the client is active.");
            setLoading(false);
            return;
        }

        try {
            const url = isEditing
                ? `/api/clients/by-slug/${initialData?.slug}`
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

            setSuccess(true);
            setTimeout(() => {
                router.push("/admin/clients");
                router.refresh();
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
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
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
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
                            <p className="mt-2 text-small text-yellow-500">⚠️ Manual slug changes may affect SEO and deep links.</p>
                        )}
                    </div>
                </div>

                {/* Integrations */}
                <div className="space-y-6">
                    <h2 className="text-subheader text-text-primary">Integrations</h2>

                    <div className="space-y-4">
                        <label className="flex items-center gap-3 p-4 border border-argent rounded-lg cursor-pointer hover:bg-special transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.isEcommerce}
                                onChange={(e) => setFormData({ ...formData, isEcommerce: e.target.checked })}
                                className="w-5 h-5 rounded border-argent text-classic focus:ring-0"
                            />
                            <div>
                                <span className="block text-body font-bold text-text-primary">Ecommerce Site</span>
                                <span className="text-small text-text-muted">Enables LTV and Purchase attribution diagnostics.</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-4 border border-argent rounded-lg cursor-pointer hover:bg-special transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.isGoogle}
                                onChange={(e) => setFormData({ ...formData, isGoogle: e.target.checked })}
                                className="w-5 h-5 rounded border-argent text-classic focus:ring-0"
                            />
                            <div>
                                <span className="block text-body font-bold text-text-primary">Google Ads</span>
                                <span className="text-small text-text-muted">Sync Google Ads performance for cross-channel audit.</span>
                            </div>
                        </label>
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

                {/* Conversion Schema Override */}
                <div className="p-4 bg-special/20 rounded-lg border border-argent space-y-4">
                    <h3 className="text-body font-bold text-text-primary">Advanced Conversion Mapping</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Primary Action (Meta)</label>
                            <input
                                type="text"
                                placeholder="e.g. purchase"
                                value={formData.conversionSchema?.primary.actionType || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    conversionSchema: {
                                        ...formData.conversionSchema!,
                                        primary: { ...formData.conversionSchema!.primary, actionType: e.target.value }
                                    }
                                })}
                                className="w-full font-mono text-[12px]"
                            />
                        </div>
                        <div>
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Value Action (Meta)</label>
                            <input
                                type="text"
                                placeholder="e.g. oms_purchase_value"
                                value={formData.conversionSchema?.value?.actionType || ""}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    conversionSchema: {
                                        ...formData.conversionSchema!,
                                        value: { ...formData.conversionSchema!.value!, actionType: e.target.value }
                                    }
                                })}
                                className="w-full font-mono text-[12px]"
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
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
                                className="w-4 h-4 rounded border-argent text-classic"
                            />
                            <span className="text-small font-medium text-text-secondary">Is Revenue Event?</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Details */}
            <div className="col-span-1 md:col-span-2 p-6 bg-stellar border border-argent rounded-lg space-y-6">
                <h2 className="text-subheader text-text-primary">Platform Configuration</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-small font-bold text-text-muted uppercase mb-2">Meta Ad Account ID</label>
                        <input
                            required={formData.active}
                            type="text"
                            value={formData.metaAdAccountId}
                            onChange={(e) => setFormData({ ...formData, metaAdAccountId: e.target.value })}
                            placeholder="act_xxxxxxxxxxxx"
                            className="w-full font-mono"
                        />
                        <p className="mt-1 text-small text-text-muted">Required to fetch Meta Graph API insights.</p>
                    </div>

                    {formData.isGoogle && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-small font-bold text-text-muted uppercase mb-2">Google Ads Customer ID</label>
                            <input
                                type="text"
                                value={formData.googleAdsId}
                                onChange={(e) => setFormData({ ...formData, googleAdsId: e.target.value })}
                                placeholder="xxx-xxx-xxxx"
                                className="w-full font-mono"
                            />
                        </div>
                    )}
                </div>
            </div>

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
