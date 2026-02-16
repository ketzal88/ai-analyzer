# 🎯 Estrategia Meta con IA: Guía para Paid Media
Esta documentación explica cómo integrar el **AI Analyzer** en el flujo de trabajo diario de gestión de pauta.

---

## 1. El Flujo de Trabajo (Workflow)
El sistema no reemplaza al Media Buyer, sino que actúa como un **Analista Jr. 24/7** que audita cada cuenta.

1.  **Mañana (09:00 AM)**: Revisar el `Daily Snapshot` en Slack.
    *   Mira el gasto acumulado del mes vs el total esperado.
    *   Compara el CPA actual vs el Target CPA configurado.
2.  **Durante el día**: Reaccionar a las `Alertas Críticas`.
    *   Si recibes un `Budget Bleed`, entra a Meta y apaga el asset.
    *   Si recibes una `Scaling Opportunity`, evalúa si el stock/operación permite escalar presupuesto.
3.  **Semanalmente**: Auditoría de Creativos en el `Creative Intel`.
    *   Filtra por "High Opportunity" para encontrar ganadores infra-presupuestados.
    *   Usa el botón "Generate Variants" para pedirle a la IA nuevas ideas de copy basadas en lo que ya está funcionando.

---

## 2. Entendiendo los Semáforos
*   🟢 **Verde (Bajo Riesgo)**: Eficiencia sólida. Mantener o Escalar.
*   🟡 **Amarillo (Atención)**: Desviaciones ligeras, fatiga incipiente o riesgo de reinicio de aprendizaje. Monitorear.
*   🔴 **Rojo (Crítico)**: Gasto sin resultados o pico de CPA insostenible. **Acción requerida.**

---

## 3. Configuración por Cliente (Tuning)
Cada cliente es un mundo. Un e-commerce de $50 USD de ticket no se optimiza igual que una captación de Leads inmobiliarios.

*   **E-commerce**: Prioriza `Purchases` y `ROAS`. El algoritmo es agresivo detectando "Fugas de Presupuesto".
*   **Lead Gen**: Prioriza el volumen y costo por Lead. El algoritmo ignora el valor de carrito y se enfoca en la estabilidad del CPL.
*   **Ajuste de Sensibilidad**: Si recibes demasiadas alertas de Fatiga, puedes subir el `Frequency Threshold` a 5 o 6 en la sección de Administración.

---

## 4. Mejores Prácticas de Escalamiento
La IA está programada para detectar el **Riesgo de Reinicio de Aprendizaje**. 
*   Meta recomienda no cambiar el presupuesto más de un 20% por día.
*   Nuestra alerta saltará si haces un cambio de >30%. 
*   **Consejo**: Si quieres duplicar el presupuesto, hazlo en pasos de 20% cada 48hs para mantener las métricas estables.

---

## 5. El Motor de Intención (Intent Engine)
El sistema clasifica cada anuncio en una etapa del embudo basada en su comportamiento relativo al resto de la cuenta:

*   **🏔️ TOFU (Top of Funnel)**: Contenido de prospección. Alto alcance, CTR moderado pero baja tasa de conversión directa.
*   **🌓 MOFU (Middle of Funnel)**: Contenido de consideración. Buen engagement y señales de intención pero volumen irregular de ventas.
*   **🎯 BOFU (Bottom of Funnel)**: Contenido de cierre. Alta tasa de conversión y CPA eficiente. Es donde el algoritmo busca escalar.

### ¿Cómo se calcula?
No es arbitrario. La IA utiliza un **Score de Intención** (0 a 1) ponderando:
1.  **FITR (30%)**: Compras sobre Clics (la calidad del click).
2.  **CR (25%)**: Compras sobre Impresiones.
3.  **CPA (25%)**: Eficiencia de costo.
4.  **CTR (20%)**: Relevancia del anuncio.

**Importante:** Se aplica una **Penalidad de Volatilidad** si el anuncio tiene pocas impresiones (< 2000), bajando su score automáticamente para evitar conclusiones apresuradas con poca data.

---

## 6. Glosario de Métricas IA
*   **Hook Rate (3s view / Imp)**: Qué tan efectivo es el inicio del video para detener el scroll.
*   **Efficiency Score**: Un puntaje de 0 a 100 que cruza ROAS, CPA y Estabilidad.
*   **Structural State**: Analiza si la cuenta está muy fragmentada (muchos adsets con poco presupuesto) o consolidada de forma óptima.
