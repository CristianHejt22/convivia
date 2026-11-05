/**
 * assets/js/thermal-printer.js
 * Generador y formateador de Tickets y Etiquetas Térmicas de 58mm para CONVIVIA
 * Optimizado para impresoras térmicas POS de 58mm (Epson, Xprinter, Hasar, 3nStar, Bluetooth / USB)
 */

const ThermalPrinter58 = {
  /**
   * Genera el HTML formateado para un pedido individual en tira térmica de 58mm.
   */
  generateTicketHtml(order, storeSettings = {}) {
    const o = order;
    const s = storeSettings;
    const phone = s.whatsapp_number || '+54 9 291 465-8502';
    const storeAddress = s.store_address || 'Bahía Blanca, Buenos Aires';
    
    // Fechas
    const createdDate = (o.created_at || '').slice(0, 10) || new Date().toLocaleDateString('es-AR');
    const createdTime = (o.created_at || '').slice(11, 16) || new Date().toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
    const schedDate = o.delivery_date || 'En el día';
    const schedSlot = o.delivery_time_slot || 'Franja habitual';
    const zoneName = o.shipping_zone || 'Radio Local';
    const shipCost = parseFloat(o.shipping_cost || 0);

    // Items
    const items = o.items || [];
    let itemsHtml = '';
    if (items.length > 0) {
      itemsHtml = items.map(it => {
        const qty = it.quantity || 1;
        const name = it.product_name || it.name || 'Alimento Balanceado';
        const weight = it.weight_kg ? ` (${it.weight_kg}kg)` : '';
        const price = parseFloat(it.unit_price || it.price || 0);
        const sub = parseFloat(it.subtotal || (price * qty));
        return `
          <div style="margin-bottom: 4px;">
            <div style="font-weight: 900; font-size: 11px;">${qty}x ${name}${weight}</div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #222;">
              <span>$${price.toLocaleString('es-AR')} c/u</span>
              <span style="font-weight: bold;">$${sub.toLocaleString('es-AR')}</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      itemsHtml = `<div style="font-size: 11px; font-weight: bold;">1x Pedido registrado #${o.order_number}</div>`;
    }

    const subtotal = parseFloat(o.subtotal || o.total || 0);
    const discount = parseFloat(o.discount_amount || 0);
    const total = parseFloat(o.total || 0);

    const isPaid = (o.status === 'aprobado' || o.status === 'despachado') && (o.payment_method === 'transferencia' || o.payment_method === 'tarjeta');
    const isCash = o.payment_method === 'efectivo';

    // Mascotas
    let petsInfo = '';
    if (o.pet_name) petsInfo += `🐕 ${o.pet_name} (${o.pet_weight || '?'}kg) `;
    if (o.cat_name) petsInfo += `🐈 ${o.cat_name} (${o.cat_weight || '?'}kg)`;

    return `
      <div class="thermal-ticket-58mm" style="width: 52mm; margin: 0 auto; padding: 2mm 1mm; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; line-height: 1.25; page-break-after: always;">
        
        <!-- Encabezado Tienda -->
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 5px;">
          <div style="font-size: 16px; font-weight: 900; letter-spacing: 1px;">CONVIVIA</div>
          <div style="font-size: 8px; font-weight: bold; text-transform: uppercase;">Nutrición Animal • Bahía Blanca</div>
          <div style="font-size: 8px;">WhatsApp: ${phone}</div>
          <div style="font-size: 8px;">${storeAddress}</div>
        </div>

        <!-- Identificador de Pedido -->
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 900;">
          <span>ORDEN: ${o.order_number}</span>
          <span>${createdDate}</span>
        </div>
        <div style="font-size: 9px; margin-bottom: 4px;">Hora: ${createdTime} hs</div>
        <div style="border-top: 1px dashed #000; margin: 3px 0;"></div>

        <!-- Destinatario & Entrega -->
        <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin-top: 2px;">DESTINATARIO:</div>
        <div style="font-size: 13px; font-weight: 900; text-transform: uppercase;">${o.customer_name}</div>
        <div style="font-size: 11px; font-weight: bold;">TEL: ${o.customer_whatsapp}</div>
        <div style="font-size: 11px; font-weight: 900; margin-top: 2px; padding: 2px 0;">
          📍 DIR: ${o.customer_address}
        </div>
        ${o.notes ? `<div style="font-size: 9px; font-style: italic; margin-bottom: 2px;">Obs: ${o.notes}</div>` : ''}

        <div style="border-top: 1px dashed #000; margin: 3px 0;"></div>
        
        <!-- Logística de Envío en Bahía Blanca -->
        <div style="font-size: 9px; font-weight: bold; text-transform: uppercase;">LOGÍSTICA & DESPACHO:</div>
        <div style="font-size: 10px; font-weight: 900;">ZONA: ${zoneName}</div>
        <div style="font-size: 11px; font-weight: 900; background: #000; color: #fff; padding: 2px 4px; margin: 3px 0; text-align: center;">
          FRANJA: ${schedSlot}
        </div>
        <div style="font-size: 9px; font-weight: bold; text-align: center;">FECHA PACTADA: ${schedDate}</div>

        <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

        <!-- Productos -->
        <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px;">ALIMENTOS A ENTREGAR:</div>
        ${itemsHtml}

        <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

        <!-- Totales -->
        <div style="font-size: 10px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>$${subtotal.toLocaleString('es-AR')}</span>
          </div>
          ${discount > 0 ? `
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Ahorro Promo:</span>
              <span>-$${discount.toLocaleString('es-AR')}</span>
            </div>
          ` : ''}
          ${shipCost > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Envío Cadetería:</span>
              <span>+$${shipCost.toLocaleString('es-AR')}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; font-size: 9px;">
              <span>Envío:</span>
              <span>¡Bonificado / Gratis!</span>
            </div>
          `}
          
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; border-top: 2px solid #000; margin-top: 3px; padding-top: 3px;">
            <span>TOTAL:</span>
            <span>$${total.toLocaleString('es-AR')}</span>
          </div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>

        <!-- Estado de Cobro para el Cadete -->
        <div style="text-align: center; padding: 4px 2px; border: 2px solid #000; margin: 4px 0;">
          ${isPaid ? `
            <div style="font-size: 11px; font-weight: 900;">✓ PAGADO POR TRANSFERENCIA</div>
            <div style="font-size: 8px;">No cobrar nada al entregar</div>
          ` : isCash ? `
            <div style="font-size: 11px; font-weight: 900;">💵 COBRAR EN EFECTIVO</div>
            <div style="font-size: 14px; font-weight: 900;">$${total.toLocaleString('es-AR')}</div>
          ` : `
            <div style="font-size: 10px; font-weight: 900;">PAGO: ${(o.payment_method || 'A coordinar').toUpperCase()}</div>
            <div style="font-size: 12px; font-weight: 900;">TOTAL: $${total.toLocaleString('es-AR')}</div>
          `}
        </div>

        ${petsInfo ? `
          <div style="text-align: center; font-size: 9px; margin-top: 4px; font-weight: bold; border-top: 1px dotted #000; padding-top: 2px;">
            Mascota: ${petsInfo}
          </div>
        ` : ''}

        <!-- Pie de Ticket Convivial -->
        <div style="text-align: center; font-size: 8px; margin-top: 6px; border-top: 1px solid #000; padding-top: 4px;">
          ¡GRACIAS POR CONFIAR EN CONVIVIA!<br>
          Comunidad de pares de cuidado y amor animal.<br>
          <span style="font-size: 7px;">convivia.ar • Bahía Blanca</span>
        </div>

      </div>
    `;
  },

  /**
   * Imprime directamente un ticket de 58mm
   */
  printTicket(order, storeSettings = {}) {
    const ticketHtml = this.generateTicketHtml(order, storeSettings);
    this.executePrint(ticketHtml);
  },

  /**
   * Imprime un lote continuo de tickets de 58mm (para todos los pedidos de la hoja de ruta)
   */
  printBatchTickets(ordersArray, storeSettings = {}) {
    if (!ordersArray || ordersArray.length === 0) {
      alert('No hay pedidos para imprimir.');
      return;
    }
    const fullHtml = ordersArray.map(o => this.generateTicketHtml(o, storeSettings)).join('');
    this.executePrint(fullHtml);
  },

  /**
   * Ejecuta la orden de impresión nativa en un contenedor aislado
   */
  executePrint(htmlContent) {
    let printContainer = document.getElementById('thermal58mmPrintContainer');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'thermal58mmPrintContainer';
      document.body.appendChild(printContainer);
    }

    printContainer.innerHTML = htmlContent;

    // Asegurar que los estilos de impresión para 58mm estén inyectados
    let printStyle = document.getElementById('thermal58mmStyle');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'thermal58mmStyle';
      printStyle.textContent = `
        @media print {
          @page {
            size: 58mm auto;
            margin: 0mm !important;
          }
          html, body {
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
          }
          body > *:not(#thermal58mmPrintContainer) {
            display: none !important;
          }
          #thermal58mmPrintContainer {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .thermal-ticket-58mm {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
        @media screen {
          #thermal58mmPrintContainer {
            display: none;
          }
        }
      `;
      document.head.appendChild(printStyle);
    }

    // Disparar ventana de impresión
    setTimeout(() => {
      window.print();
    }, 150);
  }
};

window.ThermalPrinter58 = ThermalPrinter58;
