# Stack de Herramientas — Guia Rapida

## Plataformas E-commerce

### Shopify

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Plataforma SaaS de e-commerce. La mas popular mundialmente. |
| **Dashboards clave** | Analytics > Reports, Orders, Customers |
| **Metricas nativas** | Revenue, AOV, Returning customer rate, Top products, Traffic sources |
| **Apps esenciales** | Google & YouTube (Shopping feed), Klaviyo (email), Judge.me (reviews), PageFly (landing pages) |
| **Verificar mensual** | Checkout flow funciona, velocidad del tema, apps activas necesarias |
| **Integracion Worker** | OAuth Partners App "Worker Brain". Scopes: read_orders, read_customers, read_products. |

### Tienda Nube

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Plataforma e-commerce LATAM (Argentina, Brasil, Mexico). Integracion nativa MercadoLibre/MercadoPago. |
| **Dashboards clave** | Estadisticas (nativo), Marketing > Google Shopping |
| **Metricas nativas** | Ventas, pedidos, productos mas vendidos, canales de venta (tienda, meli, api) |
| **Apps esenciales** | Perfit (email+whatsapp), Tienda Apps (funcionalidades extra), integracion MercadoLibre |
| **Verificar mensual** | Sincronizacion MercadoLibre, feed Google Shopping activo, apps actualizadas |
| **Integracion Worker** | OAuth Marketplace App. Header: `Authentication: bearer {token}`. |

### WooCommerce

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Plugin WordPress de e-commerce. Open source, muy personalizable. |
| **Dashboards clave** | WooCommerce > Analytics, WordPress > Dashboard |
| **Metricas nativas** | Revenue, orders, items sold, refunds, coupons used |
| **Plugins esenciales** | Google Listings & Ads, WooCommerce Subscriptions, Yoast SEO, WP Rocket (velocidad) |
| **Verificar mensual** | Actualizaciones WordPress/WooCommerce/plugins, certificado SSL, velocidad, backups |
| **Integracion Worker** | API Key Auth. Consumer Key + Secret via query params. HTTPS obligatorio. |

---

## Plataformas de Publicidad

### Meta Ads Manager

| Aspecto | Detalle |
|---------|---------|
| **Acceso** | business.facebook.com → Ads Manager |
| **Estructura** | Campana > Ad Set > Ad |
| **Reportes clave** | Performance, Breakdown (edad, genero, ubicacion, dispositivo, plataforma) |
| **Columnas esenciales** | ROAS, CPA, CTR (link), Frequency, Reach, Hook Rate (video), CPM |
| **Verificacion** | Events Manager > Pixel > Diagnostics. EMQ >7. |
| **Gotchas** | Fase de aprendizaje (50 conversiones/7d), no tocar presupuesto >30%, attribution window 7d click |

### Google Ads

| Aspecto | Detalle |
|---------|---------|
| **Acceso** | ads.google.com |
| **Campanas clave** | Performance Max, Search Brand, Search Non-brand |
| **Reportes clave** | Search Terms, Auction Insights, Campaign performance |
| **Columnas esenciales** | ROAS, CPA, CTR, Impression Share, Quality Score, Conversions |
| **Verificacion** | Conversion tracking via GA4 import o tag directo. Tag Assistant para debug. |
| **Gotchas** | Merchant Center errores desaprueban productos sin aviso. Revisar semanal. |

### Google Merchant Center

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Feed de productos para Google Shopping / pMax |
| **Verificar** | Diagnostics > Product issues, Feed freshness, Pricing accuracy |
| **Errores comunes** | Precio no coincide, imagen baja calidad, titulo generico, sin GTIN |
| **Conexion** | Shopify: app nativa / TN: Marketing > Google Shopping / WC: plugin Google Listings |

---

## Plataformas de Email

### Klaviyo

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Plataforma de email marketing premium para e-commerce. Segmentacion avanzada. |
| **Features clave** | Flows (automatizaciones), Campaigns, Segments, Predictive Analytics, A/B Testing |
| **Dashboards** | Analytics > Dashboard, Flows > Performance, Campaigns > Reports |
| **Integraciones** | Shopify (nativa, 1-click), WooCommerce (plugin), Tienda Nube (via Zapier o API) |
| **Segmentos predictivos** | High CLV, At risk of churn, Winback candidates |
| **Verificar mensual** | Account Health, deliverability, list growth, flow performance, segment sizes |
| **Integracion Worker** | API Key (pk_...). Revision header obligatorio. Rate limits: 2/min reporting, 225/day. |

### Perfit

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Plataforma email + WhatsApp para LATAM. Soporte espanol, integracion Tienda Nube nativa. |
| **Features clave** | Campanas, Automatizaciones, WhatsApp Marketing, Templates drag & drop |
| **Dashboards** | Reportes > Campanas, Automatizaciones > Estadisticas |
| **Integraciones** | Tienda Nube (nativa, 1-click), Shopify (via API), WooCommerce (via API) |
| **Verificar mensual** | Dominio autenticado (SPF, DKIM), automatizaciones activas, contactos sincronizados |
| **Integracion Worker** | Bearer token `{accountId}-{secret}`. Inline metrics (no separate reporting API). |

---

## Analytics

### Google Analytics 4 (GA4)

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Analytics web de Google. Reemplazo de Universal Analytics. |
| **Reportes clave** | Acquisition > Traffic, Engagement > Pages, Monetization > Ecommerce |
| **Eventos e-commerce** | view_item, add_to_cart, begin_checkout, purchase |
| **Atribucion** | Data-driven attribution (default). Ventanas: 30d click, 90d engaged view. |
| **Verificar mensual** | Eventos disparando correctamente, filtros de IP internos, conversion events marcados |
| **Integracion** | Importar conversiones a Google Ads. Cruzar revenue con Meta. |
| **Gotchas** | Sampling en reportes con mucho volumen. Usar explorations o API para datos exactos. |

### Google Search Console (GSC)

| Aspecto | Detalle |
|---------|---------|
| **Que es** | Herramienta gratuita de Google para monitorear presencia en busqueda. |
| **Reportes clave** | Performance (queries, pages, CTR, position), Coverage, Core Web Vitals |
| **Acciones semanales** | Revisar queries top, posiciones 4-10 (quick wins), errores de cobertura |
| **Verificar mensual** | Sitemap enviado, sin errores criticos, mobile usability OK, Core Web Vitals verdes |
| **Gotchas** | Datos con 2-3 dias de retraso. No incluye todas las queries (privacy). |

---

## Herramientas de Soporte

### Canva

| Aspecto | Detalle |
|---------|---------|
| **Uso** | Diseno rapido de creativos para ads, email, social |
| **Templates utiles** | Instagram Post (1:1), Instagram Story (9:16), Facebook Ad, Email Header |
| **Tip** | Brand Kit para mantener consistencia de colores/fuentes. Magic Resize para adaptar formatos. |

### Notion

| Aspecto | Detalle |
|---------|---------|
| **Uso** | Documentacion, calendarios, bases de datos de contenido, SOPs |
| **Templates utiles** | Calendario editorial, tracking de campanas, briefing de creativos |

### Slack

| Aspecto | Detalle |
|---------|---------|
| **Uso** | Comunicacion interna, alertas automaticas, reportes diarios |
| **Integracion Worker** | Bot token para daily digest, weekly alerts, error reporting |

### Google Sheets

| Aspecto | Detalle |
|---------|---------|
| **Uso** | Reportes custom, tracking de metricas, presupuestos, proyecciones |
| **Templates utiles** | Dashboard mensual, tracker de ROAS por canal, proyeccion de revenue |

---

## Verificacion Mensual del Stack

### Checklist general

- [ ] Todas las plataformas de ads activas y sin errores
- [ ] Pixel Meta + CAPI funcionando (Events Manager > Diagnostics)
- [ ] Google Ads conversion tag activo (Tag Assistant)
- [ ] Merchant Center sin productos desaprobados
- [ ] GA4 eventos e-commerce disparando
- [ ] Email platform sincronizada con e-commerce
- [ ] Flows de email activos y sin errores
- [ ] GSC sin errores criticos
- [ ] Sitio velocidad OK (PageSpeed >80 mobile)
- [ ] Backups de e-commerce al dia
- [ ] Accesos de equipo actualizados (remover ex-colaboradores)
