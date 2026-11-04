# 🐾 PetShop 3.0: Plan Estratégico & Arquitectura de Alta Conversión

Documento maestro de desarrollo para la plataforma e-commerce de alimento balanceado y productos para mascotas.

---

## 🌟 1. Identidad y Concepto Diferencial
* **Estética:** *Dark Glassmorphism* con acentos neón esmeralda (`#00F59B` - ahorro y confirmación) y violeta eléctrico (`#8B5CF6` - fidelización y tecnología).
* **Propuesta Única:** Nutrición animal con transparencia total de precios duales, checkout sin fricción y recompra predictiva antes de que el plato de la mascota se vacíe.

---

## ⚡ 2. Arquitectura Base & Performance
* **Backend:** PHP 8.2+ micro-modular MVC sin bloatware (tiempo de respuesta del servidor < 40ms).
* **Base de Datos:** MySQL/MariaDB optimizada con índices B-Tree en atributos clave (categoría, animal, marca, peso, precio).
* **Front-end:** Vanilla JavaScript (ES6+), Fetch API asíncrona, HTML5 semántico y CSS3 con variables dinámicas. Cero recargas de página (SPA feeling).
* **Optimización:** Formato WebP nativo, compresión adaptativa en el cliente antes de subir comprobantes, lazy loading y caché estricto.

---

## 💰 3. Motor de Precios Duales y Catálogo
* **Precios Duales en Vivo:**
  * **Precio Lista:** Tarjetas de crédito y cuotas.
  * **Precio Promocional:** Descuento directo por Transferencia Bancaria o Efectivo con badge de ahorro visible en tiempo real.
  * **Métrica $/kg:** Cálculo automático del valor por kilo para comparar presentaciones (ej. bolsa 3kg vs 15kg).
* **Filtros AJAX Instantáneos:** Cruce por especie, edad/tamaño de raza, tipo de alimento (estándar, premium, medicado), marca y peso.
* **Control de Inventario SPA:** Edición masiva estilo planilla de cálculo, importador CSV y alertas tempranas de stock mínimo.

---

## 🛒 4. Flujo de Checkout de Alta Conversión
* **Autenticación Adaptable:** Modal flotante sin redirecciones. Compra rápida como invitado (solo Nombre, WhatsApp y Dirección) o Google One-Tap.
* **Proceso de Pago por Transferencia:**
  * Copia de Alias/CBU al portapapeles con 1 clic.
  * Generación dinámica de código QR de pago interoperable.
  * Carga drag & drop de comprobante (con compresión en el cliente para subidas instantáneas en 4G).
* **Panel de Cliente ("Mi Mascota"):**
  * Botón **"Repetir última compra"** en 1 toque.
  * Ficha de la mascota (nombre, peso, raza, fecha de cumpleaños).

---

## 🤖 5. Telegram Ops Desk (Control en el Bolsillo)
* **Notificaciones Push al Administrador:** Ficha detallada con datos del cliente, productos y enlace directo a WhatsApp.
* **Recepción del Comprobante:** Foto del comprobante bancario directa en el chat.
* **Botones Inline Interactivos:**
  * `[✅ Aprobar y Despachar]` (descuenta stock físico y notifica al cliente).
  * `[⚠️ Comprobante Ilegible / Diferencia]`.
  * `[💬 Chatear por WhatsApp con el Cliente]`.

---

## 📈 6. Growth Engine & Recompra Predictiva ("Smart Bowl")
* **Algoritmo de Ración Diaria:** Estima los gramos diarios consumidos según peso y raza de la mascota, calculando los días exactos de duración de la bolsa.
* **Disparador Automatizado:** A los **Día - 5** de agotarse la bolsa, envía un WhatsApp amistoso ofreciendo reponer su bolsa con descuento exclusivo de recompra.
* **Recuperación de Carritos:** Disparo de mensaje y correo a las 2 horas de abandono con enlace pre-cargado.
* **Server-Side Tracking:** Integración PHP para Meta Conversions API (CAPI) y Google Analytics 4, inmune a bloqueadores de anuncios.

---

## 🔍 7. SEO Estructural & Feeds Automatizados
* **Schema.org:** Marcado semántico `Product` y `Offer` con precio de lista, precio de transferencia y stock en tiempo real.
* **Sincronización Automática:** Cron Jobs diarios que generan archivos XML para Google Merchant Center y Meta Catalog.

---

## 🗺️ 8. Fases de Desarrollo
1. **Fase 1:** Base de datos relacional y arquitectura backend PHP.
2. **Fase 2:** Front-end Dark Glassmorphism y catálogo con filtros AJAX.
3. **Fase 3:** Motor de precios duales, modal de checkout y carga de comprobantes.
4. **Fase 4:** Integración del Bot de Telegram con botones de acción inline.
5. **Fase 5:** Algoritmo Smart Bowl de recompra predictiva, Feeds XML y Server-Side CAPI.
