import { db } from "./firebase-admin";
import { EngineConfig, getDefaultEngineConfig } from "@/types/engine-config";

export class EngineConfigService {
    static async getEngineConfig(clientId: string): Promise<EngineConfig> {
        const doc = await db.collection("engine_configs").doc(clientId).get();

        if (!doc.exists) {
            return getDefaultEngineConfig(clientId);
        }

        const data = doc.data() as Partial<EngineConfig>;
        const defaults = getDefaultEngineConfig(clientId);

        // Deep merge logic (simplified for these flat groups)
        return {
            ...defaults,
            ...data,
            fatigue: { ...defaults.fatigue, ...data.fatigue },
            structure: { ...defaults.structure, ...data.structure },
            alerts: { ...defaults.alerts, ...data.alerts },
            findings: { ...defaults.findings, ...data.findings },
            updatedAt: data.updatedAt || defaults.updatedAt
        };
    }

    static async saveEngineConfig(clientId: string, config: Partial<EngineConfig>): Promise<void> {
        await db.collection("engine_configs").doc(clientId).set({
            ...config,
            clientId,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }
}
