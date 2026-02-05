import { Client } from "@/types";

export interface ParsedRow {
    raw: Record<string, string>;
    client: Partial<Client>;
    status: "new" | "update" | "error";
    error?: string;
}

const HEADER_MAP: Record<string, keyof Client | string> = {
    "Nombre": "name",
    "Canal de Slack publico": "slackPublicChannel",
    "Canal de Slack Interno": "slackInternalChannel",
    "Cuenta de FB": "metaAdAccountId",
    "activo": "active",
    "ecommerce": "isEcommerce",
    "google": "isGoogle",
    "Google Ads Account": "googleAdsId"
};

export function parseImportData(text: string, existingClients: Client[]): ParsedRow[] {
    if (!text.trim()) return [];

    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    // Detect delimiter (tab or comma)
    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(delimiter).map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim());
        const raw: Record<string, string> = {};
        const clientData: any = {};

        headers.forEach((header, index) => {
            const value = values[index] || "";
            raw[header] = value;

            const targetKey = HEADER_MAP[header];
            if (targetKey) {
                if (targetKey === "active" || targetKey === "isEcommerce" || targetKey === "isGoogle") {
                    clientData[targetKey] = value.toLowerCase() === "yes" || value.toLowerCase() === "true";
                } else {
                    clientData[targetKey] = value;
                }
            }
        });

        // Validation
        let error = "";
        if (!clientData.name) {
            error = "Missing client name.";
        } else if (clientData.active && !clientData.metaAdAccountId) {
            error = "Active clients require a Meta Ad Account ID.";
        }

        // Determine status
        const slug = clientData.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const existing = existingClients.find(c => c.slug === slug || c.name === clientData.name);
        const status = error ? "error" : (existing ? "update" : "new");

        return {
            raw,
            client: { ...clientData, slug },
            status,
            error
        };
    });
}
