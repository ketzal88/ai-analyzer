import { Alert } from "./alert-engine";

export class SlackService {
    static async sendDigest(clientId: string, clientName: string, alerts: Alert[]) {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (!webhookUrl) {
            console.warn("SLACK_WEBHOOK_URL not configured");
            return;
        }

        if (alerts.length === 0) return;

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
                    text: `🚀 GEM Decision Digest: ${clientName}`,
                    emoji: true
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `He procesado el motor probabilístico para hoy. Aquí están las acciones recomendadas:`
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
                    text: `*🚨 TOP PRIORIDADES (By Impact Score)*`
                }
            });

            topImpact.forEach(item => {
                const evidenceLine = item.evidence?.[0] || "Evidence: Check dashboard";
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

        const decisionOrder = ["SCALE", "ROTATE_CONCEPT", "CONSOLIDATE", "INTRODUCE_BOFU_VARIANTS", "KILL_RETRY"];
        const emojis: Record<string, string> = {
            SCALE: "🚀 SCALE",
            ROTATE_CONCEPT: "🔥 ROTATE",
            CONSOLIDATE: "🧩 CONSOLIDATE",
            INTRODUCE_BOFU_VARIANTS: "💡 UPSELL/BOFU",
            KILL_RETRY: "💀 KILL/RETRY",
            HOLD: "🟡 HOLD"
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

                // List items
                items.slice(0, 3).forEach(item => {
                    blocks.push({
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `• ${item.title}`
                        }
                    });
                });

                if (items.length > 3) {
                    blocks.push({
                        type: "context",
                        elements: [{ type: "mrkdwn", text: `...y ${items.length - 3} más.` }]
                    });
                }
            }
        }

        blocks.push({
            type: "divider"
        }, {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "Ver matriz de decisión completa: <https://ai-analyzer.vercel.app/diagnostic|Abrir Diagnostic Panel>"
                }
            ]
        });

        try {
            await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blocks })
            });
        } catch (e) {
            console.error("Error sending Slack notification:", e);
        }
    }
}
