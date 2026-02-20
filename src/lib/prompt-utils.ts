/**
 * Cerebro de Worker — Prompt Utilities
 * Centralizes all default critical instructions and output schemas
 * that were previously hardcoded across multiple service files.
 */

/**
 * Builds the final system prompt by appending critical instructions.
 * If the DB template has custom criticalInstructions, uses those.
 * Otherwise falls back to the hardcoded default for that prompt key.
 */
export function buildSystemPrompt(
    baseSystem: string,
    dbCriticalInstructions: string | undefined,
    promptKey: string
): string {
    const critical = dbCriticalInstructions || getDefaultCriticalInstructions(promptKey);
    if (!critical) return baseSystem;
    return baseSystem + '\n\n' + critical;
}

/**
 * Returns the default critical instructions for a given prompt key.
 * These were previously hardcoded in each service file.
 */
export function getDefaultCriticalInstructions(promptKey: string): string {
    switch (promptKey) {
        case 'report':
            return `INSTRUCCIONES CRÍTICAS:
1. Eres un ANALISTA ESTRATÉGICO. NO repitas datos. INTERPRETA y PLANIFICA.
2. IDIOMA: ESPAÑOL.

FORMATO DE RESPUESTA (JSON):
Debes responder con un JSON válido que cumpla este esquema (TypeScript/GraphQL-like):

type Response = {
  meta: any; // Metadatos libres
  sections: Section[];
}

type Section = {
  id: "strategy"; // Única sección requerida
  title: string;
  summary: string; // Resumen ejecutivo
  insights: Insight[];
}

type Insight = {
  title: string;
  observation: string; // Causa raíz + hallazgos
  implication: string; // Impacto en negocio
  actions: Action[];
}

type Action = {
  type: "DO";
  description: string;
  horizon: "IMMEDIATE" | "SHORT_TERM";
  expectedImpact: string;
}`;

        case 'recommendations_v1':
            return `INSTRUCCIONES CRÍTICAS:
- Responde EXCLUSIVAMENTE en formato JSON.
- IDIOMA: TODO EL CONTENIDO DEL JSON (exceptuando las keys) DEBE ESTAR EN ESPAÑOL.
- No uses markdown ni explicaciones fuera del JSON.
- Si los datos son insuficientes, devuelve status: "insufficient_evidence".

ESQUEMA JSON REQUERIDO:
{
  "decision": "SCALE" | "ROTATE_CONCEPT" | "CONSOLIDATE" | "INTRODUCE_BOFU_VARIANTS" | "KILL_RETRY" | "HOLD",
  "evidence": string[],
  "actions": string[],
  "experiments": string[],
  "creativeBrief": string | null,
  "confidence": number,
  "impactScore": number
}`;

        case 'concept_briefs_v1':
            return `INSTRUCCIONES CRÍTICAS:
- Responde EXCLUSIVAMENTE en JSON.
- IDIOMA: TODO EL CONTENIDO DEL JSON (exceptuando las keys) DEBE ESTAR EN ESPAÑOL.
- No uses markdown.

ESQUEMA JSON REQUERIDO:
{
  "context": "string",
  "evidence": string[],
  "diagnosis": "string",
  "rotationPlan": {
    "avatar": "string",
    "conflict": "string",
    "proof": "string",
    "format": "string",
    "context": "string"
  },
  "deliverables": [
    {
      "title": "string",
      "hooks": [string, string],
      "script": "string",
      "visual": "string",
      "cta": "string",
      "proofType": "string"
    }
  ],
  "successCriteria": "string"
}`;

        case 'creative-audit':
            return `FORMATO JSON REQUERIDO:
{
  "diagnosis": "Resumen del rendimiento actual.",
  "risks": {
    "fatigue": "Evaluación de saturación.",
    "collision": "Riesgo de canibalización con otros activos."
  },
  "actions": {
    "horizon7d": "Acción inmediata de optimización.",
    "horizon14d": "Siguiente paso estratégico.",
    "horizon30d": "Visión a largo plazo para este activo."
  },
  "score": 0-100
}

IDIOMA: ESPAÑOL.
SE BREVE Y ACCIONABLE.`;

        case 'creative-variations':
            return `INSTRUCCIONES CRÍTICAS:
- Responde EXCLUSIVAMENTE en formato JSON.
- IDIOMA: ESPAÑOL.
- Genera variaciones de exploración real, no cambios cosméticos.
- Devuelve un array de objetos con: concept_name, difference_axis, gem_intent, target_context, hooks[], copy_variations[], headline_variations[], visual_context, cta_suggestion.`;

        default:
            return '';
    }
}

/**
 * Returns the default output schema description for a given prompt key.
 * Used for visual reference in the admin UI.
 */
export function getDefaultOutputSchema(promptKey: string): string {
    switch (promptKey) {
        case 'report':
            return `{
  "meta": { ... },
  "sections": [{
    "id": "strategy",
    "title": "string",
    "summary": "string",
    "insights": [{
      "title": "string",
      "observation": "string",
      "implication": "string",
      "actions": [{
        "type": "DO",
        "description": "string",
        "horizon": "IMMEDIATE | SHORT_TERM",
        "expectedImpact": "string"
      }]
    }]
  }]
}`;

        case 'recommendations_v1':
            return `{
  "decision": "SCALE | ROTATE_CONCEPT | CONSOLIDATE | INTRODUCE_BOFU_VARIANTS | KILL_RETRY | HOLD",
  "evidence": ["string"],
  "actions": ["string"],
  "experiments": ["string"],
  "creativeBrief": "string | null",
  "confidence": 0.0-1.0,
  "impactScore": 0.0-1.0
}`;

        case 'concept_briefs_v1':
            return `{
  "context": "string",
  "evidence": ["string"],
  "diagnosis": "string",
  "rotationPlan": {
    "avatar": "string",
    "conflict": "string",
    "proof": "string",
    "format": "string",
    "context": "string"
  },
  "deliverables": [{
    "title": "string",
    "hooks": ["string", "string"],
    "script": "string",
    "visual": "string",
    "cta": "string",
    "proofType": "string"
  }],
  "successCriteria": "string"
}`;

        case 'creative-audit':
            return `{
  "diagnosis": "string",
  "risks": {
    "fatigue": "string",
    "collision": "string"
  },
  "actions": {
    "horizon7d": "string",
    "horizon14d": "string",
    "horizon30d": "string"
  },
  "score": 0-100
}`;

        case 'creative-variations':
            return `[{
  "concept_name": "string",
  "difference_axis": "string",
  "gem_intent": "string",
  "target_context": "string",
  "hooks": ["string"],
  "copy_variations": ["string"],
  "headline_variations": ["string"],
  "visual_context": "string",
  "cta_suggestion": "string"
}]`;

        default:
            return '{}';
    }
}

/** All available prompt keys with display names */
export const PROMPT_KEYS = [
    { key: 'report', label: 'Reporte Diario', description: 'Consolidado matutino en Slack con análisis estratégico' },
    { key: 'creative-audit', label: 'Auditoría Creativa', description: 'Calificación y diagnóstico de anuncios existentes' },
    { key: 'creative-variations', label: 'Variaciones de Copy', description: 'Generación de nuevas variantes de anuncios' },
    { key: 'recommendations_v1', label: 'Recomendaciones', description: 'Playbook de acción por entidad (GEM)' },
    { key: 'concept_briefs_v1', label: 'Briefs Creativos', description: 'Briefs estructurados para el equipo creativo' },
] as const;
