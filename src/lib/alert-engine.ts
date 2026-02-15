import { db } from "@/lib/firebase-admin";
import { EntityClassification, FinalDecision } from "@/types/classifications";

export interface Alert {
    id: string;
    clientId: string;
    level: string;
    entityId: string;
    type: FinalDecision;
    severity: "CRITICAL" | "WARNING" | "INFO";
    title: string;
    description: string;
    impactScore: number;
    evidence: string[];
    createdAt: string;
}

export class AlertEngine {
    static async run(clientId: string) {
        const alerts: Alert[] = [];

        // 1. Fetch Classifications (Decisions)
        const classSnap = await db.collection("entity_classifications")
            .where("clientId", "==", clientId)
            .get();

        const classifications = classSnap.docs.map(d => d.data() as EntityClassification);

        // 2. Map Decisions to Alerts
        for (const c of classifications) {
            if (c.finalDecision === "HOLD") continue;

            let severity: Alert["severity"] = "INFO";
            let title = "";
            let description = "";

            switch (c.finalDecision) {
                case "SCALE":
                    severity = "INFO";
                    title = `Oportunidad de Escala: ${c.entityId}`;
                    description = `Rendimiento sólido en fase de explotación. Considera aumentar presupuesto un 20%.`;
                    break;
                case "ROTATE_CONCEPT":
                    severity = "CRITICAL";
                    title = `Rotación Requerida: ${c.entityId}`;
                    description = `Fatiga detectada (${c.fatigueState}). El rendimiento está cayendo debido a saturación.`;
                    break;
                case "CONSOLIDATE":
                    severity = "WARNING";
                    title = `Estructura Fragmentada`;
                    description = `Demasiados adsets activos para el volumen de conversiones. Riesgo de aprendizaje ineficiente.`;
                    break;
                case "INTRODUCE_BOFU_VARIANTS":
                    severity = "INFO";
                    title = `Refuerzo BOFU: ${c.entityId}`;
                    description = `Entidad en MOFU con buen engagement. Introduce variantes de cierre (oferta, escasez).`;
                    break;
                case "KILL_RETRY":
                    severity = "WARNING";
                    title = `Gasto sin Señales: ${c.entityId}`;
                    description = `Fase de exploración fallida. Mucho gasto sin conversiones registradas.`;
                    break;
            }

            if (title) {
                alerts.push({
                    id: `${c.finalDecision}_${c.entityId}_${Date.now()}`,
                    clientId,
                    level: c.level,
                    entityId: c.entityId,
                    type: c.finalDecision,
                    severity,
                    title,
                    description,
                    impactScore: c.impactScore,
                    evidence: c.evidence,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // Save alerts to Firestore
        const batch = db.batch();
        for (const alert of alerts) {
            const docRef = db.collection("alerts").doc(alert.id);
            batch.set(docRef, alert);
        }
        await batch.commit();

        return alerts;
    }
}
