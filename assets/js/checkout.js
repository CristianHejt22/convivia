// assets/js/checkout.js - Flujo de Checkout Adaptable con Horario Conforme y Multi-Mascota
// Compatible de manera universal con index.html y product.html

const Checkout = {
  currentOrder: null,
  receiptFile: null,

  init() {
    this.bindEvents();
  },

  open() {
    this.openModal();
  },

  getSettings() {
    if (typeof App !== 'undefined' && App.state && App.state.settings && Object.keys(App.state.settings).length > 0) {
      return App.state.settings;
    }
    if (typeof ProductPage !== 'undefined' && ProductPage.state && ProductPage.state.settings && Object.keys(ProductPage.state.settings).length > 0) {
      return ProductPage.state.settings;
    }
    return window.appSettings || {};
  },

  getCart() {
    if (typeof App !== 'undefined' && App.state && Array.isArray(App.state.cart)) {
      return App.state.cart;
    }
    if (typeof ProductPage !== 'undefined' && ProductPage.state && Array.isArray(ProductPage.state.cart)) {
      return ProductPage.state.cart;
    }
    try {
      return JSON.parse(localStorage.getItem('convivia_cart') || localStorage.getItem('pawpulse_cart') || '[]');
    } catch (e) {
      return [];
    }
  },

  clearCart() {
    if (typeof App !== 'undefined' && App.state) {
      App.state.cart = [];
      App.saveCart?.();
      App.updateCartBadge?.();
    }
    if (typeof ProductPage !== 'undefined' && ProductPage.state) {
      ProductPage.state.cart = [];
      ProductPage.updateCartBadge?.();
    }
    localStorage.setItem('convivia_cart', '[]');
    localStorage.setItem('pawpulse_cart', '[]');
  },

  showToast(msg) {
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(msg);
    } else if (typeof ProductPage !== 'undefined' && ProductPage.showToast) {
      ProductPage.showToast(msg);
    } else {
      const container = document.getElementById('toastContainer');
      if (container) {
        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    }
  },

  bindEvents() {
    // Iniciar Checkout desde el Carrito
    document.getElementById('startCheckoutBtn')?.addEventListener('click', () => {
      if (typeof App !== 'undefined' && App.closeCart) App.closeCart();
      if (typeof ProductPage !== 'undefined' && ProductPage.closeCart) ProductPage.closeCart();
      this.openModal();
    });

    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
      if (typeof App !== 'undefined' && App.closeCart) App.closeCart();
      if (typeof ProductPage !== 'undefined' && ProductPage.closeCart) ProductPage.closeCart();
      this.openModal();
    });

    // Cerrar Modales
    document.getElementById('closeCheckoutBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('closeSuccessModalBtn')?.addEventListener('click', () => this.closeSuccessModal());

    // Cambio de Método de Pago
    document.querySelectorAll('input[name="checkout_payment"]').forEach(radio => {
      radio.addEventListener('change', (e) => this.handlePaymentMethodChange(e.target.value));
    });

    // Cambio de Zona de Envío (Costo Extra por Distancia)
    document.getElementById('checkoutShippingZone')?.addEventListener('change', () => {
      this.updateOrderSummary();
    });

    // Copiar Alias y CBU
    document.getElementById('copyAliasBtn')?.addEventListener('click', () => {
      const s = this.getSettings();
      const alias = s.bank_alias || document.getElementById('checkoutBankAlias')?.textContent || 'CONVIVIA.PETS';
      this.copyToClipboard(alias, 'copyAliasBtn', '¡Alias copiado!');
    });
    document.getElementById('copyCbuBtn')?.addEventListener('click', () => {
      const s = this.getSettings();
      const cbu = s.bank_cbu || '0070123130004018293812';
      this.copyToClipboard(cbu, 'copyCbuBtn', '¡CBU copiado!');
    });

    // Carga de Comprobante (File input & drag-and-drop)
    const fileInput = document.getElementById('receiptFileInput');
    const dropZone = document.getElementById('receiptDropZone');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileSelected(e.target.files[0]);
        }
      });
    }

    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-emerald-400', 'bg-emerald-500/10');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-emerald-400', 'bg-emerald-500/10');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-emerald-400', 'bg-emerald-500/10');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    // Envío del Formulario
    document.getElementById('checkoutForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitOrder();
    });
  },

  async openModal() {
    const cart = this.getCart();
    if (cart.length === 0) {
      this.showToast('El carrito está vacío');
      return;
    }

    // Asegurar que tengamos las configuraciones más recientes
    await this.ensureSettingsLoaded();
    this.populateSettingsData();
    this.syncSmartBowlData();
    this.updateOrderSummary();
    document.getElementById('checkoutModal')?.classList.add('active');
  },

  async ensureSettingsLoaded() {
    const s = this.getSettings();
    if (!s || !s.shipping_zone1_name) {
      try {
        const res = await fetch('/api/settings.php');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.status === 'success') {
          window.appSettings = data.settings;
          if (typeof App !== 'undefined' && App.state) App.state.settings = data.settings;
          if (typeof ProductPage !== 'undefined' && ProductPage.state) ProductPage.state.settings = data.settings;
          return;
        }
      } catch (e) {
        console.warn('Fallback a settings.json en checkout:', e);
        try {
          const res = await fetch('/assets/data/settings.json');
          const data = await res.json();
          if (data.status === 'success') {
            window.appSettings = data.settings;
            if (typeof App !== 'undefined' && App.state) App.state.settings = data.settings;
            if (typeof ProductPage !== 'undefined' && ProductPage.state) ProductPage.state.settings = data.settings;
          }
        } catch (err2) {
          console.error('Error fetching settings fallback:', err2);
        }
      }
    }
  },

  populateSettingsData() {
    const s = this.getSettings();

    // 1. Zonas de Envío Dinámicas desde Settings
    const zoneSelect = document.getElementById('checkoutShippingZone');
    if (zoneSelect && s.shipping_zone1_name) {
      zoneSelect.innerHTML = '';
      for (let i = 1; i <= 4; i++) {
        const name = s[`shipping_zone${i}_name`];
        const cost = parseFloat(s[`shipping_zone${i}_cost`] || 0);
        if (name) {
          const opt = document.createElement('option');
          opt.value = name;
          opt.dataset.cost = cost;
          opt.textContent = `${name} - ${cost === 0 ? '$0 (Gratis)' : '+$' + cost.toLocaleString('es-AR')}`;
          zoneSelect.appendChild(opt);
        }
      }
    }

    // 2. Horarios Conformes Dinámicos desde Settings
    const slotSelect = document.getElementById('checkoutDeliverySlot');
    if (slotSelect && s.delivery_slots) {
      const slots = s.delivery_slots.split(',').map(item => item.trim()).filter(Boolean);
      if (slots.length > 0) {
        slotSelect.innerHTML = slots.map(sl => `<option value="${sl}">${sl}</option>`).join('');
      }
    }

    // 3. Fecha mínima de entrega: Mañana
    const dateInput = document.getElementById('checkoutDeliveryDate');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const minDateStr = tomorrow.toISOString().split('T')[0];
      dateInput.min = minDateStr;
      if (!dateInput.value || dateInput.value < minDateStr) {
        dateInput.value = minDateStr;
      }
    }

    // 4. Badges de Descuento en Métodos de Pago
    const isGeneralEnabled = s.discount_transfer_enabled !== '0' && s.discount_transfer_enabled !== 0 && s.discount_transfer_enabled !== false;
    const discount = (s.discount_transfer_percent !== undefined && s.discount_transfer_percent !== null && s.discount_transfer_percent !== '') 
      ? parseFloat(s.discount_transfer_percent) 
      : 15;

    const coTransfer = document.getElementById('checkoutTransferDiscountBadge');
    if (coTransfer) {
      coTransfer.textContent = (isGeneralEnabled && discount > 0) ? `${Math.round(discount)}% OFF` : 'Sin recargo';
    }
    const coCash = document.getElementById('checkoutCashDiscountBadge');
    if (coCash) {
      coCash.textContent = (isGeneralEnabled && discount > 0) ? `${Math.round(discount)}% OFF` : 'Sin recargo';
    }
    const coHeader = document.getElementById('transferHeaderDiscountText');
    if (coHeader) {
      coHeader.textContent = (isGeneralEnabled && discount > 0) 
        ? `Datos para Transferir con ${Math.round(discount)}% OFF:` 
        : `Datos para Transferir:`;
    }

    // 5. CBU y Alias Bancario en Checkout
    const aliasEl = document.getElementById('checkoutBankAlias');
    if (aliasEl && s.bank_alias) aliasEl.textContent = s.bank_alias;
    const cbuEl = document.getElementById('checkoutBankCbu');
    if (cbuEl && s.bank_cbu) {
      cbuEl.textContent = s.bank_cbu.length > 10 ? `${s.bank_cbu.slice(0, 8)}...${s.bank_cbu.slice(-4)}` : s.bank_cbu;
    }
  },

  syncSmartBowlData() {
    let sb = null;
    if (typeof App !== 'undefined' && App.state && App.state.smartBowl) {
      sb = App.state.smartBowl;
    }
    if (!sb) return;

    const petType = sb.petType || 'perro';
    this.handlePetTypeToggle(petType);

    // Seleccionar el radio button correspondiente
    const radio = document.querySelector(`input[name="checkout_pet_type"][value="${petType}"]`);
    if (radio) radio.checked = true;

    // Pre-llenar pesos si existen
    const dogWeightInput = document.getElementById('checkoutPetWeight');
    if (dogWeightInput && (!dogWeightInput.value || dogWeightInput.value == '25')) {
      dogWeightInput.value = sb.dogWeight || 25;
    }

    const catWeightInput = document.getElementById('checkoutCatWeight');
    if (catWeightInput && (!catWeightInput.value || catWeightInput.value == '4')) {
      catWeightInput.value = sb.catWeight || 4.0;
    }
  },

  handlePetTypeToggle(type) {
    const dogFields = document.getElementById('checkoutDogFields');
    const catFields = document.getElementById('checkoutCatFields');
    const typeInput = document.getElementById('checkoutPetTypeInput');

    if (typeInput) typeInput.value = type;

    if (type === 'perro') {
      dogFields?.classList.remove('hidden');
      catFields?.classList.add('hidden');
    } else if (type === 'gato') {
      dogFields?.classList.add('hidden');
      catFields?.classList.remove('hidden');
    } else {
      // ambos
      dogFields?.classList.remove('hidden');
      catFields?.classList.remove('hidden');
    }
  },

  closeModal() {
    document.getElementById('checkoutModal')?.classList.remove('active');
  },

  closeSuccessModal() {
    document.getElementById('orderSuccessModal')?.classList.remove('active');
  },

  handlePaymentMethodChange(method) {
    const transferBox = document.getElementById('transferDetailsBox');
    if (method === 'transferencia') {
      transferBox?.classList.remove('hidden');
    } else {
      transferBox?.classList.add('hidden');
    }
    this.updateOrderSummary();
  },

  updateOrderSummary() {
    const method = document.querySelector('input[name="checkout_payment"]:checked')?.value || 'transferencia';
    const isPromo = (method === 'transferencia' || method === 'efectivo');

    let itemsTotal = 0;
    let listTotal = 0;
    const cart = this.getCart();

    cart.forEach(it => {
      const p = isPromo ? it.price_promo : it.price_list;
      itemsTotal += (p * it.quantity);
      listTotal += (it.price_list * it.quantity);
    });

    const savings = Math.max(0, listTotal - itemsTotal);

    // Calcular costo de envío por zona / distancia
    const zoneSelect = document.getElementById('checkoutShippingZone');
    const selectedOption = zoneSelect?.options[zoneSelect.selectedIndex];
    let shippingCost = parseFloat(selectedOption?.dataset?.cost || 0);

    const s = this.getSettings();
    const threshold = parseFloat(s.free_shipping_threshold || 60000);
    let shippingDisplay = '';

    if (shippingCost === 0) {
      shippingDisplay = 'GRATIS ($0)';
    } else if (itemsTotal >= threshold) {
      // Bonificación sobre costo de envío por superar la meta
      const discountedCost = Math.max(0, shippingCost - 2500);
      shippingDisplay = discountedCost === 0 
        ? `<span class="line-through text-gray-500 mr-1">$${shippingCost.toLocaleString('es-AR')}</span> <span class="text-emerald-400 font-bold">¡BONIFICADO!</span>` 
        : `<span class="line-through text-gray-500 mr-1">$${shippingCost.toLocaleString('es-AR')}</span> <span class="text-emerald-400 font-bold">+$${discountedCost.toLocaleString('es-AR')}</span>`;
      shippingCost = discountedCost;
    } else {
      shippingDisplay = `+$${shippingCost.toLocaleString('es-AR')}`;
    }

    const finalTotal = itemsTotal + shippingCost;

    // Actualizar hidden input para el POST
    const shippingCostInput = document.getElementById('checkoutShippingCostInput');
    if (shippingCostInput) shippingCostInput.value = shippingCost;

    // Actualizar DOM
    const subtotalEl = document.getElementById('checkoutSummarySubtotal');
    if (subtotalEl) subtotalEl.textContent = '$' + itemsTotal.toLocaleString('es-AR');

    const shippingEl = document.getElementById('checkoutSummaryShipping');
    if (shippingEl) shippingEl.innerHTML = shippingDisplay;

    const totalEl = document.getElementById('checkoutSummaryTotal');
    if (totalEl) totalEl.textContent = '$' + finalTotal.toLocaleString('es-AR');

    const savingsEl = document.getElementById('checkoutSummarySavings');
    if (savingsEl) {
      if (isPromo && savings > 0) {
        savingsEl.textContent = `Ahorro aplicado: -$${savings.toLocaleString('es-AR')}`;
        savingsEl.classList.remove('hidden');
      } else {
        savingsEl.classList.add('hidden');
      }
    }
  },

  handleFileSelected(file) {
    this.receiptFile = file;
    const previewContainer = document.getElementById('receiptPreviewContainer');
    const previewImg = document.getElementById('receiptPreviewImg');
    const fileName = document.getElementById('receiptFileName');

    if (previewContainer && previewImg && fileName) {
      fileName.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewImg.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      } else {
        previewImg.classList.add('hidden');
      }
      previewContainer.classList.remove('hidden');
    }
  },

  copyToClipboard(text, btnId, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> <span>${successMsg}</span>`;
        btn.classList.add('text-emerald-400');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('text-emerald-400');
        }, 2000);
      }
      this.showToast(successMsg);
    });
  },

  calculateTotal() {
    const method = document.querySelector('input[name="checkout_payment"]:checked')?.value || 'transferencia';
    const isPromo = (method === 'transferencia' || method === 'efectivo');

    let itemsTotal = 0;
    const cart = this.getCart();

    cart.forEach(it => {
      const p = isPromo ? (parseFloat(it.price_promo) || parseFloat(it.price_list) || 0) : (parseFloat(it.price_list) || 0);
      itemsTotal += (p * (parseInt(it.quantity, 10) || 1));
    });

    const zoneSelect = document.getElementById('checkoutShippingZone');
    const selectedOption = zoneSelect?.options[zoneSelect.selectedIndex];
    let shippingCost = parseFloat(selectedOption?.dataset?.cost || 0);

    const s = this.getSettings();
    const threshold = parseFloat(s.free_shipping_threshold || 60000);

    if (shippingCost > 0 && itemsTotal >= threshold) {
      shippingCost = Math.max(0, shippingCost - 2500);
    }

    return itemsTotal + shippingCost;
  },

  async submitOrder() {
    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-900 border-t-transparent mr-2"></span>
        <span>Procesando Pedido...</span>
      `;
    }

    const form = document.getElementById('checkoutForm');
    const formData = new FormData(form);
    
    // Agregar ítems del carrito
    const cart = this.getCart();
    formData.append('cart_items', JSON.stringify(cart));

    // Asegurar campo payment_method
    const method = document.querySelector('input[name="checkout_payment"]:checked')?.value || 'transferencia';
    formData.set('payment_method', method);

    // Agregar archivo comprobante si fue seleccionado
    if (this.receiptFile) {
      formData.set('receipt', this.receiptFile);
    }

    try {
      const res = await fetch('/api/checkout.php', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data && data.status === 'success') {
        this.currentOrder = data.order;

        // Limpiar carrito de manera segura en ambas vistas
        this.clearCart();

        this.closeModal();
        this.showOrderSuccess(data.order);
      } else {
        throw new Error(data?.message || 'Error al procesar el pedido');
      }
    } catch (err) {
      console.warn('Fallback de checkout vía WhatsApp por desconexión de backend:', err);
      // Fallback seguro: generar número de pedido y permitir envío directo por WhatsApp
      const settings = this.getSettings();
      const phone = (settings.whatsapp_number || '+54 9 2914658502').replace(/[^0-9]/g, '');
      const orderNumber = 'CP-' + Math.floor(100000 + Math.random() * 900000);
      const totalNum = this.calculateTotal();
      const totalFmt = '$' + Math.round(totalNum).toLocaleString('es-AR');
      
      const cart = this.getCart();
      const isPromo = (formData.get('payment_method') === 'transferencia' || formData.get('payment_method') === 'efectivo');
      const itemsList = cart.map(i => {
        const p = isPromo ? (parseFloat(i.price_promo) || parseFloat(i.price_list) || 0) : (parseFloat(i.price_list) || 0);
        return `• ${i.name} (x${i.quantity || 1}) - $${Math.round(p * (i.quantity || 1)).toLocaleString('es-AR')}`;
      }).join('\n');
      
      const deliverySlot = formData.get('delivery_time_slot') || formData.get('delivery_slot') || 'A coordinar';
      const deliveryDate = formData.get('delivery_date') || new Date().toISOString().split('T')[0];

      const waMsg = `🐾 *PEDIDO ${orderNumber} - CONVIVIA*\n\n` +
        `👤 *Cliente:* ${formData.get('customer_name') || 'Cliente'}\n` +
        `📱 *WhatsApp:* ${formData.get('customer_whatsapp') || ''}\n` +
        `📍 *Dirección:* ${formData.get('customer_address') || ''}\n` +
        `🕒 *Franja:* ${deliveryDate} | ${deliverySlot}\n` +
        `💳 *Método de Pago:* ${method === 'transferencia' ? '⚡ Transferencia Bancaria (Precio Preferencial)' : '💳 ' + method.toUpperCase()}\n\n` +
        `📦 *Productos:*\n${itemsList}\n\n` +
        `💰 *TOTAL: ${totalFmt}*\n\n` +
        `_Enviado desde convivia.com.ar_`;

      const fallbackOrder = {
        order_number: orderNumber,
        customer_name: formData.get('customer_name') || 'Cliente',
        total_formatted: totalFmt,
        whatsapp_url: `https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`,
        status: 'pendiente_comprobante',
        payment_method: method,
        delivery_date: deliveryDate,
        delivery_time_slot: deliverySlot,
        shipping_zone: formData.get('shipping_zone') || 'Bahía Blanca / Local',
        shipping_cost: parseFloat(formData.get('shipping_cost') || 0),
        pet_name: formData.get('pet_name') || '',
        pet_weight: formData.get('pet_weight') || '',
        cat_name: formData.get('cat_name') || '',
        cat_weight: formData.get('cat_weight') || ''
      };

      this.currentOrder = fallbackOrder;
      this.clearCart();
      this.closeModal();
      this.showOrderSuccess(fallbackOrder);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>🚀 Confirmar y Enviar Pedido</span>`;
      }
    }
  },

  showOrderSuccess(order) {
    this.lastCompletedOrder = order;
    const successModal = document.getElementById('orderSuccessModal');
    if (!successModal) return;

    document.getElementById('successOrderNumber').textContent = order.order_number;
    document.getElementById('successOrderTotal').textContent = order.total_formatted;

    const statusBadge = document.getElementById('successOrderStatusBadge');
    if (statusBadge) {
      statusBadge.textContent = order.receipt_url ? '⏳ Comprobante en Verificación' : '✓ En Preparación';
    }

    const payMethod = document.getElementById('successPaymentMethod');
    if (payMethod) {
      payMethod.textContent = order.payment_method;
    }

    const addressEl = document.getElementById('successDeliveryAddress');
    const formAddress = document.querySelector('input[name="customer_address"]')?.value;
    if (addressEl && formAddress) {
      addressEl.textContent = formAddress;
    }

    // Horario Conforme y Zona de Envío
    const schedEl = document.getElementById('successDeliverySchedule');
    if (schedEl) {
      schedEl.textContent = `${order.delivery_date} (${order.delivery_time_slot})`;
    }

    const zoneEl = document.getElementById('successDeliveryZone');
    if (zoneEl) {
      zoneEl.textContent = `Zona: ${order.shipping_zone} ${order.shipping_cost > 0 ? '(+$' + order.shipping_cost.toLocaleString('es-AR') + ')' : '(Envío sin cargo adicional)'}`;
    }

    // Datos de Mascota
    const petBox = document.getElementById('successPetInfoContainer');
    const petText = document.getElementById('successPetInfo');
    if (petBox && petText) {
      const parts = [];
      if (order.pet_name) parts.push(`🐕 ${order.pet_name} (${order.pet_weight}kg)`);
      if (order.cat_name) parts.push(`🐈 ${order.cat_name} (${order.cat_weight}kg)`);

      if (parts.length > 0) {
        petText.textContent = parts.join(' y ');
        petBox.classList.remove('hidden');
      } else {
        petBox.classList.add('hidden');
      }
    }

    const receiptImg = document.getElementById('successReceiptImg');
    if (receiptImg) {
      if (order.receipt_url) {
        receiptImg.src = order.receipt_url;
        receiptImg.classList.remove('hidden');
      } else {
        receiptImg.classList.add('hidden');
      }
    }

    // Botón de WhatsApp de confirmación con la tienda
    const waBtn = document.getElementById('successWhatsappLink');
    if (waBtn) {
      const s = this.getSettings();
      const msg = encodeURIComponent(`¡Hola! Acabo de realizar el pedido ${order.order_number} por un total de ${order.total_formatted} en CONVIVIA. Entrega solicitada: ${order.delivery_date} (${order.delivery_time_slot}).`);
      const cleanWa = (s.whatsapp_number || '+54 9 291 465-8502').replace(/[^0-9]/g, '');
      waBtn.href = `https://wa.me/${cleanWa}?text=${msg}`;
    }

    successModal.classList.add('active');
  },

  printThermalTicket58mm() {
    if (!this.lastCompletedOrder) {
      alert('No hay un pedido activo para imprimir.');
      return;
    }
    const cart = this.getCart();
    const orderData = {
      ...this.lastCompletedOrder,
      items: (this.lastCompletedOrder.items && this.lastCompletedOrder.items.length) ? this.lastCompletedOrder.items : cart
    };
    if (window.ThermalPrinter58) {
      window.ThermalPrinter58.printTicket(orderData, this.getSettings());
    } else {
      window.print();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Checkout.init();
});
