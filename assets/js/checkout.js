// assets/js/checkout.js - Flujo de Checkout Adaptable con Horario Conforme y Multi-Mascota
// Compatible de manera universal con index.html y product.html

const Checkout = {
  currentOrder: null,
  receiptFile: null,
  mpConfig: null,
  mpBrickController: null,

  init() {
    this.bindEvents();
    // Pre-cargar estado público del SDK de Mercado Pago en segundo plano
    this.loadMercadoPagoConfig().then(() => this.ensureMercadoPagoUI()).catch(() => {});
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
    if (typeof SpecialPages !== 'undefined' && SpecialPages.state && SpecialPages.state.settings && Object.keys(SpecialPages.state.settings).length > 0) {
      return SpecialPages.state.settings;
    }
    return window.appSettings || {};
  },

  getCart() {
    if (typeof App !== 'undefined' && App.state && Array.isArray(App.state.cart) && App.state.cart.length > 0) {
      return App.state.cart;
    }
    if (typeof ProductPage !== 'undefined' && ProductPage.state && Array.isArray(ProductPage.state.cart) && ProductPage.state.cart.length > 0) {
      return ProductPage.state.cart;
    }
    if (typeof SpecialPages !== 'undefined' && SpecialPages.state && Array.isArray(SpecialPages.state.cart) && SpecialPages.state.cart.length > 0) {
      return SpecialPages.state.cart;
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
    if (typeof SpecialPages !== 'undefined' && SpecialPages.state) {
      SpecialPages.state.cart = [];
      SpecialPages.saveCart?.();
      SpecialPages.updateCartBadge?.();
    }
    localStorage.setItem('convivia_cart', '[]');
    localStorage.setItem('pawpulse_cart', '[]');
  },

  showToast(msg) {
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(msg);
    } else if (typeof ProductPage !== 'undefined' && ProductPage.showToast) {
      ProductPage.showToast(msg);
    } else if (typeof SpecialPages !== 'undefined' && SpecialPages.showToast) {
      SpecialPages.showToast(msg);
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
      if (typeof SpecialPages !== 'undefined' && SpecialPages.closeCart) SpecialPages.closeCart();
      this.openModal();
    });

    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
      if (typeof App !== 'undefined' && App.closeCart) App.closeCart();
      if (typeof ProductPage !== 'undefined' && ProductPage.closeCart) ProductPage.closeCart();
      if (typeof SpecialPages !== 'undefined' && SpecialPages.closeCart) SpecialPages.closeCart();
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

    // Asegurar que tengamos las configuraciones más recientes y estado de Mercado Pago SDK
    await Promise.all([
      this.ensureSettingsLoaded(),
      this.loadMercadoPagoConfig()
    ]);
    this.populateSettingsData();
    this.ensureMercadoPagoUI();
    this.syncSmartBowlData();

    const activeMethod = document.querySelector('input[name="checkout_payment"]:checked')?.value || 'transferencia';
    this.handlePaymentMethodChange(activeMethod);
    document.getElementById('checkoutModal')?.classList.add('active');
  },

  async loadMercadoPagoConfig() {
    const s = this.getSettings();
    let serverCfg = null;
    try {
      const res = await fetch(`/api/mercadopago.php?action=public_config&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'success') {
          serverCfg = data;
        }
      }
    } catch (e) {}

    // Respaldo sandbox localStorage para pruebas en el mismo navegador (Vercel sin DB externa)
    const localPk = localStorage.getItem('convivia_mp_public_key') || '';
    const localEnabled = localStorage.getItem('convivia_mp_enabled');
    const localSandbox = localStorage.getItem('convivia_mp_sandbox');
    const localMaxInst = parseInt(localStorage.getItem('convivia_mp_max_installments') || '6', 10) || 6;
    const localSandboxTok = localStorage.getItem('convivia_mp_sandbox_token') || '';

    if (serverCfg && serverCfg.configured && serverCfg.enabled) {
      this.mpConfig = serverCfg;
      return this.mpConfig;
    }

    const pk = (serverCfg && serverCfg.public_key) || s.mp_public_key || localPk || '';
    const enabled = (serverCfg && serverCfg.configured)
      ? Boolean(serverCfg.enabled)
      : Boolean(pk && (localEnabled === '1' || s.mp_enabled === '1') && (localSandboxTok || s.mp_access_token_configured === '1' || pk.startsWith('TEST-')));

    this.mpConfig = {
      enabled,
      configured: Boolean(pk && (localSandboxTok || (serverCfg && serverCfg.configured) || s.mp_access_token_configured === '1')),
      public_key: pk,
      sandbox: (serverCfg && serverCfg.public_key) ? Boolean(serverCfg.sandbox) : (localSandbox === '1' || pk.startsWith('TEST-')),
      max_installments: (serverCfg && serverCfg.max_installments) || localMaxInst || 6,
      sandbox_token: localSandboxTok
    };
    return this.mpConfig;
  },

  isMercadoPagoActive() {
    const cfg = this.mpConfig || {};
    return Boolean(cfg.enabled && cfg.configured && cfg.public_key);
  },

  shouldProcessWithMercadoPago(selectedRadioValue) {
    if (!this.isMercadoPagoActive()) return false;
    if (selectedRadioValue === 'mercadopago') return true;
    if (selectedRadioValue === 'tarjeta') {
      const posnetChk = document.getElementById('checkoutCardPosnetOffline');
      return !(posnetChk && posnetChk.checked);
    }
    return false;
  },

  loadMercadoPagoSDKScript() {
    if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
    if (this._mpSdkPromise) return this._mpSdkPromise;

    this._mpSdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="sdk.mercadopago.com/js/v2"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.MercadoPago));
        existing.addEventListener('error', reject);
        setTimeout(() => {
          if (window.MercadoPago) resolve(window.MercadoPago);
        }, 1200);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.onload = () => resolve(window.MercadoPago);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return this._mpSdkPromise;
  },

  ensureMercadoPagoUI() {
    const cfg = this.mpConfig || {};
    const isMpActive = this.isMercadoPagoActive();

    const anyRadio = document.querySelector('input[name="checkout_payment"]');
    const radioGrid = anyRadio?.closest('.grid');
    if (radioGrid) {
      let mpLabel = document.getElementById('mpPaymentOptionLabel') ||
        document.querySelector('input[name="checkout_payment"][value="mercadopago"]')?.closest('label');

      if (!mpLabel) {
        mpLabel = document.createElement('label');
        mpLabel.id = 'mpPaymentOptionLabel';
        mpLabel.className = 'cursor-pointer';
        mpLabel.innerHTML = `
          <input type="radio" name="checkout_payment" value="mercadopago" class="peer sr-only" />
          <div class="p-2 sm:p-2.5 rounded-xl border border-white/10 bg-black/30 peer-checked:border-sky-400 peer-checked:bg-sky-500/15 text-center transition-all">
            <div class="text-base sm:text-lg">💙</div>
            <div class="text-[11px] sm:text-xs font-bold text-white mt-0.5 truncate">Mercado Pago</div>
            <div class="text-[9px] sm:text-[10px] text-sky-400 font-bold" id="checkoutMpInstallmentsBadge">Hasta ${cfg.max_installments || 6} cuotas</div>
          </div>
        `;
        radioGrid.appendChild(mpLabel);
        mpLabel.querySelector('input')?.addEventListener('change', (e) => this.handlePaymentMethodChange(e.target.value));
      }

      // Actualizar subtítulo de Tarjeta cuando Mercado Pago está activo
      const cardRadio = document.querySelector('input[name="checkout_payment"][value="tarjeta"]');
      const cardSubtitle = cardRadio?.closest('label')?.querySelector('div:last-child div:last-child');
      if (cardSubtitle) {
        if (isMpActive) {
          cardSubtitle.textContent = `Crédito / Débito (${cfg.max_installments || 6}x)`;
          cardSubtitle.className = 'text-[9px] sm:text-[10px] text-purple-300 font-bold';
        } else {
          cardSubtitle.textContent = 'Lista';
          cardSubtitle.className = 'text-[9px] sm:text-[10px] text-gray-400';
        }
      }

      const instBadge = document.getElementById('checkoutMpInstallmentsBadge');
      if (instBadge) {
        instBadge.textContent = `Hasta ${cfg.max_installments || 6} cuotas`;
      }

      if (isMpActive) {
        mpLabel.classList.remove('hidden');
        radioGrid.classList.remove('grid-cols-3');
        radioGrid.classList.add('grid-cols-2', 'sm:grid-cols-4');
        this.loadMercadoPagoSDKScript().catch(() => {});
      } else {
        mpLabel.classList.add('hidden');
        radioGrid.classList.remove('sm:grid-cols-4', 'grid-cols-2');
        radioGrid.classList.add('grid-cols-3');
        const mpRadio = mpLabel.querySelector('input');
        if (mpRadio && mpRadio.checked) {
          const fallbackRadio = document.querySelector('input[name="checkout_payment"][value="transferencia"]');
          if (fallbackRadio) fallbackRadio.checked = true;
        }
      }
    }

    // Caja informativa en Checkout al seleccionar Mercado Pago o Tarjeta Online
    const transferBox = document.getElementById('transferDetailsBox');
    if (transferBox && !document.getElementById('mercadoPagoInfoBox')) {
      const mpBox = document.createElement('div');
      mpBox.id = 'mercadoPagoInfoBox';
      mpBox.className = 'hidden p-4 rounded-2xl bg-sky-950/30 border border-sky-500/35 space-y-2.5';
      mpBox.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-sky-300 flex items-center gap-1.5">
            <span>💳</span> <span>Tarjetas & Cuotas con Mercado Pago SDK v2</span>
          </span>
          <span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold">Online Seguro</span>
        </div>
        <p class="text-[11px] text-gray-300 leading-relaxed">
          Al continuar, se abrirá el módulo oficial de <b>Tarjetas de Crédito / Débito y Mercado Pago</b> para que elijas tu tarjeta, banco y cantidad de cuotas (hasta <b><span id="mpInfoMaxInst">6</span> cuotas</b>).
        </p>
        <div class="flex flex-wrap gap-1.5 text-[10px] font-semibold text-sky-200">
          <span class="px-2 py-0.5 rounded-lg bg-black/40 border border-white/10">💳 Visa / Mastercard / Amex</span>
          <span class="px-2 py-0.5 rounded-lg bg-black/40 border border-white/10">🏦 Tarjeta de Débito</span>
          <span class="px-2 py-0.5 rounded-lg bg-black/40 border border-white/10">💙 Saldo Mercado Pago</span>
        </div>
        <div id="mpPosnetToggleRow" class="hidden pt-2 border-t border-white/10 flex items-center gap-2 text-[11px] text-gray-300">
          <input type="checkbox" id="checkoutCardPosnetOffline" class="w-3.5 h-3.5 accent-purple-400 cursor-pointer" />
          <label for="checkoutCardPosnetOffline" class="cursor-pointer">Prefiero pagar presencial con Posnet al recibir en mi domicilio</label>
        </div>
      `;
      transferBox.insertAdjacentElement('afterend', mpBox);
      document.getElementById('checkoutCardPosnetOffline')?.addEventListener('change', () => {
        const cur = document.querySelector('input[name="checkout_payment"]:checked')?.value || 'tarjeta';
        this.handlePaymentMethodChange(cur);
      });
    }

    const maxInstEl = document.getElementById('mpInfoMaxInst');
    if (maxInstEl) maxInstEl.textContent = String(cfg.max_installments || 6);

    // Contenedor de Payment Brick Oficial (Tarjetas + Cuotas + Wallet) + Botón Checkout Pro en Modal de Éxito
    const successWaBtn = document.getElementById('successWhatsappLink');
    const actionRow = successWaBtn?.parentElement;
    if (actionRow && !document.getElementById('mpSuccessPaySection')) {
      const mpSuccessBox = document.createElement('div');
      mpSuccessBox.id = 'mpSuccessPaySection';
      mpSuccessBox.className = 'hidden p-4 rounded-2xl bg-gradient-to-br from-sky-950/60 to-slate-900 border border-sky-400/40 space-y-3 shadow-xl';
      mpSuccessBox.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs font-black text-sky-300 flex items-center gap-1.5">
            <span>💳</span> <span>Elegí tu Tarjeta o Mercado Pago</span>
          </div>
          <span id="mpSandboxBadge" class="hidden px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
            Modo Prueba Sandbox
          </span>
        </div>
        <p class="text-[11px] text-gray-300" id="mpSuccessInstructionText">
          Ingresá los datos de tu tarjeta de crédito/débito y cuotas, o iniciá sesión con tu cuenta de Mercado Pago:
        </p>
        <div id="mpPaymentApprovedBanner" class="hidden p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-200 font-bold"></div>
        <div id="mpWalletBrickContainer" class="min-h-[48px]"></div>
        <a id="mpDirectRedirectBtn" href="#" target="_self" class="w-full py-2.5 px-4 rounded-xl bg-[#009EE3]/20 hover:bg-[#009EE3]/30 border border-[#009EE3]/50 text-sky-300 font-bold text-xs text-center flex items-center justify-center gap-2 transition-all">
          <span>🌐 O abrir pantalla externa de Mercado Pago Checkout Pro →</span>
        </a>
      `;
      actionRow.insertAdjacentElement('beforebegin', mpSuccessBox);
    }
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
    document.getElementById('checkoutSuccessModal')?.classList.remove('active');
  },

  handlePaymentMethodChange(method) {
    const transferBox = document.getElementById('transferDetailsBox');
    const mpBox = document.getElementById('mercadoPagoInfoBox');
    const posnetRow = document.getElementById('mpPosnetToggleRow');
    const submitBtn = document.getElementById('submitOrderBtn') || document.getElementById('confirmOrderBtn');
    const mpActive = this.isMercadoPagoActive();
    const useMp = this.shouldProcessWithMercadoPago(method);

    if (method === 'transferencia') {
      transferBox?.classList.remove('hidden');
      mpBox?.classList.add('hidden');
    } else if (method === 'mercadopago' || (method === 'tarjeta' && mpActive)) {
      transferBox?.classList.add('hidden');
      mpBox?.classList.remove('hidden');
      if (posnetRow) {
        if (method === 'tarjeta') posnetRow.classList.remove('hidden');
        else posnetRow.classList.add('hidden');
      }
    } else {
      transferBox?.classList.add('hidden');
      mpBox?.classList.add('hidden');
    }

    if (submitBtn && !submitBtn.disabled) {
      if (useMp) {
        submitBtn.innerHTML = `<span>💳 Continuar con Tarjeta / Mercado Pago →</span>`;
      } else if (submitBtn.id === 'confirmOrderBtn') {
        submitBtn.innerHTML = `<span>Confirmar y Enviar Pedido</span> <span>→</span>`;
      } else {
        submitBtn.innerHTML = `<span>🚀 Confirmar y Enviar Pedido</span>`;
      }
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
      const listPrice = parseFloat(it.price_list) || 0;
      const promoPrice = parseFloat(it.price_promo) || listPrice;
      const p = isPromo ? promoPrice : listPrice;
      const qty = parseInt(it.quantity, 10) || 1;
      itemsTotal += (p * qty);
      listTotal += (listPrice * qty);
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

    // Actualizar DOM en todas las vistas / templates
    const subtotalFmt = '$' + itemsTotal.toLocaleString('es-AR');
    const totalFmt = '$' + finalTotal.toLocaleString('es-AR');

    document.querySelectorAll('#checkoutSummarySubtotal, #checkoutSubtotal').forEach(el => {
      el.textContent = subtotalFmt;
    });

    document.querySelectorAll('#checkoutSummaryShipping').forEach(el => {
      el.innerHTML = shippingDisplay;
    });

    document.querySelectorAll('#checkoutShipping').forEach(el => {
      el.innerHTML = (shippingCost === 0) ? 'Sin cargo' : shippingDisplay;
    });

    document.querySelectorAll('#checkoutSummaryTotal, #checkoutTotal').forEach(el => {
      el.textContent = totalFmt;
    });

    document.querySelectorAll('#checkoutSummarySavings').forEach(el => {
      if (isPromo && savings > 0) {
        el.textContent = `Ahorro aplicado: -$${savings.toLocaleString('es-AR')}`;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    document.querySelectorAll('#checkoutDiscount').forEach(el => {
      el.textContent = (isPromo && savings > 0) ? `-$${savings.toLocaleString('es-AR')}` : '-$0';
    });

    document.querySelectorAll('#checkoutDiscountRow').forEach(el => {
      if (isPromo && savings > 0) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
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
      const listPrice = parseFloat(it.price_list) || 0;
      const promoPrice = parseFloat(it.price_promo) || listPrice;
      const p = isPromo ? promoPrice : listPrice;
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
    const submitBtn = document.getElementById('submitOrderBtn') || document.getElementById('confirmOrderBtn');
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

    // Asegurar campo payment_method (si seleccionó Tarjeta o Mercado Pago con SDK activo, procesar vía Mercado Pago)
    const rawSelectedMethod = document.querySelector('input[name="checkout_payment"]:checked')?.value || 'transferencia';
    const useMpSdk = this.shouldProcessWithMercadoPago(rawSelectedMethod);
    const method = useMpSdk ? 'mercadopago' : rawSelectedMethod;
    formData.set('payment_method', method);

    // Agregar archivo comprobante si fue seleccionado
    if (this.receiptFile) {
      formData.set('receipt', this.receiptFile);
    }

    // Inyectar credenciales de Telegram desde localStorage / settings si el server las necesita
    const s = this.getSettings();
    const token = s.telegram_token || localStorage.getItem('convivia_tg_token') || '';
    const chatId = s.telegram_chat_id || localStorage.getItem('convivia_tg_chat_id') || '';
    if (token) formData.set('telegram_token', token);
    if (chatId) formData.set('telegram_chat_id', chatId);

    try {
      const res = await fetch('/api/checkout.php', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data && data.status === 'success') {
        const orderToSave = data.order;
        if (!orderToSave.items || orderToSave.items.length === 0) {
          orderToSave.items = cart.map(i => {
            const listPrice = parseFloat(i.price_list) || 0;
            const promoPrice = parseFloat(i.price_promo) || listPrice;
            const unitPrice = (method === 'transferencia' || method === 'efectivo') ? promoPrice : listPrice;
            const qty = parseInt(i.quantity, 10) || 1;
            return {
              product_name: i.name,
              weight_kg: i.weight_kg,
              quantity: qty,
              unit_price: unitPrice,
              subtotal: unitPrice * qty
            };
          });
        }
        orderToSave.customer_name = formData.get('customer_name') || orderToSave.customer_name;
        orderToSave.customer_whatsapp = formData.get('customer_whatsapp') || orderToSave.customer_whatsapp;
        orderToSave.customer_address = formData.get('customer_address') || orderToSave.customer_address;

        this.currentOrder = orderToSave;
        this.saveOrderToLocalStorage(orderToSave);
        this.broadcastOrderToCloud(orderToSave);
        this.dispatchTelegramNotification(orderToSave);

        let mpPrefData = null;
        if (method === 'mercadopago') {
          try {
            const mpRes = await fetch('/api/mercadopago.php?action=create_preference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: orderToSave.id,
                order_number: orderToSave.order_number,
                order: orderToSave,
                mp_public_key: this.mpConfig?.public_key || '',
                mp_access_token: this.mpConfig?.sandbox_token || ''
              })
            });
            const mpJson = await mpRes.json();
            if (mpJson && mpJson.status === 'success' && mpJson.preference_id) {
              mpPrefData = mpJson;
              orderToSave.mp_preference_id = mpJson.preference_id;
              this.saveOrderToLocalStorage(orderToSave);
            } else {
              this.showToast(mpJson?.message || 'Aviso Mercado Pago: generá el pago por WhatsApp o Transferencia.');
            }
          } catch (mpErr) {
            console.warn('Error generando preferencia Mercado Pago:', mpErr);
          }
          // Si no se pudo generar preferencia pero tenemos Public Key activa, permitir igual abrir Payment Brick directo con tarjeta
          if (!mpPrefData && this.mpConfig?.public_key) {
            mpPrefData = {
              status: 'fallback',
              preference_id: '',
              public_key: this.mpConfig.public_key,
              sandbox: this.mpConfig.sandbox,
              checkout_url: ''
            };
          }
        }

        // Limpiar carrito de manera segura en ambas vistas
        this.clearCart();

        this.closeModal();
        this.showOrderSuccess(orderToSave, mpPrefData);
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
        const listPrice = parseFloat(i.price_list) || 0;
        const promoPrice = parseFloat(i.price_promo) || listPrice;
        const p = isPromo ? promoPrice : listPrice;
        const qty = parseInt(i.quantity, 10) || 1;
        return `• ${i.name} (x${qty}) - $${Math.round(p * qty).toLocaleString('es-AR')}`;
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
        customer_whatsapp: formData.get('customer_whatsapp') || '',
        customer_address: formData.get('customer_address') || '',
        total: totalNum,
        total_formatted: totalFmt,
        subtotal: totalNum,
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
        cat_weight: formData.get('cat_weight') || '',
        items: cart.map(i => {
          const listPrice = parseFloat(i.price_list) || 0;
          const promoPrice = parseFloat(i.price_promo) || listPrice;
          const unitPrice = isPromo ? promoPrice : listPrice;
          const qty = parseInt(i.quantity, 10) || 1;
          return {
            product_name: i.name,
            weight_kg: i.weight_kg,
            quantity: qty,
            unit_price: unitPrice,
            subtotal: unitPrice * qty
          };
        })
      };

      this.currentOrder = fallbackOrder;
      this.saveOrderToLocalStorage(fallbackOrder);
      this.broadcastOrderToCloud(fallbackOrder);
      this.dispatchTelegramNotification(fallbackOrder);
      this.clearCart();
      this.closeModal();
      this.showOrderSuccess(fallbackOrder);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.id === 'confirmOrderBtn'
          ? `<span>Confirmar y Enviar Pedido</span> <span>→</span>`
          : `<span>🚀 Confirmar y Enviar Pedido</span>`;
      }
    }
  },

  showOrderSuccess(order, mpPref = null) {
    this.lastCompletedOrder = order;
    this.ensureMercadoPagoUI();
    const successModal = document.getElementById('orderSuccessModal') || document.getElementById('checkoutSuccessModal');
    if (!successModal) return;

    const numEl = document.getElementById('successOrderNumber');
    if (numEl) {
      if (numEl.tagName === 'P') {
        numEl.innerHTML = `Tu pedido <strong>#${order.order_number}</strong> ha sido registrado con éxito por un total de <strong>${order.total_formatted || ('$' + Math.round(order.total || 0).toLocaleString('es-AR'))}</strong>. Nos contactaremos de inmediato por WhatsApp para coordinar la entrega en Bahía Blanca.`;
      } else {
        numEl.textContent = order.order_number;
      }
    }

    const totalEl = document.getElementById('successOrderTotal');
    if (totalEl) {
      totalEl.textContent = order.total_formatted || ('$' + Math.round(order.total || 0).toLocaleString('es-AR'));
    }

    const statusBadge = document.getElementById('successOrderStatusBadge');
    if (statusBadge) {
      if (mpPref && mpPref.preference_id) {
        statusBadge.textContent = '💙 Listo para pagar en Mercado Pago';
        statusBadge.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30';
      } else if (order.receipt_url) {
        statusBadge.textContent = '⏳ Comprobante en Verificación';
      } else if (order.payment_method === 'mercadopago') {
        statusBadge.textContent = '⏳ Esperando pago Mercado Pago';
      } else {
        statusBadge.textContent = '✓ En Preparación';
      }
    }

    const payMethod = document.getElementById('successPaymentMethod');
    if (payMethod) {
      payMethod.textContent = order.payment_method === 'mercadopago' ? 'Mercado Pago SDK' : order.payment_method;
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
      const orderTotalStr = order.total_formatted || ('$' + Math.round(order.total || 0).toLocaleString('es-AR'));
      const msg = encodeURIComponent(`¡Hola CONVIVIA! Acabo de registrar el pedido #${order.order_number} por un total de ${orderTotalStr}. Entrega solicitada: ${order.delivery_date || 'A coordinar'} (${order.delivery_time_slot || 'Horario Conforme'}).`);
      const cleanWa = (s.whatsapp_number || '+54 9 291 465-8502').replace(/[^0-9]/g, '');
      waBtn.href = order.whatsapp_url || `https://wa.me/${cleanWa}?text=${msg}`;
    }

    const trackBtn = document.getElementById('successTrackOrderLink');
    if (trackBtn && order.order_number) {
      trackBtn.href = `/rastreo.html?order=${encodeURIComponent(order.order_number)}`;
    }

    // Renderizar Widget / Payment Brick Oficial (Tarjetas + Cuotas + Wallet) de Mercado Pago si corresponde
    this.renderMercadoPagoSuccessWidget(mpPref, order);

    successModal.classList.add('active');
  },

  async renderMercadoPagoSuccessWidget(mpPref, order = null) {
    const mpSection = document.getElementById('mpSuccessPaySection');
    const brickContainer = document.getElementById('mpWalletBrickContainer');
    const directBtn = document.getElementById('mpDirectRedirectBtn');
    const sandboxBadge = document.getElementById('mpSandboxBadge');
    const approvedBanner = document.getElementById('mpPaymentApprovedBanner');

    if (!mpSection) return;
    if (approvedBanner) {
      approvedBanner.classList.add('hidden');
      approvedBanner.innerHTML = '';
    }

    if (!mpPref || (!mpPref.preference_id && !mpPref.public_key)) {
      mpSection.classList.add('hidden');
      return;
    }

    mpSection.classList.remove('hidden');

    if (sandboxBadge) {
      if (mpPref.sandbox) {
        sandboxBadge.classList.remove('hidden');
      } else {
        sandboxBadge.classList.add('hidden');
      }
    }

    const checkoutUrl = mpPref.checkout_url || mpPref.sandbox_init_point || mpPref.init_point || '';
    if (directBtn) {
      if (checkoutUrl) {
        directBtn.href = checkoutUrl;
        directBtn.classList.remove('hidden');
      } else {
        directBtn.classList.add('hidden');
      }
    }

    if (brickContainer) {
      brickContainer.classList.remove('hidden');
      brickContainer.innerHTML = '<div class="text-[11px] text-sky-300/80 font-mono py-3 text-center">⏳ Cargando opciones de Tarjeta y Mercado Pago SDK...</div>';
      try {
        if (this.mpBrickController && typeof this.mpBrickController.unmount === 'function') {
          await this.mpBrickController.unmount().catch(() => {});
          this.mpBrickController = null;
        }
        await this.loadMercadoPagoSDKScript();
        if (window.MercadoPago && mpPref.public_key) {
          brickContainer.innerHTML = '';
          const mp = new window.MercadoPago(mpPref.public_key, { locale: 'es-AR' });
          const bricksBuilder = mp.bricks();
          const targetOrder = order || this.lastCompletedOrder || {};
          const amountVal = Math.max(1, Number(targetOrder.total || 0));
          const maxInst = Number(this.mpConfig?.max_installments || 6);

          const handleBrickPaymentSubmit = ({ selectedPaymentMethod, formData }) => {
            if (selectedPaymentMethod === 'wallet_purchase') {
              return Promise.resolve();
            }
            return new Promise((resolve, reject) => {
              fetch('/api/mercadopago.php?action=process_payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: targetOrder.id || 0,
                  order_number: targetOrder.order_number || '',
                  order: targetOrder,
                  formData: formData,
                  mp_public_key: mpPref.public_key || '',
                  mp_access_token: this.mpConfig?.sandbox_token || ''
                })
              })
              .then(r => r.json())
              .then(resp => {
                if (resp && resp.payment && resp.payment.status === 'approved') {
                  targetOrder.status = 'aprobado';
                  targetOrder.mp_payment_id = resp.payment.id;
                  targetOrder.mp_payment_status = 'approved';
                  this.saveOrderToLocalStorage(targetOrder);
                  this.broadcastOrderToCloud(targetOrder);
                  this.showMercadoPagoPaymentResult('approved', resp);
                  resolve();
                } else if (resp && resp.payment && (resp.payment.status === 'in_process' || resp.payment.status === 'pending' || resp.payment.status === 'authorized')) {
                  targetOrder.status = 'pendiente_validacion';
                  targetOrder.mp_payment_id = resp.payment.id;
                  targetOrder.mp_payment_status = resp.payment.status;
                  this.saveOrderToLocalStorage(targetOrder);
                  this.broadcastOrderToCloud(targetOrder);
                  this.showMercadoPagoPaymentResult('pending', resp);
                  resolve();
                } else {
                  const errMsg = resp?.message || 'Pago rechazado por el emisor. Revisá los datos o probá otra tarjeta.';
                  this.showToast(errMsg);
                  reject(new Error(errMsg));
                }
              })
              .catch(err => {
                console.error('Error procesando pago con Mercado Pago:', err);
                this.showToast('Error conectando con Mercado Pago para procesar el pago.');
                reject(err);
              });
            });
          };

          if (mpPref.preference_id) {
            // Payment Brick completo: Tarjeta de Crédito, Débito, Prepagas, Cuotas y Cuenta Mercado Pago
            const paymentSettings = {
              initialization: {
                amount: amountVal,
                preferenceId: mpPref.preference_id,
                payer: {
                  email: targetOrder.customer_email || 'compras@convivia.com.ar'
                }
              },
              customization: {
                visual: {
                  style: {
                    theme: 'dark'
                  }
                },
                paymentMethods: {
                  creditCard: 'all',
                  debitCard: 'all',
                  prepaidCard: 'all',
                  mercadoPago: 'all',
                  maxInstallments: maxInst
                }
              },
              callbacks: {
                onReady: () => {},
                onSubmit: handleBrickPaymentSubmit,
                onError: (e) => {
                  console.warn('Payment Brick notice:', e);
                }
              }
            };
            this.mpBrickController = await bricksBuilder.create('payment', 'mpWalletBrickContainer', paymentSettings);
          } else {
            // Card Payment Brick directo (sin preferenceId requerido)
            this.mpBrickController = await bricksBuilder.create('cardPayment', 'mpWalletBrickContainer', {
              initialization: {
                amount: amountVal,
                payer: {
                  email: targetOrder.customer_email || 'compras@convivia.com.ar'
                }
              },
              customization: {
                visual: { style: { theme: 'dark' } },
                paymentMethods: { maxInstallments: maxInst }
              },
              callbacks: {
                onReady: () => {},
                onSubmit: (formData) => handleBrickPaymentSubmit({ selectedPaymentMethod: 'credit_card', formData }),
                onError: (e) => console.warn('CardPayment Brick notice:', e)
              }
            });
          }
        } else {
          brickContainer.innerHTML = '';
        }
      } catch (eBrick) {
        console.warn('Payment Brick fallback activo:', eBrick);
        brickContainer.innerHTML = '<div class="text-[11px] text-amber-300 py-1.5">Usá el botón azul inferior para completar tu pago en la página segura de Mercado Pago.</div>';
      }
    }
  },

  showMercadoPagoPaymentResult(state, resp) {
    const approvedBanner = document.getElementById('mpPaymentApprovedBanner');
    const brickContainer = document.getElementById('mpWalletBrickContainer');
    const directBtn = document.getElementById('mpDirectRedirectBtn');
    const statusBadge = document.getElementById('successOrderStatusBadge');
    const instrText = document.getElementById('mpSuccessInstructionText');

    if (brickContainer) brickContainer.classList.add('hidden');
    if (directBtn) directBtn.classList.add('hidden');
    if (instrText) instrText.classList.add('hidden');

    if (state === 'approved') {
      if (statusBadge) {
        statusBadge.textContent = '✓ Pago Aprobado & Stock Reservado';
        statusBadge.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      }
      if (approvedBanner) {
        const p = resp.payment || {};
        approvedBanner.className = 'p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-200 font-bold';
        approvedBanner.innerHTML = `🎉 ¡Pago APROBADO al instante! Operación <code>#${p.id || '-'}</code> (${String(p.payment_method_id || 'TARJETA').toUpperCase()} • ${p.installments || 1}x). Tu stock ya está reservado.`;
        approvedBanner.classList.remove('hidden');
      }
      this.showToast('✓ ¡Pago acreditado en Mercado Pago!');
    } else {
      if (statusBadge) {
        statusBadge.textContent = '⏳ Pago en Proceso MP';
        statusBadge.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
      }
      if (approvedBanner) {
        approvedBanner.className = 'p-3.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-xs text-amber-200 font-bold';
        approvedBanner.innerHTML = `⏳ Tu pago está siendo revisado por Mercado Pago (Operación #${resp.payment?.id || '-'}). Se acreditará automáticamente.`;
        approvedBanner.classList.remove('hidden');
      }
    }
  },

  saveOrderToLocalStorage(order) {
    try {
      localStorage.removeItem('convivia_orders');
      localStorage.removeItem('convivia_last_order');
      localStorage.setItem('convivia_last_order_prod', JSON.stringify(order));
      const orders = JSON.parse(localStorage.getItem('convivia_orders_prod') || '[]');
      const filtered = orders.filter(o => o.order_number !== order.order_number);
      filtered.unshift(order);
      localStorage.setItem('convivia_orders_prod', JSON.stringify(filtered.slice(0, 50)));
      window.dispatchEvent(new CustomEvent('convivia_order_created', { detail: order }));
    } catch (e) {
      console.warn('Error saving order to localStorage:', e);
    }
  },

  broadcastOrderToCloud(order) {
    if (!order) return;
    try {
      const title = `${order.order_number || 'Pedido'} - ${order.customer_name || 'Cliente'}`;
      fetch('https://ntfy.sh/convivia_orders_prod_2914658502', {
        method: 'POST',
        headers: {
          'Title': title,
          'Tags': 'package,dog,bell',
          'Priority': 'high'
        },
        body: JSON.stringify({
          event: 'order_created',
          order: order
        })
      }).catch(e => console.warn('Cloud relay notification notice:', e));
    } catch(e) {}
  },

  async dispatchTelegramNotification(order) {
    if (!order) return;
    try {
      const s = this.getSettings();
      const token = (s.telegram_token || localStorage.getItem('convivia_tg_token') || '').trim();
      const chatId = (s.telegram_chat_id || localStorage.getItem('convivia_tg_chat_id') || '').trim();
      const enabled = (s.telegram_enabled === '1' || s.telegram_enabled === 1 || s.telegram_enabled === true || localStorage.getItem('convivia_tg_enabled') === '1' || (Boolean(token) && Boolean(chatId)));

      if (!token || !chatId || !enabled) return;

      const itemsText = (order.items || []).map(i => `• ${i.quantity || 1}x ${i.product_name || i.name} ($${Math.round(i.subtotal || 0).toLocaleString('es-AR')})`).join('\n');
      const cleanWa = (order.customer_whatsapp || '').replace(/[^0-9]/g, '');

      let textHtml = `🔔 <b>¡NUEVO PEDIDO EN CONVIVIA!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 <b>Orden:</b> <code>${order.order_number}</code>\n` +
        `👤 <b>Cliente:</b> ${order.customer_name}\n` +
        `📱 <b>WhatsApp:</b> <a href="https://wa.me/${cleanWa}">${order.customer_whatsapp}</a>\n` +
        `📍 <b>Dirección:</b> ${order.customer_address}\n` +
        `⏰ <b>Horario:</b> ${order.delivery_date || 'En el día'} | ${order.delivery_time_slot || 'Habitual'}\n` +
        `💳 <b>Método:</b> ${(order.payment_method || 'transferencia').toUpperCase()}\n`;

      if (order.pet_name || order.cat_name) {
        const pets = [];
        if (order.pet_name) pets.push(`🐕 ${order.pet_name} (${order.pet_weight || '?'}kg)`);
        if (order.cat_name) pets.push(`🐈 ${order.cat_name} (${order.cat_weight || '?'}kg)`);
        textHtml += `🐾 <b>Mascotas:</b> ${pets.join(' | ')}\n`;
      }

      textHtml += `━━━━━━━━━━━━━━━━━━━━━━\n<b>Ítems:</b>\n${itemsText}\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 <b>TOTAL: ${order.total_formatted || ('$' + Math.round(order.total || 0).toLocaleString('es-AR'))}</b>\n` +
        `ESTADO: ⏳ <b>Pendiente de comprobante / validación</b>`;

      const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: textHtml,
          parse_mode: 'HTML'
        })
      });

      const resJson = await res.json().catch(() => null);
      if (!resJson || !resJson.ok) {
        // Fallback inmediato en texto plano para asegurar entrega si Telegram rechaza etiquetas HTML
        const plainText = textHtml.replace(/<[^>]*>/g, '');
        await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: plainText
          })
        });
      }
    } catch(err) {
      console.warn('Telegram direct notification fallback notice:', err);
    }
  },

  downloadOrderPdf(targetOrder = null) {
    let o = targetOrder || this.lastCompletedOrder || this.currentOrder;
    if (!o) {
      try {
        const rawLast = localStorage.getItem('convivia_last_order_prod') || localStorage.getItem('convivia_last_order');
        if (rawLast) o = JSON.parse(rawLast);
      } catch(e) {}
    }
    if (!o) {
      try {
        const rawOrders = localStorage.getItem('convivia_orders_prod') || localStorage.getItem('convivia_orders');
        if (rawOrders) {
          const list = JSON.parse(rawOrders);
          if (Array.isArray(list) && list.length > 0) o = list[0];
        }
      } catch(e) {}
    }

    if (!o) {
      this.showToast('No hay un pedido activo para generar el comprobante PDF.');
      return;
    }

    this.activePdfOrder = o;

    const s = this.getSettings();
    const phone = s.whatsapp_number || '+54 9 291 465-8502';
    const storeAddress = s.store_address || 'Bahía Blanca, Buenos Aires';
    const storeEmail = s.store_email || 'contacto@convivia.com.ar';
    const bankAlias = s.bank_alias || 'CONVIVIA.PETS';
    const bankCbu = s.bank_cbu || '0070123130004018293812';
    const bankName = s.bank_name || 'Banco Galicia / Mercado Pago';
    const bankHolder = s.bank_holder || 'CONVIVIA COMUNIDAD ANIMAL';
    const bankCuit = s.bank_cuit || '30-71648291-4';

    const orderNum = o.order_number || 'PW-000000';
    const createdDate = o.created_at ? o.created_at.replace('T', ' ').slice(0, 19) : new Date().toLocaleString('es-AR');
    const custName = o.customer_name || 'Cliente';
    const custWa = o.customer_whatsapp || '-';
    const custAddr = o.customer_address || '-';
    const schedDate = o.delivery_date || 'En el día';
    const schedSlot = o.delivery_time_slot || 'Horario a coordinar';
    const shippingZone = o.shipping_zone || 'Radio Local';
    const shippingCost = parseFloat(o.shipping_cost || 0);
    const payMethod = (o.payment_method || 'transferencia').toUpperCase();

    const items = (o.items && o.items.length > 0) ? o.items : (this.getCart() || []);
    
    let itemsRows = '';
    let calcSubtotal = 0;
    items.forEach((it, idx) => {
      const name = it.product_name || it.name || 'Alimento Balanceado';
      const weight = it.weight_kg ? ` (${it.weight_kg} kg)` : '';
      const qty = parseInt(it.quantity, 10) || 1;
      const unit = parseFloat(it.unit_price || it.price_promo || it.price_list || it.price || 0);
      const sub = parseFloat(it.subtotal || (unit * qty));
      calcSubtotal += sub;

      itemsRows += `
        <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;'}">
          <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; font-size: 13px;">${name}${weight}</td>
          <td style="padding: 10px 12px; text-align: center; color: #475569; font-size: 13px;">${qty}</td>
          <td style="padding: 10px 12px; text-align: right; color: #475569; font-size: 13px;">$${Math.round(unit).toLocaleString('es-AR')}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px;">$${Math.round(sub).toLocaleString('es-AR')}</td>
        </tr>
      `;
    });

    const subtotal = parseFloat(o.subtotal || calcSubtotal);
    const discount = parseFloat(o.discount_amount || 0);
    const total = parseFloat(o.total || (subtotal - discount + shippingCost));
    const totalFormatted = o.total_formatted || ('$' + Math.round(total).toLocaleString('es-AR'));

    let petHtml = '';
    if (o.pet_name || o.cat_name) {
      const pArr = [];
      if (o.pet_name) pArr.push(`🐕 ${o.pet_name} (${o.pet_weight || '?'} kg)`);
      if (o.cat_name) pArr.push(`🐈 ${o.cat_name} (${o.cat_weight || '?'} kg)`);
      petHtml = `
        <div style="margin-top: 10px; padding: 8px 12px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; font-size: 11px; color: #6b21a8;">
          <strong>🐾 Mascota registrada para Smart Bowl:</strong> ${pArr.join(' y ')}
        </div>
      `;
    }

    let bankHtml = '';
    if (o.payment_method === 'transferencia' || !o.payment_method) {
      bankHtml = `
        <div style="margin-top: 18px; padding: 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; font-size: 12px; color: #065f46;">
          <div style="font-weight: 800; font-size: 13px; margin-bottom: 8px; color: #047857;">🏦 Datos para Transferencia Bancaria (Precio Preferencial):</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #065f46;">
            <tr>
              <td style="padding: 4px 8px 4px 0; width: 50%;"><strong>Banco:</strong> ${bankName}</td>
              <td style="padding: 4px 0; width: 50%;"><strong>Titular:</strong> ${bankHolder}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px 4px 0;"><strong>CUIT:</strong> ${bankCuit}</td>
              <td style="padding: 4px 0;"><strong>Alias:</strong> <span style="font-family: monospace; font-weight: bold; background: #d1fae5; padding: 2px 6px; border-radius: 4px;">${bankAlias}</span></td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 4px 0;"><strong>CBU:</strong> <span style="font-family: monospace; font-weight: bold;">${bankCbu}</span></td>
            </tr>
          </table>
          <div style="margin-top: 8px; font-size: 11px; color: #047857;">Envianos el comprobante por WhatsApp al <strong>${phone}</strong> para validar tu pedido y priorizar el despacho.</div>
        </div>
      `;
    }

    const htmlContent = `
      <div id="conviviaPdfInvoice" style="width: 100%; max-width: 794px; margin: 0 auto; background: #ffffff; padding: 36px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.4; box-sizing: border-box;">
        
        <!-- Header -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 3px solid #10b981; padding-bottom: 18px; margin-bottom: 22px;">
          <tr>
            <td style="vertical-align: top;">
              <div style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">
                🐾 CONVIVIA
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                Comunidad Animal • Nutrición Consciente
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 6px; line-height: 1.4;">
                ${storeAddress}<br>
                WhatsApp Oficial: <strong>${phone}</strong> • ${storeEmail}
              </div>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div style="display: inline-block; background: #10b981; color: #ffffff; font-weight: 800; font-size: 11px; padding: 5px 14px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                Comprobante de Pedido
              </div>
              <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 6px; font-family: monospace;">
                ${orderNum}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                Fecha: ${createdDate}
              </div>
            </td>
          </tr>
        </table>

        <!-- Info Grid (Table Layout for 100% canvas rendering reliability) -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 14px 0; margin-left: -14px; margin-bottom: 22px;">
          <tr>
            <td style="width: 50%; vertical-align: top; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.5px;">👤 Datos del Cliente</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${custName}</div>
              <div style="font-size: 12px; color: #334155; margin-top: 4px;">📱 WhatsApp: <strong>${custWa}</strong></div>
              <div style="font-size: 12px; color: #334155; margin-top: 2px;">📍 Entrega: <strong>${custAddr}</strong></div>
              ${petHtml}
            </td>
            <td style="width: 50%; vertical-align: top; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.5px;">🚚 Logística & Horario Conforme</div>
              <div style="font-size: 13px; font-weight: 700; color: #0284c7;">📅 ${schedDate}</div>
              <div style="font-size: 12px; color: #334155; margin-top: 4px;">⏰ Franja Horaria: <strong>${schedSlot}</strong></div>
              <div style="font-size: 12px; color: #334155; margin-top: 2px;">📍 Zona: <strong>${shippingZone}</strong></div>
              <div style="font-size: 12px; color: #334155; margin-top: 2px;">💳 Método de Pago: <strong style="color: #047857;">${payMethod}</strong></div>
            </td>
          </tr>
        </table>

        <!-- Tabla Productos -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; text-align: left;">
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; border-top-left-radius: 8px;">Alimento / Producto</th>
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center;">Cant.</th>
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: right;">Unitario</th>
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: right; border-top-right-radius: 8px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Totales -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="width: 55%; vertical-align: top;"></td>
            <td style="width: 45%; vertical-align: top;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: #64748b;">
                  <span>Subtotal:</span>
                  <span style="font-family: monospace; font-weight: 600;">$${Math.round(subtotal).toLocaleString('es-AR')}</span>
                </div>
                ${discount > 0 ? `
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: #059669; font-weight: 600;">
                    <span>Ahorro Transferencia / Promo:</span>
                    <span style="font-family: monospace;">-$${Math.round(discount).toLocaleString('es-AR')}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; color: #64748b;">
                  <span>Costo de Envío:</span>
                  <span style="font-family: monospace; font-weight: 600;">${shippingCost > 0 ? '+$' + Math.round(shippingCost).toLocaleString('es-AR') : 'GRATIS ($0)'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 8px;">
                  <span>TOTAL FINAL:</span>
                  <span style="color: #047857; font-family: monospace;">${totalFormatted}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        ${bankHtml}

        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
          <div>¡Muchas gracias por elegirnos para el cuidado y alimentación de tu mascota! 🐾</div>
          <div style="margin-top: 2px;">CONVIVIA Petshop • Bahía Blanca • Atención personalizada por WhatsApp: ${phone}</div>
        </div>

      </div>
    `;

    this.showPdfPreviewModal(htmlContent, orderNum);
  },

  showPdfPreviewModal(htmlContent, orderNum) {
    this.currentPdfOrderNum = orderNum;
    this.currentPdfHtml = htmlContent;

    let modal = document.getElementById('conviviaPdfModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'conviviaPdfModal';
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(2, 6, 23, 0.94); z-index: 100000; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; overflow-y: auto; padding: 20px 10px; box-sizing: border-box;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <!-- Barra Superior Flotante -->
      <div style="width: 100%; max-width: 794px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 12px 18px; margin-bottom: 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 22px;">📄</span>
          <div>
            <div style="font-weight: 800; font-size: 13px; color: #fff;">Comprobante de Pedido #${orderNum}</div>
            <div style="font-size: 11px; color: #94a3b8;">Formato A4 Oficial CONVIVIA</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btnModalSavePdf" onclick="Checkout.savePdfFromPreview()" style="background: #10b981; color: #022c22; font-weight: 800; font-size: 12px; padding: 8px 16px; border-radius: 10px; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
            <span>💾</span> <span>Descargar PDF</span>
          </button>
          <button onclick="Checkout.printPdfFromPreview()" style="background: rgba(255,255,255,0.1); color: #fff; font-weight: 700; font-size: 12px; padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>🖨️</span> <span>Imprimir / PDF</span>
          </button>
          <button onclick="Checkout.closePdfPreview()" style="background: transparent; color: #94a3b8; font-size: 20px; font-weight: bold; border: none; cursor: pointer; padding: 4px 10px;" title="Cerrar vista previa">
            ✕
          </button>
        </div>
      </div>

      <!-- Contenedor Visible de la Factura A4 -->
      <div id="conviviaPdfPreviewContent" style="width: 100%; max-width: 794px; background: #ffffff; border-radius: 10px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); overflow: hidden; margin-bottom: 40px;">
        ${htmlContent}
      </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Disparar automáticamente la descarga del PDF sobre el elemento visible en pantalla
    setTimeout(() => {
      this.savePdfFromPreview();
    }, 400);
  },

  savePdfFromPreview() {
    const targetEl = document.getElementById('conviviaPdfInvoice');
    if (!targetEl) return;

    const orderNum = this.currentPdfOrderNum || 'PW-000000';
    const btn = document.getElementById('btnModalSavePdf');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>Generando PDF...</span>';
    }

    // Clonar elemento en un contenedor temporal en la parte superior del documento para evitar problemas de scroll o backdrop-filter
    const existingClone = document.getElementById('convivia-pdf-render-clone');
    if (existingClone) existingClone.remove();

    const renderClone = targetEl.cloneNode(true);
    renderClone.id = 'convivia-pdf-render-clone';
    renderClone.style.position = 'fixed';
    renderClone.style.top = '0px';
    renderClone.style.left = '0px';
    renderClone.style.zIndex = '999999';
    renderClone.style.backgroundColor = '#ffffff';
    renderClone.style.width = '794px';
    renderClone.style.maxWidth = '794px';
    renderClone.style.margin = '0';
    renderClone.style.display = 'block';
    renderClone.style.visibility = 'visible';
    document.body.appendChild(renderClone);

    const opt = {
      margin: [6, 6, 6, 6],
      filename: `Pedido-CONVIVIA-${orderNum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
        x: 0,
        y: 0,
        windowWidth: 800
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const cleanup = () => {
      try {
        const el = document.getElementById('convivia-pdf-render-clone');
        if (el) el.remove();
      } catch(e) {}
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>💾</span> <span>Descargar PDF</span>';
      }
    };

    const doDownload = () => {
      if (!window.html2pdf) {
        cleanup();
        this.printPdfFromPreview();
        return;
      }

      window.html2pdf().set(opt).from(renderClone).save().then(() => {
        cleanup();
        if (btn) btn.innerHTML = '<span>✓</span> <span>¡PDF Descargado!</span>';
        Checkout.showToast('✓ ¡Comprobante PDF descargado exitosamente!');
        setTimeout(() => {
          if (btn) btn.innerHTML = '<span>💾</span> <span>Descargar PDF</span>';
        }, 2500);
      }).catch(err => {
        console.error('Error generando PDF con html2pdf, recurriendo a impresión directa:', err);
        cleanup();
        this.printPdfFromPreview();
      });
    };

    if (window.html2pdf) {
      setTimeout(doDownload, 100);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => setTimeout(doDownload, 150);
      script.onerror = () => {
        cleanup();
        this.printPdfFromPreview();
      };
      document.head.appendChild(script);
    }
  },

  printPdfFromPreview() {
    const existing = document.getElementById('convivia-print-frame');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'convivia-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Pedido - CONVIVIA</title>
        <style>
          @page { size: A4; margin: 8mm; }
          body { margin: 0; padding: 0; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        </style>
      </head>
      <body>
        ${this.currentPdfHtml || document.getElementById('conviviaPdfInvoice')?.outerHTML || ''}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  },

  closePdfPreview() {
    const modal = document.getElementById('conviviaPdfModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
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
