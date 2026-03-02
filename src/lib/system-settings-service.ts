import { db } from "./firebase-admin";

export interface SystemSettings {
    alertsEnabled: boolean;
    enabledAlertTypes: string[];
    updatedAt: string;
}

const DEFAULT_ALERT_TYPES = [
    "SCALING_OPPORTUNITY",
    "LEARNING_RESET_RISK",
    "CPA_SPIKE",
    "BUDGET_BLEED",
    "UNDERFUNDED_WINNER",
    "CPA_VOLATILITY",
    "ROTATE_CONCEPT",
    "CONSOLIDATE",
    "KILL_RETRY",
    "INTRODUCE_BOFU_VARIANTS",
    "DAILY_SNAPSHOT"
];

const DEFAULT_SETTINGS: SystemSettings = {
    alertsEnabled: true,
    enabledAlertTypes: DEFAULT_ALERT_TYPES,
    updatedAt: new Date().toISOString()
};

export class SystemSettingsService {
    static async getSettings(): Promise<SystemSettings> {
        try {
            const doc = await db.collection("system_config").doc("main").get();
            if (!doc.exists) {
                // Initialize with defaults if it doesn't exist
                await this.updateSettings(DEFAULT_SETTINGS);
                return DEFAULT_SETTINGS;
            }
            return { ...DEFAULT_SETTINGS, ...doc.data() } as SystemSettings;
        } catch (err) {
            console.error("Error fetching system settings:", err);
            return DEFAULT_SETTINGS;
        }
    }

    static async updateSettings(settings: Partial<SystemSettings>): Promise<void> {
        try {
            await db.collection("system_config").doc("main").set({
                ...settings,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Error updating system settings:", err);
            throw err;
        }
    }
}
