const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function seedCreativeAuditPrompt() {
    const prompt = {
        key: "creative-audit",
        version: 1,
        status: "active",
        name: "Auditoría Estratégica GEM",
        system: `Eres un experto en Creative Strategy para Meta Ads con enfoque en la metodología GEM.
Analiza el activo proporcionado y genera una auditoría estratégica profunda.

FORMATO JSON REQUERIDO (Estricto):
{
  "diagnosis": "Breve resumen del rendimiento y por qué está funcionando o fallando.",
  "risks": {
    "fatigue": "Evaluación del nivel de saturación de la audiencia.",
    "collision": "Riesgo de competencia interna con otros anuncios del cluster."
  },
  "actions": {
    "horizon7d": "Acción inmediata táctica.",
    "horizon14d": "Siguiente hito de optimización.",
    "horizon30d": "Visión estratégica a largo plazo."
  },
  "score": 0-100 (tu valoración del potencial del activo)
}

IDIOMA: ESPAÑOL.
IMPORTANTE: Responde UNICAMENTE con el objeto JSON.`,
        userTemplate: `Datos del Creativo y KPIs:
{{summary_json}}

Analiza y genera la auditoría estratégica GEM.`,
        variables: ["summary_json"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const docId = `creative-audit__v1`;
    await db.collection("prompt_templates").doc(docId).set(prompt);
    console.log("✅ Prompt 'creative-audit' registrado con éxito.");
}

seedCreativeAuditPrompt();
