# 📋 MISIÓN 9 — Admin Clients List (STRICT MODE)

## ✅ Completado

Se ha implementado la pantalla de administración de clientes siguiendo **estrictamente** el diseño de Google Stitch, incluyendo la jerarquía visual, espaciado, copys y funcionalidad técnica requerida.

---

## 🚀 Componentes Entregados

### 1. **Admin Clients Page** (`src/app/admin/clients/page.tsx`)
Página principal de administración con arquitectura de sub-componentes:
- ✅ **ClientsActionBar**: Buscador y botón de alta.
- ✅ **ClientsFilters**: Filtros de estado (Activo/Inactivo), Ecommerce y Google.
- ✅ **ClientsTable**: Tabla optimizada con hover effects y acciones rápidas.
- ✅ **ClientRow**: Lógica de renderizado por fila con toggle inline de estado.

### 2. **API Endpoints**
Controladores para el manejo de datos en Firestore:
- ✅ `GET /api/clients`: Listado completo.
- ✅ `POST /api/clients`: Registro de nuevos clientes.
- ✅ `PATCH /api/clients/[id]`: Actualizaciones parciales (Toggle active).
- ✅ `DELETE /api/clients/[id]`: Archivado de clientes (Soft delete).

---

## 🔍 Detalles del Modo Estricto (Stitch UI)

### 🎨 Diseño y Layout
- **Jerarquía**: Se ha respetado el uso de `text-hero` para títulos y `text-subheader` para secciones.
- **Jerarquía Visual**: Uso de bordes de color (`border-l-4`) y badges de estado según la especificación.
- **Interacción**: Botón "New Client" en posición primaria y buscador integrado en el action bar.

### ⚙️ Funcionalidad Implementada
- **Toggle Inline**: El campo `active` se puede cambiar directamente desde la tabla mediante un switch animado.
- **Acciones Rápidas**: Editar, Duplicar (UI) y Archivar aparecen solo al hacer hover en la fila.
- **Filtros Combinados**: Es posible filtrar por texto + estado + integraciones simultáneamente.

### 🚦 Manejo de Estados
Se han implementado vistas específicas para:
- ⏳ **Loading**: Spinner centrado con backdrop blur.
- 📭 **Empty**: Ilustración de estado vacío cuando no hay clientes.
- 🔍 **Filtered Empty**: Mensaje específico cuando los filtros no devuelven resultados.
- ❌ **Error**: Alert de conexión con opción de reintento.

---

## 📊 Estructura de Datos (`clients`)

```typescript
export interface Client {
    id: string;
    slug: string;        // Para rutas dinámicas
    name: string;
    active: boolean;     // Toggle inline
    isEcommerce: boolean;
    isGoogle: boolean;
    createdAt: string;
    updatedAt: string;
}
```

---

## 🧪 Testing (CURL)

### Listar Clientes
```bash
curl -X GET "http://localhost:3000/api/clients" \
     -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Cambiar Estado (Active/Inactive)
```bash
curl -X PATCH "http://localhost:3000/api/clients/ID_CLIENTE" \
     -H "Content-Type: application/json" \
     -H "Cookie: session=YOUR_SESSION_COOKIE" \
     -d '{"active": false}'
```

---

**Nota:** La navegación está integrada en el `AppLayout`. Se recomienda añadir el link `/admin/clients` al menú de navegación principal para facilitar el acceso. 🚀
