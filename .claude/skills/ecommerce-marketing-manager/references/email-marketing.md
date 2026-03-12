# Email Marketing — Manual Completo

## Por que Email es el Canal de Mayor ROI

1. **No dependemos de ningun algoritmo** — la lista es nuestra
2. **Costo marginal casi cero** — enviar a 1K o 10K cuesta casi igual
3. **Audiencia calida** — suscriptores/clientes con relacion existente

**Benchmark**: 10K suscriptores activos + flows bien configurados = 20-30% del revenue total solo desde email.

---

## Pilar 1: Flows (Automatizaciones 24/7)

### Flow 1: Bienvenida (Welcome Series)

| Email | Timing | Contenido | Metrica objetivo |
|-------|--------|-----------|-----------------|
| 1 | Inmediato | Bienvenida + cupon primer compra | Open >50% |
| 2 | Dia 2 | Historia de marca, propuesta de valor | |
| 3 | Dia 5 | 3-5 productos bestsellers con foto+precio | |
| 4 | Dia 8 | 2-3 testimonios reales | |
| 5 | Dia 14 (solo si no compro) | Urgencia: cupon vence hoy | |

**Conversion objetivo del flow**: 3-5%

### Flow 2: Abandono de Carrito

| Email | Timing | Contenido | Nota |
|-------|--------|-----------|------|
| 1 | 1 hora | Recordatorio simple + imagen producto | NO incluir descuento todavia |
| 2 | 24 horas | Recordatorio + beneficio (envio/garantia) | Preguntar si hay dudas |
| 3 | 72 horas | Urgencia + cupon pequeno (si ticket lo justifica) | Ultimo email sobre este carrito |

**Detener flow si la persona compra.** Objetivo: recuperar 5-15% de abandonos.

### Flow 3: Post-Compra

| Email | Timing | Contenido |
|-------|--------|-----------|
| 1 | Inmediato | Confirmacion de pedido (transaccional, mayor apertura) |
| 2 | Dia 2-3 | Envio en camino + tracking |
| 3 | Dia 7-10 | Verificar conformidad + pedir resena/UGC |
| 4 | Dia 30 | Cross-sell: productos complementarios |
| 5 | Dia 60-90 | Recompra (solo productos consumibles/ciclo corto) |

### Flow 4: Win-back (Reactivacion)

Trigger: clientes sin compra en 90-180 dias.

| Email | Timing | Contenido |
|-------|--------|-----------|
| 1 | Dia 0 | "Te extranamos" + novedad + oferta exclusiva |
| 2 | Dia 7 | Oferta mas concreta + urgencia |
| 3 | Dia 14 | "Ultimo mensaje" + opcion de baja limpia. Si no abre: sacar de lista activa |

### Flow 5: Abandono de Navegacion (solo Klaviyo)

| Email | Timing | Contenido |
|-------|--------|-----------|
| 1 | 2-4 horas | Productos que vio + recomendaciones similares |
| 2 | 48 horas | Social proof del producto + urgencia suave |

---

## Pilar 2: Campanas Manuales

### Frecuencia recomendada

| Estado de la lista | Frecuencia |
|-------------------|------------|
| Nueva/fria (<3 meses, <30% open rate) | 1 email/semana |
| Activa (>30% open rate) | 2-3 emails/semana |
| Temporada alta (Hot Sale, BF) | 1 email/dia por 3-5 dias |

### Tipos de campanas

| Tipo | Cuando | Estructura |
|------|--------|------------|
| **Promocion/Oferta** | Descuento real, fecha especial | Subject con beneficio + urgencia, header con producto/descuento, CTA grande |
| **Newsletter editorial** | 1/mes | 1 tema principal + 2-3 secundarios, CTA suave |
| **Lanzamiento producto** | Producto nuevo | Presentacion + fotos + precio, acceso anticipado para suscriptores |
| **Cart push manual** | Temporadas altas | Email manual a segmento con carritos abandonados acumulados |

---

## Segmentacion

### Segmentos clave

**Por compra**: Compradores 30d / 31-90d / 91-180d / +180d (win-back) / Nunca compraron

**Por ticket**: Alto valor (exclusividad) / Ticket bajo (sensibles a precio, ofertas)

**Por engagement**: Activos (abrieron 90d) / Semi-inactivos (90-180d) / Inactivos (+180d)

**NUNCA mandar campanas masivas a inactivos.** Hacer win-back primero, si no responden: sacarlos.

---

## Entregabilidad

### Factores clave
- Reputacion del dominio (SPF, DKIM, DMARC configurados)
- Calidad de la lista (no comprar listas JAMAS)
- Contenido (evitar patrones de spam)
- Double opt-in cuando sea posible
- Limpiar lista cada 3 meses (remover +180d sin abrir)
- Spam rate < 0.08%

### Verificacion mensual
- [ ] Tasa de rebote < 2%
- [ ] Spam rate < 0.08%
- [ ] Klaviyo: Account Health dashboard
- [ ] Gmail Postmaster Tools: reputacion del dominio

---

## Subject Lines

### Formulas que funcionan

| Tipo | Ejemplo |
|------|---------|
| Urgencia | "Ultimas horas: X% OFF en toda la tienda" |
| Curiosidad | "La razon por la que nuestros clientes recompran" |
| Personalizacion | "[Nombre], esto es para vos" |
| Beneficio | "Envio gratis este fin de semana" |
| Novedad | "Llegaron los nuevos [Producto]" |
| Social proof | "Mas de 1.000 personas ya lo compraron" |
| Pregunta | "Ya probaste nuestro [Producto]?" |

**Reglas**: Max 50 caracteres. Completar siempre el preheader. NO usar TODO MAYUSCULAS, "GRATIS", "Haz clic aqui".

### A/B Testing
- Testear 2 subjects en 20% de la lista
- Esperar 4 horas
- Ganador se envia al 80% restante

---

## Metricas

| Metrica | Malo | Aceptable | Bueno | Excelente |
|---------|------|-----------|-------|-----------|
| Open Rate | <15% | 15-25% | 25-40% | >40% |
| Click Rate | <1% | 1-3% | >3% | >5% |
| CTOR | <5% | 5-10% | >10% | >15% |
| Unsubscribe/envio | >0.5% | 0.2-0.5% | <0.2% | — |
| Spam Rate | >0.08% (urgente) | <0.08% | <0.03% | — |

**Nota iOS**: Apple Mail infla open rates desde 2021. Cruzar con click rate para engagement real.

---

## Plataformas

### Klaviyo
- Flows, Campaigns, Lists/Segments, Analytics, Integrations
- Mensual: dashboard analytics, flow performance, integration sync, account health
- Segmentos predictivos: "High CLV", "At risk of churn"
- Limpiar inactivos cada 3 meses

### Perfit
- Campanas, Automatizaciones, Contactos, Reportes
- Integracion nativa con Tienda Nube + WhatsApp
- Soporte en espanol, buena opcion presupuesto ajustado
- **Obligatorio**: Autenticar dominio (SPF, DKIM)

---

## Checklists

### Inicio de mes
- [ ] Metricas mes anterior: open rate, click rate, revenue email, unsubscribes
- [ ] Auditar flows: activos? errores?
- [ ] Integracion e-commerce sincronizada?
- [ ] Calendario de envios del mes planificado
- [ ] Tamano y salud de la lista
- [ ] Segmento inactivo +180d → win-back?

### Pre-envio
- [ ] Subject <50 caracteres?
- [ ] Preheader completado?
- [ ] Links funcionan y van al lugar correcto?
- [ ] Se ve bien en mobile?
- [ ] Segmento correcto?
- [ ] Exclusiones configuradas?
- [ ] Remitente correcto?
- [ ] Email de prueba enviado a mi?

### Cierre de mes
- [ ] Reporte: open rate, click rate, CTOR, revenue, unsubscribes, spam rate
- [ ] Top 3 emails del mes
- [ ] Aprendizajes: que tipo de subject funciono mejor?
- [ ] Flows necesitan actualizacion (precios, productos, CTA)?
- [ ] Limpiar inactivos si hace 3 meses
