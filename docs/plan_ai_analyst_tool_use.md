# Plan: AI Analyst — Opción B: Tool Use (Futuro)

**Estado**: Pendiente para futura implementación
**Fecha**: 2026-03-06
**Prerequisito**: Opción A (Prompt Stacking) ya implementada

---

## Concepto

Agregar **tools/functions** al AI Analyst para que pueda consultar datos en tiempo real más allá del contexto estático que recibe. Hoy el analyst recibe un snapshot XML del período seleccionado. Con Tool Use, podría:

1. **Drill down** en datos específicos (ej: "mostrá las métricas de la campaña X día por día")
2. **Consultar períodos diferentes** al seleccionado
3. **Comparar clientes** (benchmark entre cuentas)
4. **Ejecutar cálculos complejos** (ej: "¿cuánto más presupuesto necesito para llegar al target?")

---

## Arquitectura Propuesta

### Tools definidos para Claude

```typescript
const tools = [
  {
    name: "query_daily_metrics",
    description: "Consulta métricas diarias de un canal específico para un rango de fechas",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string", enum: ["META", "GOOGLE", "ECOMMERCE", "EMAIL"] },
        startDate: { type: "string", description: "YYYY-MM-DD" },
        endDate: { type: "string", description: "YYYY-MM-DD" },
        metrics: { type: "array", items: { type: "string" }, description: "Métricas a consultar" },
      },
      required: ["channel", "startDate", "endDate"]
    }
  },
  {
    name: "query_campaign_details",
    description: "Obtiene detalle de una campaña específica por nombre o ID",
    input_schema: {
      type: "object",
      properties: {
        campaignName: { type: "string" },
        channel: { type: "string", enum: ["META", "GOOGLE"] },
      },
      required: ["campaignName", "channel"]
    }
  },
  {
    name: "calculate_projection",
    description: "Calcula proyecciones basadas en tendencias actuales",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string" },
        targetValue: { type: "number" },
        daysToProject: { type: "number" },
      },
      required: ["metric"]
    }
  },
  {
    name: "query_creative_performance",
    description: "Obtiene datos de Creative DNA y performance para creativos específicos",
    input_schema: {
      type: "object",
      properties: {
        adId: { type: "string" },
        includeHistory: { type: "boolean" },
      },
      required: ["adId"]
    }
  }
];
```

### Flujo de Ejecución

```
User message
    ↓
Claude recibe system prompt + XML context + tools
    ↓
Claude decide:
  → Respuesta directa (si tiene suficiente info) → SSE stream como hoy
  → Tool call (si necesita más datos) → ejecutar tool → feed result → stream response
```

### Cambios Necesarios

1. **`route.ts`**: Cambiar de `messages.stream()` a loop con `tool_use` handling
2. **`tool-executor.ts`** (nuevo): Implementar cada tool como función que consulta Firestore
3. **`types.ts`**: Agregar tipos para tool definitions
4. **SSE protocol**: Agregar evento `tool_call` para que el frontend muestre "Consultando datos..."
5. **Frontend**: Mostrar indicador de "tool use" durante la consulta (ej: spinner con "Buscando métricas...")
6. **Rate limiting**: Cada tool call cuenta como 1 request adicional en el rate limit

### Consideraciones

- **Costo**: Tool use agrega ~500 tokens de overhead por tool definition. Con 4 tools = ~2000 tokens extra por request.
- **Latencia**: Cada tool call agrega 1-3 segundos (Firestore query + Claude turn).
- **Seguridad**: Tools solo pueden consultar datos del mismo clientId (enforced en tool-executor).
- **Límite**: Máximo 3 tool calls por mensaje para evitar loops costosos.

---

## Prioridad

Baja-media. La Opción A (prompt stacking) cubre el 90% de los casos de uso. Tool Use es para cuando un usuario necesite análisis ad-hoc que requiera datos fuera del período seleccionado.

## Dependencias

- Opción A implementada y validada en producción
- Feedback de usuarios sobre qué preguntas no puede responder el analyst con el contexto actual
- Evaluación de costos de Anthropic tool use vs aumento de tokens en system prompt
