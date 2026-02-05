# 🤖 MISIÓN 8 — Gemini Report with Digest Cache

## ✅ Completado

Se ha implementado el **Generador de Reportes Estratégicos con IA**, integrando Google Gemini para transformar hallazgos técnicos en planes de acción estratégicos, incluyendo un sistema de caché inteligente basado en digests de contenido.

---

## 🚀 Componentes Entregados

### 1. **Report API Endpoint** (`src/app/api/report/route.ts`)
Endpoint POST que orquestra la generación de reportes inteligentes.

**Características:**
- ✅ **Digest Cache**: Calcula un hash SHA256 del `summary.json`. Si los datos no han cambiado, devuelve el reporte cacheado instantáneamente sin gastar tokens.
- ✅ **Filtro de Privacidad**: Solo envía al LLM datos agregados y hallazgos procesados. Nunca envía el JSON raw de Meta.
- ✅ **Optimización de Tamaño**: Summary JSON limitado a **10 KB** para eficiencia en el prompt.
- ✅ **Análisis Multivariable**: Cruza objetivos de cuenta (`targetCPA`, `goal`) con hallazgos para personalizar la estrategia.

---

## 🧠 Capacidades de la IA (Gemini)

El reporte generado por Gemini incluye 4 secciones clave:

### 1. **Diagnosis**
Resumen ejecutivo de la salud de la cuenta basado en los hallazgos técnicos.

### 2. **Hypotheses**
Teorías sobre por qué el rendimiento está variando, categorizadas por probabilidad (**low**, **medium**, **high**).

### 3. **Actions Next 72h**
Plan de acción concreto priorizando tareas de impacto inmediato (**critical**, **high**, **medium**).

### 4. **Questions to Confirm**
Validaciones técnicas que el usuario debe hacer para confirmar que el set-up es el correcto (p. ej. "Confirmar si hubo cambios en los píxeles de la landing page recientemente").

---

## 📁 Esquema de Persistencia (`llm_reports`)

```typescript
{
  accountId: string;
  digest: string;      // SHA256 del summary enviado
  summary: any;         // Datos base analizados
  analysis: {
    diagnosis: string[];
    hypotheses: [
      { "title": string, "probability": string, "reasoning": string }
    ],
    actions_next_72h: [
      { "action": string, "priority": string, "expected_impact": string }
    ],
    questions_to_confirm: string[]
  };
  createdAt: string;
}
```

---

## 🛠️ Configuración Requerida

### 1. Gemini API Key
Obtén tu API Key en [Google AI Studio](https://aistudio.google.com/).

### 2. Variables de Entorno (`.env.local`)
```env
GEMINI_API_KEY=tu_api_key_de_gemini
```

---

## 🧪 Testing (CURL)

### Generar o Recuperar Reporte
```bash
curl -X POST "http://localhost:3000/api/report?accountId=YOUR_ACCOUNT_ID" \
     -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

## ✅ Guardrails Implementados
- ✅ **No Raw Data**: Solo se envían hallazgos ya procesados y KPIs agregados.
- ✅ **Token Efficiency**: El sistema de digest evita llamadas redundantes a la API de Gemini si los datos no han cambiado significativamente.
- ✅ **Strict Output**: El prompt fuerza un formato JSON estricto para consumo inmediato por el frontend.

---

**Siguiente paso:** Crear el componente visual en el Dashboard para mostrar este reporte estratégico al usuario. 🚀
