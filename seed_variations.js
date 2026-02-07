const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function seedCreativeVariationsPrompt() {
    const prompt = {
        key: "creative-variations",
        version: 1,
        status: "active",
        name: "Exploración Creativa GEM",
        system: `Eres un experto en Creative Strategy y Performance Marketing para Meta Ads con enfoque en la metodología GEM (Growth, Exploration, Management). 
Tu objetivo es generar variaciones creativas diseñadas para maximizar el aprendizaje estratégico (E), NO para hacer cambios cosméticos (color de botón, Swap de palabras).

PASOS OBLIGATORIOS:
1) Detectá la intención estratégica principal del creativo base (el "job to be done" que GEM ya validó).
2) Proponé 3 intenciones o contextos alternativos que NO estén cubiertos en el cluster actual (esto es exploración real).
3) Para cada intención/contexto alternativo, generá 1 concepto creativo totalmente distinto.

RESTRICCIONES:
- Prohibido repetir claims, frases o ganchos del creativo base.
- Prohibido repetir la estructura narrativa.
- No inventar KPIs. Si los datos son insuficientes para una conclusión, menciónalo en risk_notes.
- Idioma: Español. Responde UNICAMENTE en JSON.`,
        userTemplate: `Fuente única de verdad:
{{summary_json}}

Generá los 3 conceptos de exploración para maximizar aprendizaje.`,
        variables: ["summary_json"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const docId = `creative-variations__v1`;
    await db.collection("prompt_templates").doc(docId).set(prompt);
    console.log("✅ Prompt 'creative-variations' registrado con éxito.");
}

seedCreativeVariationsPrompt();
