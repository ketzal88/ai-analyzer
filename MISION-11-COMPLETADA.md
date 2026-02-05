# 📦 MISIÓN 11 — Import Clients Modal (STRICT MODE)

## ✅ Completado

Se ha implementado el modal de importación masiva de clientes, permitiendo la carga de datos vía TSV/CSV (copiar y pegar) con previsualización en tiempo real y validación inteligente.

---

## 🚀 Componentes Entregados

### 1. **ImportClientsModal** (`src/components/admin/clients/ImportClientsModal.tsx`)
El corazón de la funcionalidad de importación.
- ✅ **Área de Pegado**: Soporta datos tabulados (TSV) de Google Sheets o comas (CSV).
- ✅ **Preview Inteligente**: Muestra las primeras 10 filas con indicadores de estado (`New`, `Update`, `Error`).
- ✅ **Validación en Cliente**: Bloquea filas sin nombre o clientes activos sin ID de cuenta.

### 2. **Parser de Importación** (`src/utils/importParser.ts`)
Lógica de procesamiento desacoplada:
- ✅ **Mapeo Automático**: Traduce encabezados en español ("Nombre", "Cuenta de FB", etc.) a las claves internas del sistema.
- ✅ **Detección de Delimitadores**: Identifica automáticamente si los datos provienen de Excel/Sheets (Tabs) o archivos estándar (Commas).
- ✅ **Lógica de Colisión**: Detecta si un cliente ya existe para marcarlo como `Update` en lugar de duplicarlo.

### 3. **API Batch Import** (`src/app/api/clients/import/route.ts`)
Endpoint optimizado para procesar múltiples registros:
- ✅ **Operaciones Atómicas**: Utiliza `Firestore Batch` para garantizar que todos los registros se guarden correctamente o ninguno (en caso de fallo crítico).
- ✅ **Upsert Inteligente**: Actualiza registros existentes o crea nuevos basándose en el slug.

---

## 🔍 Detalles de Implementación (Stitch UI)

### 🎨 Experiencia de Usuario (UX)
- **Indicadores de Estado**: Resumen en tiempo real del impacto de la importación (cuántos nuevos vs cuántos actualizaciones).
- **Control de Errores**: Las filas con errores de validación se resaltan visualmente y se excluyen del proceso de guardado automáticamente.
- **Feedback de Éxito**: Mensaje de confirmación tras finalizar el procesamiento masivo.

### ⚙️ Mapeo de Campos Requerido
El sistema reconoce automáticamente las siguientes columnas:
- `Nombre` ➡️ `name`
- `Canal de Slack publico` ➡️ `slackPublicChannel`
- `Canal de Slack Interno` ➡️ `slackInternalChannel`
- `Cuenta de FB` ➡️ `metaAdAccountId`
- `activo` (yes/no) ➡️ `active`
- `ecommerce` (yes/no) ➡️ `isEcommerce`
- `google` (yes/no) ➡️ `isGoogle`
- `Google Ads Account` ➡️ `googleAdsId`

---

**Nota:** He añadido el botón **"IMPORT"** en la barra de acciones de la lista de clientes. Para probarlo, simplemente copia un rango de celdas de una hoja de cálculo y pégalo en el modal. 🚀
