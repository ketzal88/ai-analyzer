import { db } from "@/lib/firebase-admin";
import { Alert, Client } from "@/types";
import { EntityRollingMetrics } from "@/types/performance-snapshots";
import { MTDAggregation } from "@/types/client-snapshot";
import { AccountHealth } from "@/types/system-events";
import { SemaforoSnapshot, MetricSemaforo } from "@/types/semaforo";
import { SystemSettingsService } from "@/lib/system-settings-service";
import {
    businessTypeToObjective,
    getPrimaryMetric,
    isRoasRelevant,
    isCpaRelevant,
    CampaignObjectiveType,
} from "@/lib/objective-utils";

interface DailySnapshotKPIs {
    // Gastos y Tráfico
    spend: number;
    clicks: number;
    cpc: number;
    ctr: number;
    impressions: number;
    // Conversiones
    purchases: number;
    purchaseValue: number;
    costPerPurchase: number;
    roas: number;
    // Eventos de intención
    addToCart: number;
    addToCartValue: number;
    costPerAddToCart: number;
    checkout: number;
    checkoutValue: number;
    costPerCheckout: number;
    // Leads (si aplica)
    leads: number;
    costPerLead: number;
    // WhatsApp (si aplica)
    whatsapp: number;
    costPerWhatsapp: number;
}

interface SnapshotDateRange {
    start: string;
    end: string;
}

export class SlackService {

    // ─── Helper: resolve target channel ──────────────────────

    private static async resolveChannel(clientId: string): Promise<{ client: Client | null; channel: string | null; botToken: string | null; webhook: string | null }> {
        const botToken = process.env.SLACK_BOT_TOKEN || null;
        const webhook = process.env.SLACK_WEBHOOK_URL || null;

        const clientDoc = await db.collection("clients").doc(clientId).get();
        const client = clientDoc.exists ? (clientDoc.data() as Client) : null;
        const channel = client?.slackInternalChannel || null;

        return { client, channel, botToken, webhook };
    }

    // ─── Helper: send a Slack message ────────────────────────

    private static async postMessage(botToken: string | null, webhook: string | null, channel: string | null, blocks: any[], fallbackText: string, opts?: { bypassMasterSwitch?: boolean }) {
        try {
            // Master Switch Check (bypass for critical health alerts and daily briefing)
            if (!opts?.bypassMasterSwitch) {
                const sysSettings = await SystemSettingsService.getSettings();
                const errorChannel = process.env.SLACK_ERROR_CHANNEL_ID || process.env.SLACK_ERROR_CHANNEL;
                if (!sysSettings.alertsEnabled && channel !== errorChannel) {
                    console.log(`[SlackService] Alerts are GLOBALLY DISABLED. Skipping delivery to channel: ${channel}`);
                    return;
                }
            }

            if (botToken && channel) {
                const res = await fetch("https://slack.com/api/chat.postMessage", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${botToken}`
                    },
                    body: JSON.stringify({ channel, blocks, text: fallbackText })
                });
                const data = await res.json();
                if (!data.ok) console.error("Slack API Error:", data.error);
            } else if (webhook) {
                await fetch(webhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ blocks })
                });
            } else {
                console.warn("No Slack delivery method configured (bot token + channel or webhook)");
            }
        } catch (e) {
            console.error("Error sending Slack message:", e);
        }
    }

    // ─── Formatting Helpers ──────────────────────────────────

    private static fmtNum(n: number): string {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
        return n % 1 === 0 ? n.toLocaleString("es-AR") : n.toFixed(2);
    }

    private static fmtCurrency(n: number, currency?: string): string {
        if (currency && currency !== "USD") {
            return `$${this.fmtNum(n)} ${currency}`;
        }
        return `$${this.fmtNum(n)}`;
    }

    private static fmtPct(n: number): string {
        return `${n.toFixed(2)}%`;
    }

    private static fmtDelta(val: number): string {
        const emoji = val > 0 ? "📈" : val < 0 ? "📉" : "➖";
        return `${emoji} ${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
    }

    // ═════════════════════════════════════════════════════════
    //  0. ERROR LOGGER — Errores al canal #errors
    // ═════════════════════════════════════════════════════════

    static async sendError(opts: {
        source: string;       // e.g. "API /api/sync", "CronJob daily-digest", "LLM Gemini"
        message: string;
        stack?: string;
        clientId?: string;
        clientName?: string;
        metadata?: Record<string, any>;
    }) {
        const botToken = process.env.SLACK_BOT_TOKEN;
        const errorChannel = process.env.SLACK_ERROR_CHANNEL_ID || process.env.SLACK_ERROR_CHANNEL;

        if (!botToken || !errorChannel) {
            console.error(`[SlackError] ${opts.source}: ${opts.message}`);
            return;
        }

        const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

        const sourceEmoji: Record<string, string> = {
            api: "🌐",
            cron: "⏰",
            llm: "🤖",
            meta: "📘",
            firebase: "🔥",
            slack: "💬",
            sync: "🔄",
            classification: "🎯",
            alert: "🚨",
            creative: "🎨",
        };

        const emoji = Object.entries(sourceEmoji).find(([key]) =>
            opts.source.toLowerCase().includes(key)
        )?.[1] || "❌";

        let text = `${emoji} *ERROR — ${opts.source}*\n\n`;
        text += `⏰ ${now}\n`;

        if (opts.clientId || opts.clientName) {
            text += `👤 Cliente: ${opts.clientName || opts.clientId}\n`;
        }

        text += `\n💬 *Mensaje:*\n\`\`\`${opts.message}\`\`\`\n`;

        if (opts.stack) {
            const shortStack = opts.stack.length > 800 ? opts.stack.substring(0, 800) + "\n..." : opts.stack;
            text += `\n📋 *Stack Trace:*\n\`\`\`${shortStack}\`\`\`\n`;
        }

        if (opts.metadata && Object.keys(opts.metadata).length > 0) {
            const metaStr = Object.entries(opts.metadata)
                .map(([k, v]) => `• *${k}:* ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join("\n");
            text += `\n📎 *Contexto:*\n${metaStr}\n`;
        }

        const blocks: any[] = [
            { type: "section", text: { type: "mrkdwn", text } },
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `_AI Analyzer Error Logger_ · ${opts.source}`
                }]
            }
        ];

        try {
            await fetch("https://slack.com/api/chat.postMessage", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${botToken}`
                },
                body: JSON.stringify({
                    channel: errorChannel,
                    blocks,
                    text: `Error en ${opts.source}: ${opts.message}`
                })
            });
        } catch (e) {
            console.error("[SlackError] Failed to send error to Slack:", e);
        }
    }

    // ═════════════════════════════════════════════════════════
    //  1. DAILY SNAPSHOT — Reporte diario formateado
    // ═════════════════════════════════════════════════════════

    static async sendDailySnapshot(
        clientId: string,
        clientName: string,
        dateRange: SnapshotDateRange,
        kpis: DailySnapshotKPIs,
        titleTemplate?: string
    ) {


        const { client, channel, botToken, webhook } = await this.resolveChannel(clientId);

        if (!botToken && !webhook) {
            console.warn("Slack not configured, skipping daily snapshot");
            return;
        }

        const businessType = client?.businessType || "ecommerce";
        const objective = businessTypeToObjective(businessType);
        const primaryMetric = getPrimaryMetric(objective);
        const showRoas = isRoasRelevant(objective);
        const showCpa = isCpaRelevant(objective);

        // ── Build mrkdwn text (simpler, like the user's example) ──
        let title = titleTemplate || `📊 *Reporte Acumulado Mes — {clientName}* (del {startDate} al {endDate})`;
        title = title
            .replace(/{clientName}/g, clientName)
            .replace(/{startDate}/g, dateRange.start)
            .replace(/{endDate}/g, dateRange.end);

        let text = `${title}\n\n`;

        const currency = client?.currency || "USD";

        // Gastos y Tráfico
        text += `💰 *Gastos y Tráfico*\n`;
        text += `• Inversión: ${this.fmtCurrency(kpis.spend, currency)}\n`;
        text += `• Clicks: ${this.fmtNum(kpis.clicks)}\n`;
        text += `• CPC: ${this.fmtCurrency(kpis.cpc, currency)}\n`;
        text += `• CTR: ${this.fmtPct(kpis.ctr)}\n`;
        text += `• Impresiones: ${this.fmtNum(kpis.impressions)}\n\n`;

        // Primary conversions section — driven by objective
        if (objective === 'sales') {
            text += `🛒 *Conversiones*\n`;
            text += `• ${primaryMetric.labelEs}: ${kpis.purchases}\n`;
            text += `• Valor de compra: ${this.fmtCurrency(kpis.purchaseValue, currency)}\n`;
            text += `• Coste por compra: ${this.fmtCurrency(kpis.costPerPurchase, currency)}\n`;
            text += `• ROAS: ${kpis.roas.toFixed(2)}\n\n`;
        } else if (objective === 'leads') {
            text += `📋 *${primaryMetric.labelEs}*\n`;
            text += `• ${primaryMetric.labelEs}: ${kpis.leads}\n`;
            text += `• Coste por ${primaryMetric.labelEs}: ${this.fmtCurrency(kpis.costPerLead, currency)}\n\n`;
        } else if (objective === 'messaging') {
            text += `💬 *${primaryMetric.labelEs}*\n`;
            text += `• ${primaryMetric.labelEs}: ${kpis.whatsapp}\n`;
            text += `• Coste por conversación: ${this.fmtCurrency(kpis.costPerWhatsapp, currency)}\n\n`;
        } else if (objective === 'app_installs') {
            text += `📱 *${primaryMetric.labelEs}*\n`;
            text += `• ${primaryMetric.labelEs}: ${(kpis as any).installs || 0}\n`;
            text += `• Coste por ${primaryMetric.labelEs}: ${this.fmtCurrency((kpis as any).costPerInstall || 0, currency)}\n\n`;
        }

        // Show secondary WhatsApp data if not primary but has data
        if (objective !== 'messaging' && kpis.whatsapp > 0) {
            text += `💬 *WhatsApp*\n`;
            text += `• Conversaciones: ${kpis.whatsapp}\n`;
            text += `• Coste por conversación: ${this.fmtCurrency(kpis.costPerWhatsapp, currency)}\n\n`;
        }

        // Show secondary App Installs if not primary but has data
        if (objective !== 'app_installs' && (kpis as any).installs > 0) {
            text += `📱 *App Installs*\n`;
            text += `• Installs: ${(kpis as any).installs || 0}\n`;
            text += `• Coste por Install: ${this.fmtCurrency((kpis as any).costPerInstall || 0, currency)}\n\n`;
        }

        // Eventos de intención
        if (kpis.addToCart > 0 || kpis.checkout > 0) {
            text += `🧺 *Eventos de intención*\n`;
            if (kpis.addToCart > 0) {
                text += `• Add to Cart: ${kpis.addToCart}\n`;
                if (kpis.addToCartValue > 0) text += `• Valor ATC: ${this.fmtCurrency(kpis.addToCartValue, currency)}\n`;
                text += `• Coste ATC: ${this.fmtCurrency(kpis.costPerAddToCart, currency)}\n\n`;
            }
            if (kpis.checkout > 0) {
                text += `• Checkout: ${kpis.checkout}\n`;
                if (kpis.checkoutValue > 0) text += `• Valor Checkout: ${this.fmtCurrency(kpis.checkoutValue, currency)}\n`;
                text += `• Coste Checkout: ${this.fmtCurrency(kpis.costPerCheckout, currency)}\n\n`;
            }
        }

        text += `_Generado automáticamente por AI Analyzer_`;

        const blocks: any[] = [
            {
                type: "section",
                text: { type: "mrkdwn", text }
            },
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `<https://ai-analyzer.vercel.app/ads-manager?clientId=${clientId}|📊 Ver Ads Manager> · <https://ai-analyzer.vercel.app/decision-board?clientId=${clientId}|🎯 Decision Board>`
                }]
            }
        ];

        await this.postMessage(botToken, webhook, channel, blocks, `Reporte diario de ${clientName}`);
    }

    // ═════════════════════════════════════════════════════════
    //  1B. MULTI-CHANNEL DAILY BRIEFING — All channels in one message
    // ═════════════════════════════════════════════════════════

    /**
     * Sends a unified daily briefing with data from ALL active channels.
     * Revenue dedup: Ecommerce is source of truth. Ad platform revenue is NOT summed into total.
     * Blended ROAS = ecommerce_revenue / (meta_spend + google_spend).
     */
    static async sendMultiChannelDigest(
        clientId: string,
        clientName: string,
        dateRange: SnapshotDateRange,
        channelData: {
            meta?: { spend: number; impressions: number; clicks: number; ctr: number; conversions: number; revenue: number; roas: number; cpa: number };
            google?: { spend: number; impressions: number; clicks: number; ctr: number; conversions: number; revenue: number; roas: number; cpa: number };
            ecommerce?: { revenue: number; orders: number; avgOrderValue: number; refunds?: number; totalRefundAmount?: number; newCustomers?: number; returningCustomers?: number; source?: string };
            email?: { sent: number; opens: number; openRate: number; emailClicks: number; clickRate: number; clickToOpenRate: number; emailRevenue: number; source?: string };
        },
        currency?: string
    ) {
        const { client, channel, botToken, webhook } = await this.resolveChannel(clientId);
        if (!botToken && !webhook) return;

        const cur = currency || client?.currency || "USD";

        const fmtDate = (d: string) => {
            const [y, m, day] = d.split("-");
            return `${parseInt(day)} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][parseInt(m) - 1]}`;
        };

        let text = `📊 *WORKER BRAIN — Resumen Diario*\n`;
        text += `*${clientName}* · ${fmtDate(dateRange.start)} - ${fmtDate(dateRange.end)} 2026\n\n`;

        // ── PAID MEDIA ──
        const hasMeta = !!channelData.meta && channelData.meta.spend > 0;
        const hasGoogle = !!channelData.google && channelData.google.spend > 0;

        if (hasMeta || hasGoogle) {
            text += `━━━ *PAID MEDIA* ━━━\n\n`;

            if (hasMeta) {
                const m = channelData.meta!;
                text += `🟦 *Meta:*\n`;
                text += `💰 ${this.fmtCurrency(m.spend, cur)} invertido\n`;
                text += `👁️ ${this.fmtNum(m.impressions)} impresiones · ${this.fmtNum(m.clicks)} clicks · CTR ${this.fmtPct(m.ctr)}\n`;
                text += `🛒 ${this.fmtNum(m.conversions)} compras\n`;
                text += `📈 ROAS ${m.roas.toFixed(2)}x · CPA ${this.fmtCurrency(m.cpa, cur)}\n\n`;
            }
            if (hasGoogle) {
                const g = channelData.google!;
                text += `🟩 *Google:*\n`;
                text += `💰 ${this.fmtCurrency(g.spend, cur)} invertido\n`;
                text += `👁️ ${this.fmtNum(g.impressions)} impresiones · ${this.fmtNum(g.clicks)} clicks · CTR ${this.fmtPct(g.ctr)}\n`;
                text += `🎯 ${this.fmtNum(g.conversions)} conversiones\n`;
                text += `📈 ROAS ${g.roas.toFixed(2)}x · CPA ${this.fmtCurrency(g.cpa, cur)}\n\n`;
            }

            const totalSpend = (channelData.meta?.spend || 0) + (channelData.google?.spend || 0);
            text += `💸 *Total Ads:* ${this.fmtCurrency(totalSpend, cur)} invertido\n\n`;
        }

        // ── EMAIL ──
        const hasEmail = !!channelData.email && channelData.email.sent > 0;

        if (hasEmail) {
            const em = channelData.email!;
            text += `━━━ *EMAIL* ━━━\n\n`;
            text += `📤 Enviados: ${this.fmtNum(em.sent)}\n`;
            text += `👀 Opens: ${this.fmtPct(em.openRate)}\n`;
            text += `🖱️ Clicks: ${this.fmtPct(em.clickRate)} · CTOR: ${this.fmtPct(em.clickToOpenRate)}\n`;
            if (em.emailRevenue > 0) {
                text += `💰 Revenue: ${this.fmtCurrency(em.emailRevenue, cur)}\n`;
            }
            text += `\n`;
        }

        // ── ECOMMERCE ──
        const hasEcom = !!channelData.ecommerce && channelData.ecommerce.orders > 0;

        if (hasEcom) {
            const e = channelData.ecommerce!;
            text += `━━━ *ECOMMERCE* ━━━\n\n`;
            const totalCustomers = (e.newCustomers || 0) + (e.returningCustomers || 0);
            text += `💰 Ventas: ${this.fmtCurrency(e.revenue, cur)}\n`;
            text += `📦 ${this.fmtNum(e.orders)} ordenes · 🧾 Ticket: ${this.fmtCurrency(e.avgOrderValue, cur)}\n`;
            if (totalCustomers > 0) {
                text += `👥 ${this.fmtNum(totalCustomers)} clientes`;
                if ((e.newCustomers || 0) > 0 || (e.returningCustomers || 0) > 0) {
                    text += ` (${this.fmtNum(e.newCustomers || 0)} nuevos · ${this.fmtNum(e.returningCustomers || 0)} recurrentes)`;
                }
                text += `\n`;
            }
            if (e.refunds && e.refunds > 0 && (e.totalRefundAmount || 0) > 0) {
                text += `↩️ Reembolsos: ${this.fmtNum(e.refunds)} (${this.fmtCurrency(e.totalRefundAmount || 0, cur)})\n`;
            }
            text += `\n`;
        }

        // ── RESUMEN ──
        const totalAdsSpend = (channelData.meta?.spend || 0) + (channelData.google?.spend || 0);

        if (hasEcom && (hasMeta || hasGoogle)) {
            const ecomRevenue = channelData.ecommerce!.revenue;
            const blendedRoas = totalAdsSpend > 0 ? ecomRevenue / totalAdsSpend : 0;

            text += `━━━ *RESUMEN* ━━━\n\n`;
            text += `💵 Revenue real (ecommerce): ${this.fmtCurrency(ecomRevenue, cur)}\n`;
            text += `💸 Inversión total (ads): ${this.fmtCurrency(totalAdsSpend, cur)}\n`;
            text += `📊 Blended ROAS: ${blendedRoas.toFixed(2)}x\n`;
        } else if ((hasMeta || hasGoogle) && !hasEcom) {
            const platformRevenue = (channelData.meta?.revenue || 0) + (channelData.google?.revenue || 0);
            if (platformRevenue > 0) {
                text += `━━━ *RESUMEN* ━━━\n\n`;
                text += `💵 Revenue (reportado por plataforma): ${this.fmtCurrency(platformRevenue, cur)}\n`;
                text += `💸 Inversión total: ${this.fmtCurrency(totalAdsSpend, cur)}\n`;
                text += `_⚠️ Sin ecommerce conectado. Revenue es atribución de plataforma._\n`;
            }
        }

        text += `\n_🤖 Generado por Worker Brain_`;

        const blocks: any[] = [
            { type: "section", text: { type: "mrkdwn", text } },
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `<https://ai-analyzer-dusky-phi.vercel.app/dashboard?clientId=${clientId}|📊 Dashboard> · <https://ai-analyzer-dusky-phi.vercel.app/ecommerce?clientId=${clientId}|🛒 Ecommerce> · <https://ai-analyzer-dusky-phi.vercel.app/google-ads?clientId=${clientId}|📈 Google Ads>`
                }]
            }
        ];

        // Bypass master switch — daily briefing should always be sent
        await this.postMessage(botToken, webhook, channel, blocks, `Resumen diario de ${clientName}`, { bypassMasterSwitch: true });
    }

    // ═════════════════════════════════════════════════════════
    //  2. CRITICAL ALERT — Alerta individual inmediata
    // ═════════════════════════════════════════════════════════

    static async sendCriticalAlert(clientId: string, clientName: string, alert: Alert) {
        // Global Check
        const sysSettings = await SystemSettingsService.getSettings();
        if (!sysSettings.enabledAlertTypes.includes(alert.type)) {
            console.log(`[SlackService] Alert Type ${alert.type} is GLOBALLY DISABLED. Skipping delivery.`);
            return;
        }

        const { channel, botToken, webhook } = await this.resolveChannel(clientId);

        if (!botToken && !webhook) return;

        const severityEmoji = alert.severity === "CRITICAL" ? "🚨" : alert.severity === "WARNING" ? "⚠️" : "ℹ️";
        const typeEmoji: Record<string, string> = {
            SCALING_OPPORTUNITY: "🟢",
            CPA_SPIKE: "🔴",
            BUDGET_BLEED: "🩸",
            ROTATE_CONCEPT: "🔥",
            CONSOLIDATE: "🧩",
            KILL_RETRY: "💀",
            UNDERFUNDED_WINNER: "🌟",
            LEARNING_RESET_RISK: "🟡",
            CPA_VOLATILITY: "📊"
        };

        const blocks: any[] = [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `${severityEmoji} Alerta ${alert.severity} — ${clientName}`,
                    emoji: true
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `${typeEmoji[alert.type] || "📌"} *${alert.title}*\n${alert.description}`
                }
            }
        ];

        if (alert.evidence && alert.evidence.length > 0) {
            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `📊 *Evidencia:*\n${alert.evidence.map(e => `• ${e}`).join("\n")}`
                }
            });
        }

        blocks.push(
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*Impacto:* ${alert.impactScore}/100` },
                    { type: "mrkdwn", text: `*Nivel:* ${alert.level}` }
                ]
            },
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `<https://ai-analyzer.vercel.app/ads-manager?clientId=${clientId}|Ver en AI Analyzer →>`
                }]
            }
        );

        await this.postMessage(botToken, webhook, channel, blocks, `Alerta ${alert.severity}: ${alert.title}`);
    }

    // ═════════════════════════════════════════════════════════
    //  3. DIGEST — Resumen de alertas agrupadas (existente, mejorado)
    // ═════════════════════════════════════════════════════════

    static async sendDigest(clientId: string, clientName: string, alerts: Alert[]) {
        const { channel, botToken, webhook } = await this.resolveChannel(clientId);

        if (!botToken && !webhook) {
            console.warn("Neither SLACK_BOT_TOKEN nor SLACK_WEBHOOK_URL configured");
            return;
        }

        if (alerts.length === 0) return;

        // Group by type
        const grouped = alerts.reduce((acc, a) => {
            if (!acc[a.type]) acc[a.type] = [];
            acc[a.type].push(a);
            return acc;
        }, {} as Record<string, Alert[]>);

        // Calculate Date Range for analysis (last 7 days from most recent alert)
        const latestAlertDate = alerts.length > 0
            ? new Date(Math.max(...alerts.map(a => new Date(a.createdAt).getTime())))
            : new Date();

        const startAnalysis = new Date(latestAlertDate);
        startAnalysis.setDate(startAnalysis.getDate() - 7);

        const formatDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
        const dateRangeStr = `(${formatDate(startAnalysis)} al ${formatDate(latestAlertDate)})`;

        const blocks: any[] = [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `🚀 AI Analyzer Digest: ${clientName}`,
                    emoji: true
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `He analizado tus campañas entre el *${formatDate(startAnalysis)}* y el *${formatDate(latestAlertDate)}*. Aquí están las acciones recomendadas para hoy:`
                }
            }
        ];

        // Top 3 by Impact Score
        const topImpact = [...alerts].sort((a, b) => b.impactScore - a.impactScore).slice(0, 3);
        if (topImpact.length > 0) {
            blocks.push({
                type: "section",
                text: { type: "mrkdwn", text: `*🚨 PRIORIDADES CRÍTICAS*` }
            });

            topImpact.forEach(item => {
                const evidenceText = item.evidence?.length > 0
                    ? item.evidence.join(" | ")
                    : "Consultar dashboard";

                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `• *${item.title}*\n  📊 _Evidencia:_ ${evidenceText}\n  ✅ _Acción:_ ${item.description}`
                    }
                });
            });

            blocks.push({ type: "divider" });
        }

        const emojis: Record<string, string> = {
            SCALING_OPPORTUNITY: "🟢 SCALE",
            CPA_SPIKE: "🔴 CPA SPIKE",
            BUDGET_BLEED: "🩸 BUDGET BLEED",
            ROTATE_CONCEPT: "🔥 ROTATE",
            CONSOLIDATE: "🧩 CONSOLIDATE",
            INTRODUCE_BOFU_VARIANTS: "💡 UPSELL",
            KILL_RETRY: "💀 KILL",
            UNDERFUNDED_WINNER: "🌟 WINNER",
            LEARNING_RESET_RISK: "🟡 RESET RISK",
            CPA_VOLATILITY: "📊 VOLATILITY"
        };

        const decisionOrder = [
            "SCALING_OPPORTUNITY", "CPA_SPIKE", "BUDGET_BLEED",
            "ROTATE_CONCEPT", "CONSOLIDATE", "INTRODUCE_BOFU_VARIANTS",
            "KILL_RETRY", "UNDERFUNDED_WINNER", "LEARNING_RESET_RISK", "CPA_VOLATILITY"
        ];

        const categoryExplanations: Record<string, string> = {
            SCALING_OPPORTUNITY: "_CPA por debajo del objetivo y volumen estable. Oportunidad de invertir más._",
            CPA_SPIKE: "_El coste por resultado subió bruscamente vs la semana anterior._",
            BUDGET_BLEED: "_Gasto acumulado sin conversiones. Detener o revisar creativos._",
            ROTATE_CONCEPT: "_Frecuencia alta con caída en CTR/Hook Rate. El público ya se cansó de este anuncio._",
            CONSOLIDATE: "_Muchos conjuntos de anuncios compitiendo entre sí. Sugerimos agrupar._",
            KILL_RETRY: "_Anuncios que no lograron traccionar después de un gasto significativo._",
            CPA_VOLATILITY: "_Inestabilidad en los resultados causada por cambios bruscos de presupuesto._",
            UNDERFUNDED_WINNER: "_Anuncios con excelente ROAS pero poco presupuesto asignado._"
        };

        for (const type of decisionOrder) {
            const items = grouped[type]?.filter(a => !topImpact.find(ti => ti.id === a.id));
            if (items && items.length > 0) {
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${emojis[type] || type} (${items.length})* ${dateRangeStr}\n${categoryExplanations[type] || ""}`
                    }
                });

                items.slice(0, 5).forEach(item => {
                    const briefEvidence = item.evidence?.[0] ? ` (${item.evidence[0]})` : "";
                    blocks.push({
                        type: "section",
                        text: { type: "mrkdwn", text: `• ${item.title}${briefEvidence}` }
                    });
                });
            }
        }

        blocks.push(
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `<https://ai-analyzer.vercel.app/decision-board?clientId=${clientId}|Ver Decision Board> · <https://ai-analyzer.vercel.app/ads-manager?clientId=${clientId}|Ver Ads Manager>`
                }]
            }
        );

        await this.postMessage(botToken, webhook, channel, blocks, `Digest para ${clientName}`);
    }

    // ═════════════════════════════════════════════════════════
    //  4. WEEKLY SUMMARY — Resumen semanal comparativo
    // ═════════════════════════════════════════════════════════

    static async sendWeeklySummary(clientId: string, clientName: string, kpis: {
        spend: number, spendDelta: number,
        cpa: number, cpaDelta: number,
        roas: number, roasDelta: number,
        purchases: number, purchasesDelta: number,
        metricName?: string
    }) {
        const { client, channel, botToken, webhook } = await this.resolveChannel(clientId);

        if (!botToken && !webhook) return;

        const businessType = client?.businessType || "ecommerce";
        const objective = businessTypeToObjective(businessType);
        const primaryMetric = getPrimaryMetric(objective);
        const showRoas = isRoasRelevant(objective);
        const showCpa = isCpaRelevant(objective);

        // Build fields dynamically based on objective
        const fields: any[] = [
            { type: "mrkdwn", text: `*Gasto 7d:*\n${this.fmtCurrency(kpis.spend)} (${this.fmtDelta(kpis.spendDelta)})` },
        ];

        if (showCpa) {
            fields.push({ type: "mrkdwn", text: `*CPA 7d:*\n${this.fmtCurrency(kpis.cpa)} (${this.fmtDelta(kpis.cpaDelta * -1)})` });
        }

        if (showRoas) {
            fields.push({ type: "mrkdwn", text: `*ROAS 7d:*\n${kpis.roas ? kpis.roas.toFixed(2) : '0'}x (${this.fmtDelta(kpis.roasDelta)})` });
        }

        fields.push({ type: "mrkdwn", text: `*${kpis.metricName || primaryMetric.labelEs}:*\n${kpis.purchases} (${this.fmtDelta(kpis.purchasesDelta)})` });

        const blocks = [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `📊 Resumen Semanal: ${clientName}`,
                    emoji: true
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Comparación de rendimiento acumulado 7d vs. la semana anterior:`
                }
            },
            {
                type: "section",
                fields
            },
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `_Generado automáticamente por AI Analyzer_ · <https://ai-analyzer.vercel.app/dashboard?clientId=${clientId}|Ver Dashboard>`
                }]
            }
        ];

        await this.postMessage(botToken, webhook, channel, blocks, `Resumen Semanal para ${clientName}`);
    }

    // ═════════════════════════════════════════════════════════
    //  6. ACCOUNT HEALTH ALERT — Estado de cuenta Meta
    // ═════════════════════════════════════════════════════════

    static async sendAccountHealthAlert(
        clientId: string,
        clientName: string,
        alertType: string,
        severity: "info" | "warning" | "critical",
        message: string,
        health: AccountHealth
    ) {
        const { client, channel, botToken, webhook } = await this.resolveChannel(clientId);

        if (!botToken && !webhook) return;

        const isDisabled = alertType === "ACCOUNT_DISABLED";
        const isReactivated = alertType === "ACCOUNT_REACTIVATED";
        const isSpendCap = alertType.startsWith("SPEND_CAP_");
        const isNoBalance = alertType === "ACCOUNT_NO_BALANCE";

        const emoji = isNoBalance ? "🚨" : isDisabled ? "🚫" : isReactivated ? "✅" : isSpendCap ? "💸" : "⚠️";
        const color = severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🟢";

        let text = `${emoji} *Account Health — ${clientName}*\n\n`;
        text += `${color} ${message}\n\n`;

        text += `📋 *Estado actual:* ${health.accountStatusName}\n`;
        text += `🆔 *Cuenta:* \`${health.metaAccountId}\`\n`;

        if (health.spendCap && health.amountSpent !== undefined) {
            text += `\n💰 *Spend Cap:*\n`;
            text += `• Gastado: $${this.fmtNum(health.amountSpent)} / $${this.fmtNum(health.spendCap)} (${health.spendCapPct?.toFixed(1)}%)\n`;
            if (health.projectedCutoffDays !== undefined) {
                text += `• Días restantes (estimado): ~${health.projectedCutoffDays}\n`;
            }
            if (health.avgDailySpend7d) {
                text += `• Gasto diario promedio (7d): ${this.fmtCurrency(health.avgDailySpend7d)}\n`;
            }
        }

        if (health.balance !== undefined) {
            text += `\n💳 *Balance:* ${this.fmtCurrency(health.balance)}\n`;
        }

        const blocks: any[] = [
            { type: "section", text: { type: "mrkdwn", text } },
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `_Account Health Monitor_ · <https://ai-analyzer.vercel.app/admin/system|Ver Sistema>`
                }]
            }
        ];

        const fallbackText = `Account Health: ${clientName} — ${alertType}`;

        // Send to internal channel — ALWAYS bypass master switch for health alerts
        if (channel) {
            await this.postMessage(botToken, webhook, channel, blocks, fallbackText, { bypassMasterSwitch: true });
        }

        // Also send to public client channel (if configured and different from internal)
        const publicChannel = client?.slackPublicChannel || null;
        if (publicChannel && publicChannel !== channel) {
            await this.postMessage(botToken, webhook, publicChannel, blocks, fallbackText, { bypassMasterSwitch: true });
        }
    }

    // ═════════════════════════════════════════════════════════
    //  BUILD SNAPSHOT KPIs from Rolling Metrics
    // ═════════════════════════════════════════════════════════

    static buildSnapshotFromRolling(rolling: EntityRollingMetrics): DailySnapshotKPIs {
        const r = rolling.rolling;
        const spend = r.spend_7d || 0;
        const clicks = r.clicks_7d || 0;
        const purchases = r.purchases_7d || 0;

        return {
            spend,
            clicks,
            cpc: clicks > 0 ? spend / clicks : 0,
            ctr: r.ctr_7d || 0,
            impressions: r.impressions_7d || 0,
            purchases,
            purchaseValue: (r.roas_7d || 0) * spend,
            costPerPurchase: r.cpa_7d || 0,
            roas: r.roas_7d || 0,
            addToCart: 0,
            addToCartValue: 0,
            costPerAddToCart: 0,
            checkout: 0,
            checkoutValue: 0,
            costPerCheckout: 0,
            leads: 0,
            costPerLead: 0,
            whatsapp: 0,
            costPerWhatsapp: 0
        };
    }

    static buildSnapshotFromDailyAggregation(
        snapshots: Array<{ performance: any }>,
        spend: number
    ): DailySnapshotKPIs {
        let totalClicks = 0, totalImpressions = 0;
        let totalPurchases = 0, totalRevenue = 0;
        let totalATC = 0, totalCheckout = 0;
        let totalLeads = 0, totalWhatsapp = 0, totalApps = 0;

        for (const snap of snapshots) {
            const p = snap.performance;
            totalClicks += p.clicks || 0;
            totalImpressions += p.impressions || 0;
            totalPurchases += p.purchases || 0;
            totalRevenue += p.revenue || 0;
            totalATC += p.addToCart || 0;
            totalCheckout += p.checkout || 0;
            totalLeads += p.leads || 0;
            totalWhatsapp += p.whatsapp || 0;
            totalApps += (p as any).installs || 0;
        }

        return {
            spend,
            clicks: totalClicks,
            cpc: totalClicks > 0 ? spend / totalClicks : 0,
            ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            impressions: totalImpressions,
            purchases: totalPurchases,
            purchaseValue: totalRevenue,
            costPerPurchase: totalPurchases > 0 ? spend / totalPurchases : 0,
            roas: spend > 0 ? totalRevenue / spend : 0,
            addToCart: totalATC,
            addToCartValue: 0,
            costPerAddToCart: totalATC > 0 ? spend / totalATC : 0,
            checkout: totalCheckout,
            checkoutValue: 0,
            costPerCheckout: totalCheckout > 0 ? spend / totalCheckout : 0,
            leads: totalLeads,
            costPerLead: totalLeads > 0 ? spend / totalLeads : 0,
            whatsapp: totalWhatsapp,
            costPerWhatsapp: totalWhatsapp > 0 ? spend / totalWhatsapp : 0,
            installs: totalApps,
            costPerInstall: totalApps > 0 ? spend / totalApps : 0,
        } as any;
    }

    // ═════════════════════════════════════════════════════════
    //  7. SEMÁFORO DIGEST — Traffic light summary for daily digest
    // ═════════════════════════════════════════════════════════

    static async sendSemaforoDigest(clientId: string, clientName: string, snapshot: SemaforoSnapshot) {
        const { channel, botToken, webhook } = await this.resolveChannel(clientId);
        if (!botToken && !webhook) return;

        const statusEmoji: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴' };
        const qRef = snapshot.quarterRef.replace('_', ' ');
        const daysRemaining = snapshot.quarterProgress.daysTotal - snapshot.quarterProgress.daysElapsed;
        const weekLabel = `Semana ${snapshot.quarterProgress.currentWeek}/${snapshot.quarterProgress.weeksTotal}`;

        let text = `🚦 *SEMÁFORO ${qRef}* — ${weekLabel}\n`;
        text += `${statusEmoji[snapshot.general.status]} Estado general: *${snapshot.general.score}/100*  ·  ${daysRemaining} días restantes\n\n`;

        // Per-metric lines
        const metricEntries = Object.values(snapshot.metrics);
        for (const m of metricEntries) {
            const emoji = statusEmoji[m.status] || '⚪';
            const pctLabel = m.isInverse
                ? `${this.fmtNum(m.current)} vs objetivo ${this.fmtNum(m.target)}`
                : `${this.fmtNum(m.current)} / ${this.fmtNum(m.target)} (${m.pctAchieved.toFixed(0)}%)`;

            text += `${emoji} *${m.metric}*: ${pctLabel}`;

            // If behind pace, show required weekly rate
            if (m.status !== 'green' && !m.isInverse) {
                text += ` — requiere ${this.fmtNum(m.requiredWeeklyRate)}/sem, actual ${this.fmtNum(m.weeklyRate)}/sem`;
            }
            text += '\n';
        }

        text += `\n_${snapshot.general.summary}_`;

        const blocks: any[] = [
            { type: "section", text: { type: "mrkdwn", text } },
            { type: "divider" },
            {
                type: "context",
                elements: [{
                    type: "mrkdwn",
                    text: `<https://ai-analyzer.vercel.app/semaforo|🚦 Ver Semáforo> · <https://ai-analyzer.vercel.app/overview|📊 Overview>`
                }]
            }
        ];

        await this.postMessage(botToken, webhook, channel, blocks, `Semáforo ${qRef} — ${clientName}`);
    }

    // ═════════════════════════════════════════════════════════
    //  BUILD SNAPSHOT KPIs from Rolling Metrics
    // ═════════════════════════════════════════════════════════

    static buildSnapshotFromClientSnapshot(accountSummary: {
        rolling: EntityRollingMetrics["rolling"];
        mtd: MTDAggregation | null;
    }): DailySnapshotKPIs {
        const r = accountSummary.rolling;
        const mtd = accountSummary.mtd;

        if (mtd && mtd.spend > 0) {
            const spend = mtd.spend;
            return {
                spend,
                clicks: mtd.clicks,
                cpc: mtd.clicks > 0 ? spend / mtd.clicks : 0,
                ctr: mtd.impressions > 0 ? (mtd.clicks / mtd.impressions) * 100 : 0,
                impressions: mtd.impressions,
                purchases: mtd.purchases,
                purchaseValue: mtd.revenue,
                costPerPurchase: mtd.purchases > 0 ? spend / mtd.purchases : 0,
                roas: spend > 0 ? mtd.revenue / spend : 0,
                addToCart: mtd.addToCart,
                addToCartValue: 0,
                costPerAddToCart: mtd.addToCart > 0 ? spend / mtd.addToCart : 0,
                checkout: mtd.checkout,
                checkoutValue: 0,
                costPerCheckout: mtd.checkout > 0 ? spend / mtd.checkout : 0,
                leads: mtd.leads,
                costPerLead: mtd.leads > 0 ? spend / mtd.leads : 0,
                whatsapp: mtd.whatsapp,
                costPerWhatsapp: mtd.whatsapp > 0 ? spend / mtd.whatsapp : 0
            };
        }

        const spend = r.spend_7d || 0;
        const clicks = r.clicks_7d || 0;
        const purchases = r.purchases_7d || 0;

        return {
            spend,
            clicks,
            cpc: clicks > 0 ? spend / clicks : 0,
            ctr: r.ctr_7d || 0,
            impressions: r.impressions_7d || 0,
            purchases,
            purchaseValue: (r.roas_7d || 0) * spend,
            costPerPurchase: r.cpa_7d || 0,
            roas: r.roas_7d || 0,
            addToCart: 0,
            addToCartValue: 0,
            costPerAddToCart: 0,
            checkout: 0,
            checkoutValue: 0,
            costPerCheckout: 0,
            leads: 0,
            costPerLead: 0,
            whatsapp: 0,
            costPerWhatsapp: 0
        };
    }
}
