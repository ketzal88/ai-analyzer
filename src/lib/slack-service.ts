import { db } from "@/lib/firebase-admin";
import { Alert } from "./alert-engine";
import { Client } from "@/types";

export class SlackService {
    static async sendDigest(clientId: string, clientName: string, alerts: Alert[]) {
        const botToken = process.env.SLACK_BOT_TOKEN;
        const globalWebhook = process.env.SLACK_WEBHOOK_URL;

        if (!botToken && !globalWebhook) {
            console.warn("Neither SLACK_BOT_TOKEN nor SLACK_WEBHOOK_URL configured");
            return;
        }

        if (alerts.length === 0) return;

        // Fetch client to get specific channel
        const clientDoc = await db.collection("clients").doc(clientId).get();
        const clientData = clientDoc.data() as Client;

        // Grouping by Decision Type
        const grouped = alerts.reduce((acc, a) => {
            if (!acc[a.type]) acc[a.type] = [];
            acc[a.type].push(a);
            return acc;
        }, {} as Record<string, Alert[]>);

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
                    text: `He analizado tus campañas. Aquí están las acciones recomendadas para hoy:`
                }
            }
        ];

        // Top 3 by Impact Score (overall)
        const topImpact = [...alerts].sort((a, b) => b.impactScore - a.impactScore).slice(0, 3);
        if (topImpact.length > 0) {
            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*🚨 PRIORIDADES CRÍTICAS*`
                }
            });

            topImpact.forEach(item => {
                const evidenceLine = item.evidence?.[0] || "Consultar dashboard";
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `• *${item.title}*\n  📊 _Evidencia:_ ${evidenceLine}\n  ✅ _Acción:_ ${item.description}`
                    }
                });
            });

            blocks.push({ type: "divider" });
        }

        const decisionOrder = ["SCALING_OPPORTUNITY", "CPA_SPIKE", "BUDGET_BLEED", "ROTATE_CONCEPT", "CONSOLIDATE", "INTRODUCE_BOFU_VARIANTS", "KILL_RETRY"];
        const emojis: Record<string, string> = {
            SCALING_OPPORTUNITY: "🟢 SCALE",
            CPA_SPIKE: "🔴 CPA SPIKE",
            BUDGET_BLEED: "🩸 BUDGET BLEED",
            ROTATE_CONCEPT: "🔥 ROTATE",
            CONSOLIDATE: "🧩 CONSOLIDATE",
            INTRODUCE_BOFU_VARIANTS: "💡 UPSELL",
            KILL_RETRY: "💀 KILL",
            UNDERFUNDED_WINNER: "🌟 WINNER"
        };

        for (const type of decisionOrder) {
            const items = grouped[type]?.filter(a => !topImpact.find(ti => ti.id === a.id));
            if (items && items.length > 0) {
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${emojis[type] || type} (${items.length})*`
                    }
                });

                items.slice(0, 3).forEach(item => {
                    blocks.push({
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `• ${item.title}`
                        }
                    });
                });
            }
        }

        blocks.push({
            type: "divider"
        }, {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `Ver matriz completa: <https://ai-analyzer.vercel.app/diagnostic?clientId=${clientId}|Abrir Diagnostic Platform>`
                }
            ]
        });

        try {
            const targetChannel = clientData?.slackPublicChannel || clientData?.slackInternalChannel;
            if (botToken && targetChannel) {
                // Slack Web API
                await fetch("https://slack.com/api/chat.postMessage", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${botToken}`
                    },
                    body: JSON.stringify({
                        channel: targetChannel,
                        blocks,
                        text: `Digest para ${clientName}`
                    })
                });
            } else if (globalWebhook) {
                // Legacy Webhook
                await fetch(globalWebhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ blocks })
                });
            }
        } catch (e) {
            console.error("Error sending Slack notification:", e);
        }
    }

    static async sendWeeklySummary(clientId: string, clientName: string, kpis: {
        spend: number, spendDelta: number,
        cpa: number, cpaDelta: number,
        roas: number, roasDelta: number,
        purchases: number, purchasesDelta: number
    }) {
        const botToken = process.env.SLACK_BOT_TOKEN;
        const globalWebhook = process.env.SLACK_WEBHOOK_URL;

        if (!botToken && !globalWebhook) return;

        const clientDoc = await db.collection("clients").doc(clientId).get();
        const clientData = clientDoc.data() as Client;
        const targetChannel = clientData?.slackPublicChannel || clientData?.slackInternalChannel;

        const formatDelta = (val: number) => {
            const emoji = val > 0 ? "📈" : val < 0 ? "📉" : "➖";
            return `${emoji} ${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
        };

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
                    text: `Aquí tienes la comparación de rendimiento acumulado 7d vs. la semana anterior:`
                }
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*Gasto 7d:*\n$${kpis.spend.toLocaleString()} (${formatDelta(kpis.spendDelta)})` },
                    { type: "mrkdwn", text: `*CPA 7d:*\n$${kpis.cpa.toFixed(2)} (${formatDelta(kpis.cpaDelta * -1)})` }, // Inverse because lower CPA is better
                    { type: "mrkdwn", text: `*ROAS 7d:*\n${kpis.roas ? kpis.roas.toFixed(2) : '0'}x (${formatDelta(kpis.roasDelta)})` },
                    { type: "mrkdwn", text: `*Compras:*\n${kpis.purchases} (${formatDelta(kpis.purchasesDelta)})` }
                ]
            },
            {
                type: "divider"
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `_Este resumen se genera automáticamente comparando períodos rodantes de 7 días._`
                }
            }
        ];

        try {
            if (botToken && targetChannel) {
                await fetch("https://slack.com/api/chat.postMessage", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${botToken}`
                    },
                    body: JSON.stringify({
                        channel: targetChannel,
                        blocks,
                        text: `Resumen Semanal para ${clientName}`
                    })
                });
            } else if (globalWebhook) {
                await fetch(globalWebhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ blocks })
                });
            }
        } catch (e) {
            console.error("Error sending Slack weekly summary:", e);
        }
    }
}
