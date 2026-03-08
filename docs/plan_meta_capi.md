# Plan: Meta Conversions API (CAPI) Integration

## Status: PENDIENTE

## Objetivo

Cuando un closer marca un lead como `nuevo_cliente` o `calificado` en el CRM, enviar automáticamente un evento a la **Conversions API de Meta** para que el algoritmo optimice por leads de calidad, no solo por volumen.

## Flujo

```
Closer marca "nuevo_cliente" en CRM
        ↓
PATCH /api/leads/[id]  (ya existe)
        ↓
Nuevo: POST a Meta CAPI
   → Evento "Purchase" o "Lead" (qualified)
   → Con fbclid/fbc/fbp del lead original
        ↓
Meta optimiza la campaña con esa señal
```

## Requisitos

### 1. Capturar identificadores de Meta en el lead

- Guardar `fbclid`, `fbc`, `fbp` cuando el lead entra (desde UTMs del webhook GHL o parámetros de URL)
- Agregar campos al tipo `Lead`: `fbclid?: string`, `fbc?: string`, `fbp?: string`
- Extraer de `utm` o de campos custom del webhook GHL

### 2. Config por cliente

- Agregar a `Client`: `metaPixelId?: string`, `metaCapiAccessToken?: string` (o reusar `META_ACCESS_TOKEN` global)
- Agregar toggle en ClientForm: `integraciones.capi: boolean`
- Mapeo de eventos configurable: qué estado del CRM dispara qué evento CAPI

### 3. Servicio CAPI

- Crear `src/lib/meta-capi-service.ts`
- Endpoint: `POST https://graph.facebook.com/v21.0/{pixel_id}/events`
- Eventos a enviar:
  - `Lead` → cuando se marca como `calificado`
  - `Purchase` → cuando se marca como `nuevo_cliente` (con value = revenue)
- Incluir: `event_name`, `event_time`, `user_data` (phone hash SHA256, email hash SHA256, fbc, fbp), `custom_data` (value, currency)
- Deduplication: usar `event_id` = `leadId_status` para evitar duplicados

### 4. Trigger automático

- Modificar `PATCH /api/leads/[id]/route.ts`
- Después de actualizar Firestore, si el status cambió a `calificado` o `nuevo_cliente`:
  - Verificar que el cliente tiene CAPI habilitado
  - Llamar `MetaCapiService.sendEvent()` (non-blocking, con try/catch)
  - Loguear resultado en `system_events`

### 5. Testing

- Meta tiene un "Test Events" tool en Events Manager
- Agregar `test_event_code` opcional para modo prueba
- Verificar deduplication con browser pixel (si existe)

## Archivos estimados

| Acción | Archivo |
|--------|---------|
| CREATE | `src/lib/meta-capi-service.ts` |
| MODIFY | `src/types/leads.ts` — agregar fbclid/fbc/fbp |
| MODIFY | `src/types/index.ts` — agregar metaPixelId, capi config |
| MODIFY | `src/app/api/leads/[id]/route.ts` — trigger CAPI on status change |
| MODIFY | `src/app/api/webhooks/ghl/route.ts` — extraer fbclid del payload |
| MODIFY | `src/components/admin/clients/ClientForm.tsx` — toggle CAPI + pixel ID |

## Notas

- La CAPI requiere hashear PII (phone, email) con SHA256 antes de enviar
- El `fbc` cookie tiene formato: `fb.1.{timestamp}.{fbclid}`
- Si no hay fbclid/fbc, el evento igual se puede enviar con phone+email hasheados (match rate menor)
- Considerar enviar también evento `Lead` al momento de creación del lead (no solo calificación)
