# 🧠 MISIÓN 7 — Findings Engine v1

## ✅ Completado

Se ha implementado el **Motor de Diagnóstico (Findings Engine) v1**, capaz de analizar métricas históricas de Meta Ads, calcular tendencias y generar hallazgos accionables basados en reglas de negocio avanzadas.

---

## 🚀 Componentes Entregados

### 1. **Findings API Endpoint** (`src/app/api/findings/route.ts`)
Endpoint POST que realiza el análisis técnico y persiste los resultados.

**Capacidades:**
- ✅ **Análisis WoW (Week-over-Week)**: Compara los últimos 7 días contra los 7 anteriores.
- ✅ **Agregación Multi-Nivel**: Calcula métricas globales de cuenta y específicas de campaña.
- ✅ **Evidencia Numérica**: Cada hallazgo incluye datos de `current`, `previous`, `delta` y `threshold`.
- ✅ **Persistencia**: Guarda los hallazgos en la colección `findings` para consulta histórica.

---

## 🔍 Reglas de Diagnóstico Implementadas (8)

### 1. **CPA_SPIKE** (Crítico)
- **Criterio**: El CPA aumentó más de un **25%** respecto a la semana pasada.
- **Impacto**: Pérdida inmediata de eficiencia en el gasto.

### 2. **ROAS_DROP** (Crítico)
- **Criterio**: El retorno sobre la inversión publicitaria cayó más de un **15%**.
- **Impacto**: El canal está perdiendo rentabilidad directa.

### 3. **CVR_DROP** (Advertencia)
- **Criterio**: El CTR es estable (±5%) pero la Tasa de Conversión (CVR) cayó más de un **15%**.
- **Hallazgo**: Problema probable en la landing page o en la oferta (post-click).

### 4. **CTR_DROP** (Advertencia)
- **Criterio**: El CTR cayó más de un **15%**.
- **Hallazgo**: Fatiga creativa o desajuste de audiencia (pre-click).

### 5. **SPEND_CONCENTRATION** (Advertencia)
- **Criterio**: El **20%** de las campañas suma más del **80%** del gasto total.
- **Riesgo**: Dependencia extrema de muy pocas entidades (poca diversificación).

### 6. **NO_CONVERSIONS_HIGH_SPEND** (Crítico)
- **Criterio**: Campañas con gasto > 2x CPA promedio y **0 compras**.
- **Acción**: Fuga de presupuesto (bleeding) que requiere pausa inmediata.

### 7. **VOLATILITY** (Advertencia)
- **Criterio**: Desviación estándar del CPA diario > 50% de la media.
- **Estado**: Inestabilidad en el algoritmo de Meta para encontrar audiencias.

### 8. **UNDERFUNDED_WINNERS** (Saludable/Oportunidad)
- **Criterio**: Campañas con CPA 20% mejor que el promedio pero con gasto por debajo de la media.
- **Oportunidad**: Candidatas ideales para escalar presupuesto.

---

## 📊 Estructura de Persistencia (`findings`)

```typescript
{
  accountId: string;
  type: string;        // E.g. "CPA_SPIKE"
  title: string;
  description: string;
  severity: "CRITICAL" | "WARNING" | "HEALTHY";
  status: "ATTENTION" | "OPTIMAL";
  entities: string[];  // Campañas afectadas
  evidence: {
    current: number;
    previous: number;
    delta: number;
    threshold: number;
  };
  version: 1;
  createdAt: string;
}
```

---

## 🧪 Testing (CURL)

### Ejecutar Diagnóstico Completo
```bash
curl -X POST "http://localhost:3000/api/findings?accountId=YOUR_ACCOUNT_ID" \
     -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

## 📝 Ejemplo de Respuesta JSON
```json
{
  "summary": {
    "accountId": "acc_123",
    "currentStats": { "cpa": 24.5, "roas": 3.2, ... },
    "WoW_Changes": { "cpa": 12.4, "roas": -5.2, ... }
  },
  "findingsCount": 3,
  "findings": [
    {
      "type": "CPA_SPIKE",
      "severity": "CRITICAL",
      "evidence": { "current": 24.5, "previous": 18.2, "delta": 34.6, "threshold": 25 }
    }
  ]
}
```

---

**Siguiente paso:** Integrar estos hallazgos reales en el Dashboard del frontend para que el usuario pueda ver sus alertas. 🚀
