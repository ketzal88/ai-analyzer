# Auditoría Arquitectónica: AI Analyzer

## 1. Estado Actual (As-Is)

El sistema presenta una arquitectura híbrida en transición hacia un modelo "Offline-First" (GEM-Aware).

### Capas Actuales
1.  **Cron Layer**: `src/app/api/cron/data-sync`
    *   Invoca `PerformanceService.syncAllLevels` y `updateRollingMetrics`.
    *   Frecuencia: Diaria.
2.  **Sync Service**: `src/lib/performance-service.ts`
    *   Obtiene datos de Meta API.
    *   Escribe en `daily_entity_snapshots` (Nivel 1: Raw Data).
    *   Calcula y escribe en `entity_rolling_metrics` (Nivel 2: Aggregated Data).
3.  **Query Layer**: `src/app/api/analyze`
    *   **PROBLEMA CRÍTICO**: Lee de `insights_daily` (colección legada/abandonada) para KPIs básicos.
    *   Lee de `entity_rolling_metrics` para análisis avanzado (Decision Engine).
    *   Genera `dash_snapshots` (Cache Layer).
4.  **Analysis Engine**: `src/lib/decision-engine.ts`
    *   Consume `entity_rolling_metrics`.
    *   Clasifica entidades (TOFU/MOFU, Fatiga, Decisión).
5.  **AI Layer**: `src/lib/gemini-service.ts`
    *   Genera reportes de texto basados en hallazgos.

### Problemas Detectados
*   **Desconexión de Datos**: El Cron Job actualiza `daily_entity_snapshots`, pero el endpoint `/api/analyze` intenta leer `insights_daily` para los KPIs principales del Dashboard. Esto resultará en un "Dashboard Vacío" o datos estancados.
*   **Duplicidad Potencial**: Existencia de `insights_daily` (campaña) y `daily_entity_snapshots` (todos los niveles).
*   **Ineficiencia en Sync**: `syncAllLevels` descarga todo, sin filtrar por `spend > 0` o `effective_status`. Gasto innecesario de cuota y escrituras.
*   **Riesgo de Escalabilidad**: `daily_entity_snapshots` crece linealmente (Ads * Días). Leer 30 días de snapshots para calcular rolling metrics en runtime o cron puede ser pesado (5000+ docs).

---

## 2. Propuesta de Refactor (To-Be)

Objetivo: Unificar la fuente de verdad y optimizar el flujo de datos.

### Nueva Arquitectura de Capas
1.  **Sync Layer (Optimized)**:
    *   **Filtro Previo**: Solo descargar entidades con `effective_status=["ACTIVE"]` O `spend > 0` en el periodo.
    *   **Single Write**: Solo escribir en `daily_entity_snapshots`.
2.  **Aggregation Layer (Firestore Functions / Cron)**:
    *   Mantener `entity_rolling_metrics` como la fuente rápida para el Dashboard y Decision Engine.
    *   **NUEVO**: Usar `daily_account_snapshots` (nueva colección ligera) para KPIs globales del Dashboard, evitando leer miles de docs de ads.
3.  **Query Layer (Unificada)**:
    *   Dashboard lee `daily_account_snapshots` para KPIs globales.
    *   Dashboard lee `entity_rolling_metrics` para tablas detalladas y decisiones.
    *   Eliminar dependencia de `insights_daily`.

### Diagrama de Flujo de Datos

```mermaid
graph TD
    MetaAPI[Meta Marketing API] -->|Sync Cron (Filtered)| PerformanceService
    PerformanceService -->|Write Batch| DailySnap[Firestore: daily_entity_snapshots]
    
    DailySnap -->|Aggregation Logic| RollingMetrics[Firestore: entity_rolling_metrics]
    DailySnap -->|Aggregation Logic| AccountSnap[Firestore: daily_account_snapshots]
    
    User[Dashboard User] -->|Request| API_Analyze
    API_Analyze -->|Read 7d/30d| AccountSnap
    API_Analyze -->|Read Current| RollingMetrics
    API_Analyze -->|Read Alerts| AlertsCol[Firestore: alerts]
    
    RollingMetrics -->|Input| DecisionEngine
    DecisionEngine -->|Output| Classifications[Firestore: entity_classifications]
    Classifications -->|Trigger| AlertEngine
    AlertEngine -->|Write| AlertsCol
```

## 3. Plan de Acción Inmediato
1.  **Refactor Sync**: Modificar `PerformanceService` para filtrar por spend/status.
2.  **Fix Dashboard Query**: Cambiar `api/analyze` para usar `daily_entity_snapshots` (agregado) en lugar de `insights_daily`.
3.  **Deprecate**: Eliminar `insights_daily` y `meta-service.ts` (si solo se usa para esto).
