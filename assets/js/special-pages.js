// assets/js/special-pages.js - Lógica interactiva para páginas temáticas de CONVIVIA:
// Packs Funcionales, Destacados del Mes, Precio Preferencial y Beneficio Exclusivo (Comunidad Convivial)

const SpecialPages = {
  state: {
    pageType: '', // 'packs' | 'destacados' | 'precio_preferencial' | 'beneficio_exclusivo'
    priceMode: 'promo', // 'promo' (preferencial) | 'list' (tarjeta)
    products: [],
    allProducts: [],
    settings: {},
    cart: [],
    animalFilter: 'todos'
  },

  async init(pageType) {
    this.state.pageType = pageType;
    this.loadCartFromStorage();
    this.bindCommonEvents();
    await this.loadSettings();
    this.updateCartBadge();

    if (pageType === 'packs') {
      await this.loadPacksData();
    } else if (pageType === 'destacados') {
      await this.loadDestacadosData();
    } else if (pageType === 'precio_preferencial') {
      await this.loadPrecioPreferencialData();
    } else if (pageType === 'beneficio_exclusivo') {
      await this.loadBeneficioExclusivoData();
    }
  },

  bindCommonEvents() {
    // Switch de Precios Duales (Preferencial vs Tarjeta)
    const switchPromo = document.getElementById('switchModePromo');
    const switchList = document.getElementById('switchModeList');
    if (switchPromo && switchList) {
      switchPromo.addEventListener('click', () => this.setPriceMode('promo'));
      switchList.addEventListener('click', () => this.setPriceMode('list'));
    }

    // Carrito
    document.getElementById('cartBtn')?.addEventListener('click', () => this.openCart());
    document.getElementById('closeCartBtn')?.addEventListener('click', () => this.closeCart());
    document.getElementById('cartDrawerOverlay')?.addEventListener('click', () => this.closeCart());

    // Menú Hamburguesa
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => this.openMobileMenu());
    document.getElementById('closeMobileNavBtn')?.addEventListener('click', () => this.closeMobileMenu());
    document.getElementById('mobileNavOverlay')?.addEventListener('click', () => this.closeMobileMenu());

    // Tecla ESC para cerrar modales
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMobileMenu();
        this.closeCart();
      }
    });
  },

  async loadSettings() {
    try {
      const res = await fetch(`/api/settings.php?_t=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success') {
        this.state.settings = data.settings;
        this.applySettingsToDOM();
        return;
      }
    } catch (e) {
      try {
        const res = await fetch(`/assets/data/settings.json?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success') {
          this.state.settings = data.settings;
          this.applySettingsToDOM();
        }
      } catch (err2) {
        console.warn('Fallback settings no disponible:', err2);
      }
    }
  },

  applySettingsToDOM() {
    const s = this.state.settings;
    if (!s) return;
    const rawGenEnabled = s.discount_transfer_enabled !== '0' && s.discount_transfer_enabled !== 0 && s.discount_transfer_enabled !== false;
    const discount = (s.discount_transfer_percent !== undefined && s.discount_transfer_percent !== null && s.discount_transfer_percent !== '') 
      ? parseFloat(s.discount_transfer_percent) 
      : 0;
    this.state.generalDiscountEnabled = rawGenEnabled && discount > 0;
    this.state.generalDiscountPercent = this.state.generalDiscountEnabled ? discount : 0;

    const topText = document.getElementById('shippingTopText');
    if (topText && s.shipping_top_text) {
      topText.textContent = `🚚 ${s.shipping_top_text}`;
    }
    const drawerWa = document.getElementById('drawerWhatsappBtn');
    if (drawerWa && s.whatsapp_number) {
      const clean = s.whatsapp_number.replace(/[^\d]/g, '');
      drawerWa.href = `https://wa.me/${clean}`;
    }
  },

  // ==========================================
  // CARGA DE DATOS POR PÁGINA
  // ==========================================

  async loadPacksData() {
    const container = document.getElementById('packsContainer');
    if (!container) return;
    this.renderLoading(container);

    try {
      const res = await fetch(`/api/products.php?packs=1&_t=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.packs)) {
        this.state.products = data.packs;
        this.renderPacksCards(data.packs, container);
        return;
      }
    } catch (e) {
      console.warn('Fallback packs a products.json:', e);
      try {
        const res = await fetch(`/assets/data/products.json?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          const packs = data.products.filter(p => p.pack_funcional == 1 || p.category === 'pack_funcional');
          this.state.products = packs;
          this.renderPacksCards(packs, container);
          return;
        }
      } catch (err2) {
        console.error('Error cargando packs:', err2);
      }
    }
    container.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs">No se pudieron cargar los Packs Funcionales. Intente nuevamente.</div>`;
  },

  async loadDestacadosData() {
    const container = document.getElementById('destacadosGrid');
    if (!container) return;
    this.renderLoading(container);

    try {
      const res = await fetch(`/api/products.php?destacados=1&_t=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.products)) {
        this.state.allProducts = data.products;
        this.state.products = data.products;
        this.renderDestacadosGrid();
        return;
      }
    } catch (e) {
      console.warn('Fallback destacados a products.json:', e);
      try {
        const res = await fetch(`/assets/data/products.json?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          const list = data.products.filter(p => p.destacado_mes == 1 || p.is_featured == 1);
          this.state.allProducts = list;
          this.state.products = list;
          this.renderDestacadosGrid();
          return;
        }
      } catch (err2) {
        console.error('Error cargando destacados:', err2);
      }
    }
    container.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs">No se pudieron cargar los productos destacados.</div>`;
  },

  async loadPrecioPreferencialData() {
    const container = document.getElementById('precioPreferencialGrid');
    if (!container) return;
    this.renderLoading(container);

    try {
      const res = await fetch(`/api/products.php?precio_preferencial=1&_t=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.products)) {
        this.state.allProducts = data.products;
        this.state.products = data.products;
        this.renderPrecioPreferencialGrid();
        return;
      }
    } catch (e) {
      console.warn('Fallback precio preferencial a products.json:', e);
      try {
        const res = await fetch(`/assets/data/products.json?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          const list = data.products.filter(p => p.has_preferential_price || (p.precio_preferencial && parseFloat(p.precio_preferencial) > 0));
          this.state.allProducts = list;
          this.state.products = list;
          this.renderPrecioPreferencialGrid();
          return;
        }
      } catch (err2) {
        console.error('Error cargando precio preferencial:', err2);
      }
    }
    container.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs">No se pudieron cargar los productos con precio preferencial.</div>`;
  },

  async loadBeneficioExclusivoData() {
    const container = document.getElementById('beneficioExclusivoGrid');
    if (!container) return;
    this.renderLoading(container);

    try {
      const res = await fetch(`/api/products.php?beneficio_exclusivo=1&_t=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.products)) {
        this.state.allProducts = data.products;
        this.state.products = data.products;
        this.renderBeneficioExclusivoGrid();
        return;
      }
    } catch (e) {
      console.warn('Fallback beneficio exclusivo a products.json:', e);
      try {
        const res = await fetch(`/assets/data/products.json?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          const list = data.products.filter(p => p.beneficio_exclusivo && p.beneficio_exclusivo.trim() !== '');
          this.state.allProducts = list;
          this.state.products = list;
          this.renderBeneficioExclusivoGrid();
          return;
        }
      } catch (err2) {
        console.error('Error cargando beneficios exclusivos:', err2);
      }
    }
    container.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs">No se pudieron cargar los productos con beneficio exclusivo.</div>`;
  },

  renderLoading(el) {
    el.innerHTML = `
      <div class="col-span-full py-16 text-center text-gray-400 space-y-3">
        <div class="inline-block animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-emerald-400"></div>
        <p class="text-xs font-semibold text-gray-300">Sincronizando información en tiempo real...</p>
      </div>
    `;
  },

  // ==========================================
  // RENDER PACKS FUNCIONALES
  // ==========================================

  renderPacksCards(packs, container) {
    if (!packs || packs.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-gray-400 text-xs">No hay packs funcionales activos actualmente.</div>`;
      return;
    }

    const isPromo = this.state.priceMode === 'promo';

    container.innerHTML = packs.map(pack => {
      const isPromo = this.state.priceMode === 'promo';
      const hasGeneral = Boolean(this.state.generalDiscountEnabled && this.state.generalDiscountPercent > 0);
      const hasIndividual = Boolean(pack.has_custom_discount && pack.savings > 0 && Math.round(pack.savings_percent) > 0);
      const hasActiveDiscount = hasIndividual || (hasGeneral && pack.savings > 0 && Math.round(pack.savings_percent) > 0);

      const mainPrice = (isPromo && hasActiveDiscount) ? pack.price_promo : pack.price_list;
      const listPrice = pack.price_list;
      const savings = (isPromo && hasActiveDiscount && listPrice > mainPrice) ? Math.max(0, listPrice - mainPrice) : 0;

      let itemsHtml = '';
      if (Array.isArray(pack.items) && pack.items.length > 0) {
        itemsHtml = `
          <div class="mt-4 pt-3 border-t border-white/10 space-y-2">
            <span class="text-[11px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <span>📦</span> Incluye en el combo:
            </span>
            <div class="space-y-1.5">
              ${pack.items.map(it => `
                <div class="flex items-center gap-2.5 p-2 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300">
                  <div class="w-8 h-8 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img src="${it.image_url}" alt="${it.name}" class="w-full h-full object-contain" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-white truncate text-[11px]">${it.name}</div>
                    <div class="text-[10px] text-gray-400">${it.brand} • ${it.weight_kg} kg ${it.quantity > 1 ? `(x${it.quantity})` : ''}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="glass-card rounded-3xl p-5 sm:p-6 border border-emerald-500/25 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-xl bg-gradient-to-b from-[#0b1222]/90 to-[#060a14]/90">
          
          <!-- Badge Superior -->
          <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span>🎁</span> <span>Combo Funcional</span>
            </span>
            <span class="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-lg border border-purple-500/30">
              ⚖️ ${pack.weight_kg} kg
            </span>
          </div>

          <!-- Imagen del Pack & Detalle -->
          <div class="pt-4 space-y-4">
            <div class="relative h-48 sm:h-56 w-full flex items-center justify-center p-2 rounded-2xl bg-black/30 border border-white/5 overflow-hidden">
              <img src="${pack.image_url}" alt="${pack.name}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" />
            </div>

            <div class="space-y-1.5">
              <span class="text-[10px] font-bold uppercase text-purple-400 tracking-wider font-mono">CONVIVIA Packs Especiales</span>
              <h3 class="text-base sm:text-lg font-black text-white leading-snug group-hover:text-emerald-300 transition-colors">
                ${pack.name}
              </h3>
              <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                ${pack.description || 'Nutrición potente y balanceada combinada con suplementos de alta calidad.'}
              </p>
            </div>

            <!-- Beneficio Exclusivo Badge -->
            ${pack.beneficio_exclusivo ? `
              <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
                <span class="text-base flex-shrink-0">✨</span>
                <span class="leading-tight">${pack.beneficio_exclusivo}</span>
              </div>
            ` : ''}

            <!-- Componentes del combo -->
            ${itemsHtml}
          </div>

          <!-- Precios & Botones de Compra -->
          <div class="pt-5 mt-4 border-t border-white/10 space-y-3">
            <div class="flex items-baseline justify-between">
              <div>
                <div class="flex items-center gap-1 text-[11px] font-bold ${savings > 0 ? 'text-emerald-400' : 'text-gray-400'}">
                  <span>${savings > 0 ? '⚡' : '📦'}</span> <span>${savings > 0 ? (pack.has_custom_discount ? 'OFERTA INDIVIDUAL:' : 'PRECIO PREFERENCIAL:') : 'PRECIO DEL COMBO:'}</span>
                </div>
                <div class="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  $${mainPrice.toLocaleString('es-AR')}
                </div>
              </div>
              ${savings > 0 ? `
                <div class="text-right">
                  <div class="text-[10px] text-gray-400">Precio Lista:</div>
                  <div class="text-xs font-mono text-gray-500 line-through">$${listPrice.toLocaleString('es-AR')}</div>
                  <div class="text-[10px] font-bold text-emerald-400 font-mono">Ahorrás $${savings.toLocaleString('es-AR')}</div>
                </div>
              ` : ''}
            </div>

            <p class="text-[10px] text-gray-400 leading-tight">
              ${savings > 0 ? 'Precio con descuento exclusivo pagando con Transferencia Bancaria o Efectivo.' : 'Precio oficial de fábrica en Bahía Blanca.'}
            </p>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <button 
                type="button" 
                onclick="SpecialPages.addToCartById(${pack.id})" 
                class="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow"
              >
                <span>🛒 Sumar</span>
              </button>
              <button 
                type="button" 
                onclick="SpecialPages.buyNowById(${pack.id})" 
                class="py-2.5 px-3 rounded-xl btn-primary-neon font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <span>⚡ Comprar</span>
              </button>
            </div>

            <div class="text-center pt-1">
              <a href="/product.html?slug=${pack.slug}" class="text-[11px] text-gray-400 hover:text-emerald-300 font-semibold transition-colors underline">
                Ver detalle técnico y ficha completa →
              </a>
            </div>

          </div>

        </div>
      `;
    }).join('');
  },

  // ==========================================
  // RENDER DESTACADOS DEL MES
  // ==========================================

  filterAnimal(animal) {
    this.state.animalFilter = animal;
    document.querySelectorAll('.tab-animal-filter').forEach(btn => {
      if (btn.dataset.animal === animal) {
        btn.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/15');
        btn.classList.remove('border-white/10', 'text-gray-400', 'bg-black/40');
      } else {
        btn.classList.remove('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/15');
        btn.classList.add('border-white/10', 'text-gray-400', 'bg-black/40');
      }
    });

    if (this.state.pageType === 'destacados') {
      this.renderDestacadosGrid();
    } else if (this.state.pageType === 'precio_preferencial') {
      this.renderPrecioPreferencialGrid();
    } else if (this.state.pageType === 'beneficio_exclusivo') {
      this.renderBeneficioExclusivoGrid();
    }
  },

  renderDestacadosGrid() {
    const container = document.getElementById('destacadosGrid');
    if (!container) return;

    let list = this.state.allProducts;
    if (this.state.animalFilter !== 'todos') {
      list = list.filter(p => p.animal && p.animal.toLowerCase() === this.state.animalFilter.toLowerCase());
    }

    if (list.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-gray-400 text-xs">No hay productos destacados para este filtro.</div>`;
      return;
    }

    container.innerHTML = list.map(p => this.createProductCardHtml(p, 'destacado')).join('');
  },

  renderPrecioPreferencialGrid() {
    const container = document.getElementById('precioPreferencialGrid');
    if (!container) return;

    let list = this.state.allProducts;
    if (this.state.animalFilter !== 'todos') {
      list = list.filter(p => p.animal && p.animal.toLowerCase() === this.state.animalFilter.toLowerCase());
    }

    if (list.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-gray-400 text-xs">No hay productos para este filtro.</div>`;
      return;
    }

    container.innerHTML = list.map(p => this.createProductCardHtml(p, 'preferencial')).join('');
  },

  renderBeneficioExclusivoGrid() {
    const container = document.getElementById('beneficioExclusivoGrid');
    if (!container) return;

    let list = this.state.allProducts;
    if (this.state.animalFilter !== 'todos') {
      list = list.filter(p => p.animal && p.animal.toLowerCase() === this.state.animalFilter.toLowerCase());
    }

    if (list.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-gray-400 text-xs">No hay productos con beneficios exclusivos para este filtro.</div>`;
      return;
    }

    container.innerHTML = list.map(p => this.createProductCardHtml(p, 'beneficio')).join('');
  },

  createProductCardHtml(p, context) {
    const isPromo = this.state.priceMode === 'promo';
    const hasGeneral = Boolean(this.state.generalDiscountEnabled && this.state.generalDiscountPercent > 0);
    const hasIndividual = Boolean(p.has_custom_discount && p.savings > 0 && Math.round(p.savings_percent) > 0);
    const hasActiveDiscount = hasIndividual || (hasGeneral && p.savings > 0 && Math.round(p.savings_percent) > 0);

    const mainPrice = (isPromo && hasActiveDiscount) ? p.price_promo : p.price_list;
    const listPrice = p.price_list;
    const savings = (isPromo && hasActiveDiscount && listPrice > mainPrice) ? Math.max(0, listPrice - mainPrice) : 0;

    return `
      <div class="glass-card rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-white/10 flex flex-col justify-between group hover:border-emerald-500/40 transition-all bg-[#090f1d]/85 shadow-lg relative">
        
        <!-- Top Tags -->
        <div class="flex items-center justify-between gap-1.5 pb-2 sm:pb-3 border-b border-white/5">
          <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono truncate">
            ${p.brand}
          </span>
          <span class="text-[9px] sm:text-xs font-mono font-bold text-gray-300">
            ⚖️ ${p.weight_kg} kg
          </span>
        </div>

        <!-- Product Image & Info -->
        <div class="py-3 sm:py-4 space-y-2">
          <a href="/product.html?slug=${p.slug}" class="block relative h-36 sm:h-48 w-full flex items-center justify-center p-2 rounded-xl bg-black/30 border border-white/5 overflow-hidden">
            <img src="${p.image_url}" alt="${p.name}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" />
          </a>

          <div>
            <a href="/product.html?slug=${p.slug}" class="font-extrabold text-white text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-emerald-300 transition-colors block">
              ${p.name}
            </a>
          </div>

          ${p.beneficio_exclusivo ? `
            <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 leading-tight">
              <span>🎁</span>
              <span class="truncate">${p.beneficio_exclusivo}</span>
            </div>
          ` : ''}
        </div>

        <!-- Price & Buttons -->
        <div class="pt-3 border-t border-white/5 space-y-2">
          <div>
            ${savings > 0 ? `
              <div class="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-400">
                <span>⚡</span> <span>${p.has_custom_discount ? 'OFERTA INDIVIDUAL:' : 'PRECIO PREFERENCIAL:'}</span>
              </div>
            ` : `
              <div class="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-400">
                <span>🐾</span> <span>PRECIO DE LISTA:</span>
              </div>
            `}
            <div class="flex items-baseline justify-between">
              <span class="text-lg sm:text-2xl font-black text-emerald-400 font-mono">
                $${mainPrice.toLocaleString('es-AR')}
              </span>
              ${savings > 0 ? `
                <span class="text-[10px] sm:text-xs font-mono text-gray-500 line-through">
                  $${listPrice.toLocaleString('es-AR')}
                </span>
              ` : ''}
            </div>
            ${savings > 0 ? `<div class="text-[9px] sm:text-[10px] font-bold text-emerald-400 font-mono">Ahorrás $${savings.toLocaleString('es-AR')}</div>` : ''}
          </div>

          <div class="grid grid-cols-2 gap-1.5 pt-1">
            <button 
              type="button" 
              onclick="SpecialPages.addToCartById(${p.id})" 
              class="py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all"
            >
              <span>🛒 Sumar</span>
            </button>
            <button 
              type="button" 
              onclick="SpecialPages.buyNowById(${p.id})" 
              class="py-2 px-2 rounded-xl btn-primary-neon font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow"
            >
              <span>⚡ Comprar</span>
            </button>
          </div>
        </div>

      </div>
    `;
  },

  // ==========================================
  // MANEJO DE PRECIOS GLOBALES (DUAL SWITCH)
  // ==========================================

  setPriceMode(mode) {
    this.state.priceMode = mode;
    const switchPromo = document.getElementById('switchModePromo');
    const switchList = document.getElementById('switchModeList');

    if (mode === 'promo') {
      switchPromo?.classList.add('active');
      switchList?.classList.remove('active');
    } else {
      switchList?.classList.add('active');
      switchPromo?.classList.remove('active');
    }

    if (this.state.pageType === 'packs') {
      this.renderPacksCards(this.state.products, document.getElementById('packsContainer'));
    } else if (this.state.pageType === 'destacados') {
      this.renderDestacadosGrid();
    } else if (this.state.pageType === 'precio_preferencial') {
      this.renderPrecioPreferencialGrid();
    } else if (this.state.pageType === 'beneficio_exclusivo') {
      this.renderBeneficioExclusivoGrid();
    }

    this.renderCartItems();
    this.showToast(mode === 'promo' ? '⚡ Modo Precio Preferencial activado' : '💳 Modo Precio de Lista (Tarjetas) activado');
  },

  // ==========================================
  // CARRITO & COMPRA RÁPIDA
  // ==========================================

  loadCartFromStorage() {
    try {
      this.state.cart = JSON.parse(localStorage.getItem('convivia_cart') || localStorage.getItem('pawpulse_cart') || '[]');
    } catch (e) {
      this.state.cart = [];
    }
  },

  saveCart() {
    localStorage.setItem('convivia_cart', JSON.stringify(this.state.cart));
    localStorage.setItem('pawpulse_cart', JSON.stringify(this.state.cart));
  },

  updateCartBadge() {
    const count = this.state.cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
    const badges = document.querySelectorAll('#cartCountBadge, #bottomBarCartBadge, .cart-count-badge');
    badges.forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    });
  },

  addToCartById(id) {
    const p = (this.state.products || []).find(item => item.id === id) || (this.state.allProducts || []).find(item => item.id === id);
    if (!p) return;

    const existing = this.state.cart.find(it => it.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.state.cart.push({
        id: p.id,
        name: p.name,
        brand: p.brand,
        weight_kg: p.weight_kg,
        price_list: p.price_list,
        price_promo: p.has_preferential_price ? (p.precio_preferencial_promo || p.precio_preferencial) : (p.price_promo || p.price_list),
        image_url: p.image_url,
        quantity: 1
      });
    }

    this.saveCart();
    this.updateCartBadge();
    this.showToast(`🐾 ${p.name} sumado al carrito.`);
  },

  buyNowById(id) {
    this.addToCartById(id);
    if (typeof Checkout !== 'undefined') {
      this.closeCart();
      Checkout.open();
    } else {
      this.openCart();
    }
  },

  openCart() {
    this.renderCartItems();
    document.getElementById('cartDrawer')?.classList.add('active');
    document.getElementById('cartDrawerOverlay')?.classList.remove('hidden');
  },

  closeCart() {
    document.getElementById('cartDrawer')?.classList.remove('active');
    document.getElementById('cartDrawerOverlay')?.classList.add('hidden');
  },

  renderCartItems() {
    const container = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('cartEmptyState');
    if (!container) return;

    if (this.state.cart.length === 0) {
      container.innerHTML = '';
      emptyState?.classList.remove('hidden');
      this.updateCartSummary(0, 0);
      return;
    }

    emptyState?.classList.add('hidden');
    const isPromo = this.state.priceMode === 'promo';

    let total = 0;
    let listTotal = 0;

    container.innerHTML = this.state.cart.map((item, idx) => {
      const unitPrice = isPromo ? item.price_promo : item.price_list;
      const sub = unitPrice * item.quantity;
      const listSub = item.price_list * item.quantity;
      total += sub;
      listTotal += listSub;

      return `
        <div class="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
          <div class="w-12 h-12 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
            <img src="${item.image_url}" alt="${item.name}" class="w-full h-full object-contain" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-white truncate text-xs">${item.name}</div>
            <div class="text-[10px] text-gray-400">${item.brand} • ${item.weight_kg}kg</div>
            <div class="text-xs font-mono font-bold text-emerald-400">$${unitPrice.toLocaleString('es-AR')}</div>
          </div>
          <div class="flex items-center gap-1 bg-black/60 rounded-lg p-0.5 border border-white/10">
            <button type="button" onclick="SpecialPages.changeQty(${idx}, -1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white font-bold text-sm">-</button>
            <span class="w-5 text-center font-mono font-bold text-xs text-white">${item.quantity}</span>
            <button type="button" onclick="SpecialPages.changeQty(${idx}, 1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white font-bold text-sm">+</button>
          </div>
        </div>
      `;
    }).join('');

    const savings = Math.max(0, listTotal - total);
    this.updateCartSummary(total, savings);
  },

  changeQty(idx, delta) {
    if (!this.state.cart[idx]) return;
    this.state.cart[idx].quantity += delta;
    if (this.state.cart[idx].quantity <= 0) {
      this.state.cart.splice(idx, 1);
    }
    this.saveCart();
    this.updateCartBadge();
    this.renderCartItems();
  },

  updateCartSummary(total, savings) {
    const totalEl = document.getElementById('cartDrawerTotal') || document.getElementById('cartTotalLabel');
    if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-AR')}`;

    const savingsEl = document.getElementById('cartDrawerSavings') || document.getElementById('cartSavingsLabel');
    if (savingsEl) {
      if (savings > 0) {
        savingsEl.textContent = `Ahorrás $${savings.toLocaleString('es-AR')} con Transferencia`;
        savingsEl.classList.remove('hidden');
      } else {
        savingsEl.classList.add('hidden');
      }
    }
  },

  // ==========================================
  // MENÚ DRAWER & MARCAS SELECCIONABLES
  // ==========================================

  openMobileMenu() {
    document.getElementById('mobileNavDrawer')?.classList.add('active');
    document.getElementById('mobileNavOverlay')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeMobileMenu() {
    document.getElementById('mobileNavDrawer')?.classList.remove('active');
    document.getElementById('mobileNavOverlay')?.classList.add('hidden');
    document.body.style.overflow = '';
  },

  selectBrandDirect(brandName) {
    this.closeMobileMenu();
    if (!brandName || brandName === 'todas') {
      window.location.href = '/#catalogAnchor';
    } else {
      window.location.href = `/?brand=${encodeURIComponent(brandName)}#catalogAnchor`;
    }
  },

  filterByAnimal(animal) {
    this.closeMobileMenu();
    window.location.href = `/?animal=${encodeURIComponent(animal)}#catalogAnchor`;
  },

  showToast(msg) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }
};

// Control de botón flotante Volver Arriba
window.addEventListener('scroll', () => {
  const topBtn = document.getElementById('scrollTopBtn');
  if (topBtn) {
    if (window.pageYOffset > 380) {
      topBtn.classList.add('visible');
    } else {
      topBtn.classList.remove('visible');
    }
  }
}, { passive: true });

// Exponer como App para interoperabilidad universal con checkout.js
window.App = SpecialPages;
window.SpecialPages = SpecialPages;
