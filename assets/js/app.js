// assets/js/app.js - Lógica Principal con Soporte para Configuraciones Dinámicas

const App = {
  state: {
    products: [],
    facets: {},
    settings: {},
    cart: JSON.parse(localStorage.getItem('convivia_cart') || localStorage.getItem('pawpulse_cart') || '[]'),
    priceMode: 'promo',
    pagination: {
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 1
    },
    filters: {
      search: '',
      animal: 'todos',
      life_stage: 'todos',
      breed_size: 'todas',
      brand: 'todas',
      weight: '',
      sort: 'featured'
    },
    brands: [],
    smartBowl: {
      petType: 'perro', // perro, gato, ambos
      dogWeight: 25,
      dogBag: 15,
      dogStage: 'adulto',
      catWeight: 4.0,
      catBag: 7.5,
      catStage: 'adulto',
      selectedBrand: 'todas',
      activeCalendarView: 'dog',
      activeSuggestedView: 'dog',
      schedule: null,
      suggestedFoods: null
    }
  },

  async init() {
    this.bindEvents();
    await this.loadSettings();
    await this.loadBrands();
    this.loadDestacadoMes();
    this.loadPacksFuncionales();
    this.loadProducts();
    this.updateCartBadge();
    this.initSmartBowl();
  },

  async loadDestacadoMes() {
    try {
      const res = await fetch('/api/products.php?destacado_mes=1');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success' && data.product) {
        this.state.destacadoMes = data.product;
        this.renderDestacadoMes();
        return;
      }
    } catch (e) {
      console.warn('Fallback a products.json para Destacado del Mes');
      try {
        const res = await fetch('/api/products.json');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          const dest = data.products.find(p => p.destacado_mes == 1) || data.products[0];
          if (dest) {
            this.state.destacadoMes = dest;
            this.renderDestacadoMes();
          }
        }
      } catch (err2) {
        console.error('Error en fallback destacado:', err2);
      }
    }
  },

  renderDestacadoMes() {
    const container = document.getElementById('destacadoMesContainer');
    if (!container || !this.state.destacadoMes) return;
    const p = this.state.destacadoMes;
    const isPromo = this.state.priceMode === 'promo';
    const preferentialPrice = p.has_preferential_price ? (isPromo ? p.precio_preferencial_promo : p.precio_preferencial) : null;
    const mainPrice = preferentialPrice || (isPromo ? p.price_promo : p.price_list);
    const strikePrice = preferentialPrice ? p.price_list : (p.savings > 0 ? p.price_list : null);

    container.innerHTML = `
      <div class="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#121b2b] via-[#0d1424] to-[#070b14] border-2 border-amber-400/40 shadow-2xl shadow-amber-500/10">
        <div class="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          <div class="lg:col-span-4 flex items-center justify-center">
            <div class="relative w-48 h-48 sm:w-56 sm:h-56 bg-black/40 rounded-2xl p-3 border border-amber-300/30 shadow-xl flex items-center justify-center">
              <img src="${p.image_url}" alt="${p.name}" class="max-w-full max-h-full object-contain drop-shadow-md hover:scale-105 transition-transform" />
              <span class="absolute top-2 left-2 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded shadow font-mono">⭐ TOP DEL MES</span>
              <span class="absolute bottom-2 right-2 bg-black/80 text-gray-200 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10 font-mono">${p.weight_kg} kg</span>
            </div>
          </div>
          <div class="lg:col-span-8 space-y-3.5">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 uppercase tracking-wider shadow">
                ⭐ DESTACADO DEL MES
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ${p.brand}
              </span>
              ${p.beneficio_exclusivo ? `
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  ✨ ${p.beneficio_exclusivo}
                </span>` : ''}
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-white leading-tight">
              ${p.name}
            </h2>
            <div class="flex items-center gap-2 text-xs text-emerald-400 font-semibold pt-0.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-sm animate-pulse"></span>
              <span>Nutrición balanceada de fábrica • Digestibilidad superior y frescura garantizada</span>
            </div>
            <div class="pt-2 flex flex-wrap items-baseline gap-3">
              <div class="flex items-baseline gap-2">
                <span class="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  $${mainPrice.toLocaleString('es-AR')}
                </span>
                ${strikePrice ? `<span class="text-sm sm:text-base text-gray-500 line-through font-mono">$${strikePrice.toLocaleString('es-AR')}</span>` : ''}
              </div>
              <span class="text-xs text-amber-300 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                ${p.has_preferential_price ? '⚡ Precio Preferencial Activo' : '⚡ Descuento por Transferencia'}
              </span>
            </div>
            <div class="pt-2 flex flex-wrap items-center gap-3">
              <button 
                onclick="App.addToCart(${p.id})" 
                class="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>🛒</span>
                <span>LLEVARLO A CASA</span>
              </button>
              <a 
                href="/product.html?id=${p.id}" 
                class="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <span>Ver Ficha Nutricional</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async loadPacksFuncionales() {
    try {
      const res = await fetch('/api/products.php?packs=1');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success') {
        this.state.packs = data.packs;
        this.renderPacksFuncionales();
        return;
      }
    } catch (e) {
      console.warn('Fallback a products.json para Packs Funcionales');
      try {
        const res = await fetch('/api/products.json');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          const packs = data.products.filter(p => p.pack_funcional == 1 || (p.category && p.category.toLowerCase().includes('pack')));
          this.state.packs = packs;
          this.renderPacksFuncionales();
        }
      } catch (err2) {
        console.error('Error en fallback packs:', err2);
      }
    }
  },

  filterPacksByCategory(category) {
    this.state.activePackFilter = category;
    document.querySelectorAll('.pack-filter-btn').forEach(b => {
      const isMatch = b.dataset.packFilter === category;
      b.classList.toggle('active', isMatch);
      b.classList.toggle('bg-purple-600', isMatch);
      b.classList.toggle('text-white', isMatch);
      b.classList.toggle('shadow-md', isMatch);
      b.classList.toggle('bg-white/5', !isMatch);
      b.classList.toggle('text-gray-300', !isMatch);
    });
    this.renderPacksFuncionales();
  },

  renderPacksFuncionales() {
    const container = document.getElementById('packsGrid');
    if (!container || !this.state.packs) return;
    
    let filteredPacks = this.state.packs;
    if (this.state.activePackFilter && this.state.activePackFilter !== 'todos') {
      const filter = this.state.activePackFilter.toLowerCase();
      filteredPacks = filteredPacks.filter(pk => {
        if (filter === 'perro_grande') return pk.breed_size === 'grande' || pk.name.toLowerCase().includes('grande');
        if (filter === 'perro_chico') return pk.breed_size === 'pequeña' || pk.name.toLowerCase().includes('chico') || pk.name.toLowerCase().includes('pequeñ');
        if (filter === 'mix_carne') return pk.name.toLowerCase().includes('carne') || pk.breed_size === 'todas';
        return true;
      });
    }

    if (filteredPacks.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-8 text-center text-gray-400 bg-black/30 rounded-2xl border border-white/5">
          <p class="text-xs">No hay packs disponibles en esta categoría actualmente.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredPacks.map(pk => {
      const isPromo = this.state.priceMode === 'promo';
      const preferentialPrice = pk.has_preferential_price ? (isPromo ? pk.precio_preferencial_promo : pk.precio_preferencial) : null;
      const mainPrice = preferentialPrice || (isPromo ? pk.price_promo : pk.price_list);
      const strikePrice = preferentialPrice ? pk.price_list : (pk.savings > 0 ? pk.price_list : null);

      return `
        <div class="glass-panel card-interactive rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative group border border-purple-500/30 shadow-lg">
          <div class="flex items-center justify-between mb-3 gap-2">
            <span class="text-[10px] font-black uppercase tracking-wider text-purple-200 bg-purple-600/30 px-2.5 py-0.5 rounded-lg border border-purple-400/40">
              📦 PACK FUNCIONAL
            </span>
            ${pk.beneficio_exclusivo ? `
              <span class="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30 truncate max-w-[140px]" title="${pk.beneficio_exclusivo}">
                ✨ ${pk.beneficio_exclusivo}
              </span>
            ` : ''}
          </div>

          <a href="/product.html?id=${pk.id}" class="block relative w-full h-44 sm:h-48 rounded-xl overflow-hidden mb-3.5 bg-black/40 border border-white/5 flex items-center justify-center p-2 group-hover:border-purple-500/50 transition-all cursor-pointer">
            <img src="${pk.image_url}" alt="${pk.name}" class="w-full h-full object-contain rounded-lg transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div class="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-white font-mono border border-white/10">
              Combo ${pk.weight_kg} kg
            </div>
          </a>

          <div class="space-y-2.5 mb-4 flex-1">
            <div class="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300">
              <span class="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/25">
                🎁 Combo Ahorro
              </span>
              <span class="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-gray-300">
                ${pk.breed_size === 'grande' ? '🦮 Perro grande' : pk.breed_size === 'pequeña' ? '🐕 Perro chico' : '🥩 Mix especial'}
              </span>
            </div>

            <a href="/product.html?id=${pk.id}" class="block group/title">
              <h3 class="font-black text-sm sm:text-[15px] text-white line-clamp-2 leading-snug group-hover/title:text-purple-300 transition-colors min-h-[2.5rem] flex items-center">
                ${pk.name}
              </h3>
            </a>
          </div>

          <div class="pt-3 border-t border-white/10 space-y-2.5">
            <div class="flex items-baseline justify-between">
              <span class="text-xl sm:text-2xl font-black text-purple-300 font-mono">
                $${mainPrice.toLocaleString('es-AR')}
              </span>
              ${strikePrice ? `<span class="text-xs text-gray-500 line-through font-mono">$${strikePrice.toLocaleString('es-AR')}</span>` : ''}
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-emerald-400 font-bold">Precio Especial Combo</span>
              <span class="text-gray-400 font-mono">Stock: ${pk.stock}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button 
                onclick="App.addToCart(${pk.id})" 
                class="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/30 transition-all cursor-pointer"
              >
                <span>🛒 Comprar</span>
              </button>
              <a 
                href="/product.html?id=${pk.id}" 
                class="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs text-center flex items-center justify-center transition-all"
              >
                Ver Detalle →
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  async loadBrands() {
    try {
      const res = await fetch('/api/brands.php');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success') {
        this.state.brands = data.brands;
        this.renderBrandsShowcase();
        return;
      }
    } catch (e) {
      console.warn('Fallback a brands.json');
      try {
        const res = await fetch('/api/brands.json');
        const data = await res.json();
        if (data.status === 'success') {
          this.state.brands = data.brands;
          this.renderBrandsShowcase();
        }
      } catch (err2) {
        console.error('Error en fallback marcas:', err2);
      }
    }
  },

  renderBrandsShowcase() {
    const container = document.getElementById('brandsShowcaseGrid');
    if (!container || !this.state.brands) return;

    // Solo marcas oficiales con productos en el catálogo
    const activeBrands = this.state.brands.filter(b => b.product_count > 0);

    container.innerHTML = activeBrands.map(b => {
      const isSelected = this.state.filters.brand.toLowerCase() === b.name.toLowerCase();
      const isDarkLogo = (b.logo_theme === 'dark') || b.name.toLowerCase().includes('nutricare');

      // Adaptación de fondo:
      // - Fondo blanco para logos con letras negras u oscuras (Fawna, Old Prince, Mon Ami, Kongo, Maintenance)
      // - Fondo negro para logos con letras blancas (Nutricare)
      const logoBoxClasses = isDarkLogo 
        ? 'bg-[#060a14] border border-white/20 shadow-inner group-hover:border-emerald-400/50' 
        : 'bg-white border border-white/90 shadow-sm group-hover:shadow-md group-hover:border-emerald-400/40';

      return `
        <button 
          type="button" 
          onclick="App.selectBrandFilter('${b.name}')"
          class="brand-chip flex-shrink-0 w-36 sm:w-auto snap-start p-3 sm:p-4 rounded-2xl flex flex-col items-center justify-between gap-3 text-center group cursor-pointer transition-all border ${
            isSelected 
              ? 'active ring-2 ring-emerald-400 bg-emerald-950/40 border-emerald-500 shadow-xl shadow-emerald-500/25 -translate-y-0.5' 
              : 'border-white/10 bg-[#0d1424] hover:border-emerald-500/40 hover:bg-[#121c33] hover:-translate-y-0.5'
          }"
          title="Filtrar por ${b.name}"
        >
          <!-- Contenedor adaptado de logo -->
          <div class="w-full h-14 sm:h-16 flex items-center justify-center p-2 rounded-xl transition-all ${logoBoxClasses}">
            <img 
              src="${b.logo}" 
              alt="${b.name}" 
              class="max-w-full max-h-9 sm:max-h-10 w-auto object-contain group-hover:scale-105 transition-transform"
              onerror="this.src='${b.logo_remote || b.logo}'"
              loading="lazy"
            />
          </div>

          <div class="w-full">
            <div class="font-extrabold text-white text-xs sm:text-sm leading-tight truncate group-hover:text-emerald-300 transition-colors flex items-center justify-center gap-1">
              <span>${b.name}</span>
              ${isSelected ? '<span class="text-emerald-400 text-[11px] font-black">✓</span>' : ''}
            </div>
            <span class="text-[10px] text-gray-400 font-medium block truncate mt-0.5">${b.segment}</span>
          </div>

          <span class="text-[10px] ${isSelected ? 'text-emerald-200 bg-emerald-500/30 border-emerald-400/50' : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'} font-mono font-bold px-2.5 py-0.5 rounded-full border">
            ${b.product_count} fórmulas
          </span>
        </button>
      `;
    }).join('');
  },

  selectBrandFilter(brandName) {
    if (this.state.filters.brand.toLowerCase() === brandName.toLowerCase()) {
      this.state.filters.brand = 'todas';
    } else {
      this.state.filters.brand = brandName;
    }
    const brandSelect = document.getElementById('filterBrand');
    if (brandSelect) brandSelect.value = this.state.filters.brand;
    this.renderBrandsShowcase();
    this.loadProducts();
    document.getElementById('catalogAnchor')?.scrollIntoView({behavior: 'smooth'});
  },

  selectBreedOption() {
    this.filterByAnimal('perro');
    this.showToast('🐕 Opciones pensando en Razas: Explorando fórmulas por morfología y raza.');
  },

  selectSizeOption() {
    document.getElementById('catalogAnchor')?.scrollIntoView({ behavior: 'smooth' });
    this.showToast('📏 Opciones pensando en Tamaños: Filtrá según el tamaño de tu compañero.');
  },

  selectTemperOption() {
    document.getElementById('catalogAnchor')?.scrollIntoView({ behavior: 'smooth' });
    this.showToast('🎾 Opciones pensando en Temperamento: Fórmulas para vitalidad, juego y temperamento.');
  },

  async loadSettings() {
    try {
      const res = await fetch('/api/settings.php');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success') {
        this.state.settings = data.settings;
        this.applySettingsToDOM();
        return;
      }
    } catch (e) {
      console.warn('Fallback a settings.json');
      try {
        const res = await fetch('/api/settings.json');
        const data = await res.json();
        if (data.status === 'success') {
          this.state.settings = data.settings;
          this.applySettingsToDOM();
        }
      } catch (err2) {
        console.error('Error en fallback configuraciones:', err2);
      }
    }
  },

  applySettingsToDOM() {
    const s = this.state.settings;
    if (!s) return;

    const isGeneralEnabled = s.discount_transfer_enabled !== '0' && s.discount_transfer_enabled !== 0 && s.discount_transfer_enabled !== false;
    const discount = (s.discount_transfer_percent !== undefined && s.discount_transfer_percent !== null && s.discount_transfer_percent !== '') 
      ? parseFloat(s.discount_transfer_percent) 
      : 15;
    this.state.discountTransferEnabled = isGeneralEnabled;
    this.state.discountTransferPercent = discount;

    // 1. Barra de Anuncio Superior
    if (s.announcement_badge) {
      const badge = document.getElementById('announcementBadge');
      if (badge) badge.textContent = s.announcement_badge;
    }
    if (s.announcement_text) {
      const text = document.getElementById('announcementText');
      if (text) {
        let ann = s.announcement_text;
        if (isGeneralEnabled && discount > 0) {
          ann = ann.replace(/\b\d+%\s*OFF\b/gi, `<strong>${Math.round(discount)}% OFF</strong>`);
          ann = ann.replace(/\b\d+%\s*de\s*descuento\b/gi, `${Math.round(discount)}% de descuento`);
        } else {
          ann = ann.replace(/\b\d+%\s*OFF\s*real\b/gi, 'Precios directos');
          ann = ann.replace(/\b\d+%\s*OFF\b/gi, 'Precios directos');
          ann = ann.replace(/\b\d+%\s*de\s*descuento\b/gi, 'precios directos de fábrica');
        }
        text.innerHTML = ann;
      }
    }
    if (s.shipping_top_text) {
      const shipTop = document.getElementById('shippingTopText');
      if (shipTop) shipTop.textContent = s.shipping_top_text;
    }

    // 2. WhatsApp
    if (s.whatsapp_number) {
      const waNumberEl = document.getElementById('whatsappTopNumber');
      const cleanWa = s.whatsapp_number.replace(/[^0-9]/g, '');
      if (waNumberEl) waNumberEl.textContent = s.whatsapp_number;
      const waLink = document.getElementById('whatsappTopLink');
      if (waLink) waLink.href = `https://wa.me/${cleanWa}`;
    }

    // 3. Los 4 Pilares de Confianza
    for (let i = 1; i <= 4; i++) {
      const icon = s[`pillar${i}_icon`];
      let title = s[`pillar${i}_title`];
      const desc = s[`pillar${i}_desc`];

      const iconEl = document.getElementById(`pillar${i}_icon`);
      const titleEl = document.getElementById(`pillar${i}_title`);
      const descEl = document.getElementById(`pillar${i}_desc`);

      if (i === 2 && title) {
        if (isGeneralEnabled && discount > 0) {
          title = title.replace(/\b\d+%\s*OFF\b/gi, `${Math.round(discount)}% OFF`);
        } else {
          title = title.replace(/\b\d+%\s*OFF\b/gi, 'Ahorro');
        }
      }

      if (iconEl && icon) iconEl.textContent = icon;
      if (titleEl && title) titleEl.textContent = title;
      if (descEl && desc) descEl.textContent = desc;
    }

    // 4. Datos Bancarios en Checkout
    if (s.bank_alias) {
      const aliasEl = document.getElementById('checkoutBankAlias');
      if (aliasEl) aliasEl.textContent = s.bank_alias;
    }
    if (s.bank_cbu) {
      const cbuEl = document.getElementById('checkoutBankCbu');
      if (cbuEl) cbuEl.textContent = s.bank_cbu.substring(0, 8) + '...' + s.bank_cbu.slice(-4);
    }

    // 5. Porcentaje Dinámico de Descuento por Transferencia y Precios Preferenciales
    // Switch de Precios en cabecera: Precio Preferencial vs Tarjeta
    const switchPromoText = document.getElementById('switchModePromoText');
    if (switchPromoText) {
      switchPromoText.innerHTML = `<span>⚡</span> <span class="hidden md:inline">Precio </span><span>Preferencial</span>`;
    }

    // Hero Section
    const heroDiscountHighlight = document.getElementById('heroDiscountHighlight');
    if (heroDiscountHighlight) {
      if (isGeneralEnabled && discount > 0) {
        heroDiscountHighlight.textContent = `${Math.round(discount)}% de descuento por transferencia`;
      } else {
        heroDiscountHighlight.textContent = `precios transparentes y directos de fábrica`;
      }
    }

    const heroDiscountBadge = document.getElementById('heroDiscountBadge');
    if (heroDiscountBadge) {
      if (isGeneralEnabled && discount > 0) {
        heroDiscountBadge.textContent = `${Math.round(discount)}% OFF TRANSFERENCIA`;
        heroDiscountBadge.classList.remove('hidden');
      } else {
        heroDiscountBadge.textContent = `PRECIOS PREFERENCIALES`;
      }
    }

    // Badges en Modal Checkout
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

    // Actualizar preview de producto en el Hero
    this.updateHeroPreview();
  },

  bindEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchMobile = document.getElementById('searchInputMobile');

    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.state.filters.search = e.target.value.trim();
          if (searchMobile) searchMobile.value = e.target.value;
          this.loadProducts();
        }, 250);
      });
    }

    if (searchMobile) {
      let debounceTimerMobile;
      searchMobile.addEventListener('input', (e) => {
        clearTimeout(debounceTimerMobile);
        debounceTimerMobile = setTimeout(() => {
          this.state.filters.search = e.target.value.trim();
          if (searchInput) searchInput.value = e.target.value;
          this.loadProducts();
        }, 250);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInput?.focus();
      }
    });

    document.querySelectorAll('.tab-animal').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-animal').forEach(b => {
          b.classList.remove('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
          b.classList.add('text-gray-400', 'border-transparent');
        });
        btn.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
        btn.classList.remove('text-gray-400', 'border-transparent');
        this.state.filters.animal = btn.dataset.animal;
        this.loadProducts();
      });
    });

    ['filterBrand', 'filterStage', 'filterWeight', 'filterSort'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this.state.filters.brand = document.getElementById('filterBrand')?.value || 'todas';
          this.state.filters.life_stage = document.getElementById('filterStage')?.value || 'todos';
          this.state.filters.weight = document.getElementById('filterWeight')?.value || '';
          this.state.filters.sort = document.getElementById('filterSort')?.value || 'featured';
          this.loadProducts();
        });
      }
    });

    const switchPromo = document.getElementById('switchModePromo');
    const switchList = document.getElementById('switchModeList');
    if (switchPromo && switchList) {
      switchPromo.addEventListener('click', () => this.setPriceMode('promo'));
      switchList.addEventListener('click', () => this.setPriceMode('list'));
    }

    document.getElementById('cartBtn')?.addEventListener('click', () => this.openCart());
    document.getElementById('closeCartBtn')?.addEventListener('click', () => this.closeCart());
    document.getElementById('cartDrawerOverlay')?.addEventListener('click', () => this.closeCart());

    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => this.openMobileMenu());
    document.getElementById('closeMobileNavBtn')?.addEventListener('click', () => this.closeMobileMenu());
    document.getElementById('mobileNavOverlay')?.addEventListener('click', () => this.closeMobileMenu());

    // ESC key listener to close mobile drawer & cart
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMobileMenu();
        this.closeCart();
      }
    });

    this.initTextReactions();
  },

  initTextReactions() {
    const pills = document.querySelectorAll('.reaction-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const reaction = pill.dataset.reaction || '🐾';

        // Partícula flotante de reacción
        const particle = document.createElement('span');
        particle.className = 'reaction-floating-particle';
        particle.textContent = reaction;
        particle.style.position = 'fixed';
        const clientX = e.clientX || (pill.getBoundingClientRect().left + 20);
        const clientY = e.clientY || (pill.getBoundingClientRect().top);
        particle.style.left = `${clientX}px`;
        particle.style.top = `${clientY}px`;
        document.body.appendChild(particle);

        setTimeout(() => particle.remove(), 850);

        // Acciones interactivas según la reacción pulsada
        const tag = (pill.textContent || '').toLowerCase();
        if (tag.includes('perro')) {
          this.filterByAnimal('perro');
          this.showToast('🐕 Filtrando catálogo oficial para Perros.');
        } else if (tag.includes('gato')) {
          this.filterByAnimal('gato');
          this.showToast('🐈 Filtrando catálogo oficial para Gatos.');
        } else if (tag.includes('acá') || tag.includes('mascota')) {
          document.getElementById('catalogAnchor')?.scrollIntoView({ behavior: 'smooth' });
        } else if (tag.includes('razas') || tag.includes('tamaños') || tag.includes('temperamentos')) {
          this.showToast('✨ Opciones pensando en razas, tamaños y temperamentos.');
        }
      });
    });
  },

  setPriceMode(mode) {
    this.state.priceMode = mode;
    const switchPromo = document.getElementById('switchModePromo');
    const switchList = document.getElementById('switchModeList');
    const isGeneralEnabled = this.state.settings?.discount_transfer_enabled !== '0' && this.state.settings?.discount_transfer_enabled !== 0 && this.state.settings?.discount_transfer_enabled !== false;
    const discount = (this.state.settings?.discount_transfer_percent !== undefined && this.state.settings?.discount_transfer_percent !== null && this.state.settings?.discount_transfer_percent !== '') 
      ? parseFloat(this.state.settings.discount_transfer_percent) 
      : 15;

    const promoDrawerBtn = document.querySelector('.drawer-switch-promo');
    const listDrawerBtn = document.querySelector('.drawer-switch-list');

    if (mode === 'promo') {
      switchPromo?.classList.add('active');
      switchList?.classList.remove('active');
      if (promoDrawerBtn) {
        promoDrawerBtn.className = 'py-2 px-2 rounded-lg text-xs font-bold text-center transition-all bg-emerald-500 text-slate-950 shadow drawer-switch-promo';
      }
      if (listDrawerBtn) {
        listDrawerBtn.className = 'py-2 px-2 rounded-lg text-xs font-bold text-center transition-all text-gray-400 hover:text-white drawer-switch-list';
      }
      if (isGeneralEnabled && discount > 0) {
        this.showToast(`💸 Precios con ${Math.round(discount)}% OFF Transferencia activados en toda la tienda.`);
      } else {
        this.showToast('💸 Vista de precios preferenciales activada.');
      }
    } else {
      switchList?.classList.add('active');
      switchPromo?.classList.remove('active');
      if (promoDrawerBtn) {
        promoDrawerBtn.className = 'py-2 px-2 rounded-lg text-xs font-bold text-center transition-all text-gray-400 hover:text-white drawer-switch-promo';
      }
      if (listDrawerBtn) {
        listDrawerBtn.className = 'py-2 px-2 rounded-lg text-xs font-bold text-center transition-all bg-purple-500 text-white shadow drawer-switch-list';
      }
      this.showToast('💳 Precios de lista para tarjeta y cuotas activados.');
    }

    this.renderProducts();
    this.renderDestacadoMes();
    this.renderPacksFuncionales();
    this.renderCartItems();
    this.updateHeroPreview();
    this.renderSmartBowlSuggestedFoods();
  },

  filterByAnimal(animal) {
    this.state.filters.animal = animal;
    document.querySelectorAll('.tab-animal').forEach(b => {
      const match = b.dataset.animal === animal;
      b.classList.toggle('active', match);
      b.classList.toggle('border-emerald-500', match);
      b.classList.toggle('text-emerald-400', match);
      b.classList.toggle('bg-emerald-500/10', match);
      b.classList.toggle('text-gray-400', !match);
      b.classList.toggle('border-transparent', !match);
    });
    this.loadProducts();
    document.getElementById('catalogAnchor')?.scrollIntoView({ behavior: 'smooth' });
  },

  updateHeroPreview() {
    const promoEl = document.getElementById('heroPromoPrice');
    if (!promoEl) return;

    const isPromo = this.state.priceMode === 'promo';
    const listEl = document.getElementById('heroListPrice');
    const kgEl = document.getElementById('heroPricePerKg');
    const savingsEl = document.getElementById('heroSavingsBadge');
    const imgEl = document.getElementById('heroProductImg');
    const titleEl = document.getElementById('heroProductTitle');
    const subtitleEl = document.getElementById('heroProductSubtitle');
    const linkEl = document.getElementById('heroProductLink');
    const actionLinkEl = document.getElementById('heroProductActionLink');

    // Pick top featured product from loaded products (favoring Nutricare 20kg or Fawna)
    const featured = (this.state.products && this.state.products.length > 0)
      ? (this.state.products.find(p => p.is_featured && p.brand === 'Nutricare') 
         || this.state.products.find(p => p.is_featured) 
         || this.state.products[0])
      : null;

    if (!featured) return;

    if (imgEl) {
      imgEl.src = featured.image_url;
      imgEl.alt = featured.name;
    }
    if (titleEl) titleEl.textContent = featured.name;
    if (subtitleEl) subtitleEl.textContent = `${featured.brand} • ${featured.weight_kg} kg • ${featured.animal.toUpperCase()}`;
    if (linkEl) linkEl.href = `/product.html?id=${featured.id}`;
    if (actionLinkEl) actionLinkEl.href = `/product.html?id=${featured.id}`;

    const mainPrice = isPromo ? featured.price_promo : featured.price_list;
    const strikePrice = isPromo ? featured.price_list : null;
    const savings = featured.price_list - featured.price_promo;
    const pricePerKg = isPromo ? featured.price_per_kg_promo : featured.price_per_kg_list;

    if (promoEl) promoEl.textContent = '$' + mainPrice.toLocaleString('es-AR');
    if (listEl) {
      if (isPromo && strikePrice && savings > 0) {
        listEl.textContent = 'Precio Lista: $' + strikePrice.toLocaleString('es-AR');
        listEl.classList.remove('hidden');
      } else {
        listEl.classList.add('hidden');
      }
    }
    if (savingsEl) {
      if (isPromo && savings > 0 && Math.round(featured.savings_percent) > 0) {
        savingsEl.textContent = `⚡ PRECIO PREFERENCIAL: Ahorrás $${savings.toLocaleString('es-AR')} (-${Math.round(featured.savings_percent)}%)`;
        savingsEl.classList.remove('hidden');
      } else {
        savingsEl.classList.add('hidden');
      }
    }
    if (kgEl) {
      kgEl.textContent = `$${pricePerKg.toLocaleString('es-AR')} / kg`;
    }
  },

  async loadProducts() {
    const grid = document.getElementById('productsGrid');
    const counter = document.getElementById('productsCounter');

    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-400 space-y-3">
          <div class="inline-block animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-emerald-400"></div>
          <p class="text-xs font-semibold text-gray-300">Sincronizando catálogo en tiempo real...</p>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams();
      if (this.state.filters.search) params.append('search', this.state.filters.search);
      if (this.state.filters.animal && this.state.filters.animal !== 'todos') params.append('animal', this.state.filters.animal);
      if (this.state.filters.life_stage && this.state.filters.life_stage !== 'todos') params.append('life_stage', this.state.filters.life_stage);
      if (this.state.filters.brand && this.state.filters.brand !== 'todas') params.append('brand', this.state.filters.brand);
      if (this.state.filters.weight) params.append('weight', this.state.filters.weight);
      if (this.state.filters.sort) params.append('sort', this.state.filters.sort);

      const res = await fetch(`/api/products.php?${params.toString()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      if (data.status === 'success') {
        this.state.products = data.products;
        this.state.facets = data.facets;
        this.state.pagination.page = 1;
        this.state.pagination.totalItems = data.products.length;
        this.state.pagination.totalPages = Math.max(1, Math.ceil(data.products.length / (this.state.pagination.pageSize || 12)));
        
        if (counter) {
          counter.textContent = `Mostrando ${data.count} producto${data.count === 1 ? '' : 's'} disponible${data.count === 1 ? '' : 's'}`;
        }

        this.updateBrandSelect();
        this.updateWeightSelect();
        this.renderProducts();
      }
    } catch (err) {
      console.warn('Error cargando catálogo desde PHP, intentando fallback estático:', err);
      try {
        const res = await fetch('/api/products.json');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          let list = [...data.products];
          const f = this.state.filters;
          
          if (f.search) {
            const q = f.search.toLowerCase().trim();
            list = list.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q)));
          }
          if (f.animal && f.animal !== 'todos') {
            list = list.filter(p => p.animal && p.animal.toLowerCase() === f.animal.toLowerCase());
          }
          if (f.life_stage && f.life_stage !== 'todos') {
            list = list.filter(p => p.life_stage && p.life_stage.toLowerCase() === f.life_stage.toLowerCase());
          }
          if (f.brand && f.brand !== 'todas') {
            list = list.filter(p => p.brand && p.brand.toLowerCase() === f.brand.toLowerCase());
          }
          if (f.weight) {
            list = list.filter(p => Math.abs(parseFloat(p.weight_kg) - parseFloat(f.weight)) < 0.1);
          }
          if (f.sort) {
            if (f.sort === 'precio_asc') list.sort((a, b) => (parseFloat(a.price_promo) || parseFloat(a.price_list)) - (parseFloat(b.price_promo) || parseFloat(b.price_list)));
            else if (f.sort === 'precio_desc') list.sort((a, b) => (parseFloat(b.price_promo) || parseFloat(b.price_list)) - (parseFloat(a.price_promo) || parseFloat(a.price_list)));
            else if (f.sort === 'descuento') list.sort((a, b) => (parseFloat(b.discount_percent) || 0) - (parseFloat(a.discount_percent) || 0));
            else if (f.sort === 'peso_desc') list.sort((a, b) => (parseFloat(b.weight_kg) || 0) - (parseFloat(a.weight_kg) || 0));
            else list.sort((a, b) => (b.is_featured || 0) - (a.is_featured || 0));
          }

          this.state.products = list;
          this.state.facets = data.facets || this.state.facets;
          this.state.pagination.page = 1;
          this.state.pagination.totalItems = list.length;
          this.state.pagination.totalPages = Math.max(1, Math.ceil(list.length / (this.state.pagination.pageSize || 12)));

          if (counter) {
            counter.textContent = `Mostrando ${list.length} producto${list.length === 1 ? '' : 's'} disponible${list.length === 1 ? '' : 's'}`;
          }

          this.updateBrandSelect();
          this.updateWeightSelect();
          this.renderProducts();
          return;
        }
      } catch (fallbackErr) {
        console.error('Error en fallback catálogo:', fallbackErr);
      }

      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full py-12 text-center text-red-400 text-xs">
            No se pudo conectar con el catálogo. Verifique el servidor local.
          </div>
        `;
      }
    }
  },

  updateBrandSelect() {
    const brandSelect = document.getElementById('filterBrand');
    if (brandSelect && this.state.facets.brands && brandSelect.options.length <= 1) {
      this.state.facets.brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        brandSelect.appendChild(opt);
      });
    }
  },

  updateWeightSelect() {
    const weightSelect = document.getElementById('filterWeight');
    if (weightSelect && this.state.facets.weights && weightSelect.options.length <= 3) {
      weightSelect.innerHTML = '<option value="">Cualquier Peso</option>';
      this.state.facets.weights.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w;
        opt.textContent = `${w} kg`;
        weightSelect.appendChild(opt);
      });
    }
  },

  renderProducts() {
    const grid = document.getElementById('productsGrid');
    const paginationContainer = document.getElementById('catalogPagination');
    if (!grid) return;

    if (this.state.products.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-20 text-center text-gray-400 space-y-3 bg-[#0d1424] rounded-3xl border border-white/5">
          <div class="text-5xl">🔍</div>
          <h3 class="text-base font-bold text-white">No encontramos productos con esos filtros</h3>
          <p class="text-xs text-gray-400 max-w-sm mx-auto">Probá cambiando la marca, el peso de la bolsa o limpiando el buscador.</p>
          <button onclick="App.resetFilters()" class="px-4 py-2 btn-subtle text-xs font-semibold">
            Limpiar Todos los Filtros
          </button>
        </div>
      `;
      if (paginationContainer) paginationContainer.innerHTML = '';
      this.syncDrawerPagination();
      return;
    }

    const totalItems = this.state.products.length;
    const pageSize = this.state.pagination.pageSize || 12;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    this.state.pagination.totalPages = totalPages;
    this.state.pagination.totalItems = totalItems;

    if (this.state.pagination.page > totalPages) {
      this.state.pagination.page = 1;
    }

    const page = this.state.pagination.page;
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pagedProducts = this.state.products.slice(startIdx, endIdx);

    grid.innerHTML = pagedProducts.map(p => {
      const isPromo = this.state.priceMode === 'promo';
      const preferentialPrice = p.has_preferential_price ? (isPromo ? p.precio_preferencial_promo : p.precio_preferencial) : null;
      const mainPrice = preferentialPrice || (isPromo ? p.price_promo : p.price_list);
      const strikePrice = preferentialPrice ? p.price_list : (isPromo && p.savings > 0 ? p.price_list : null);
      const hasSavings = isPromo && (p.savings > 0 || p.has_preferential_price);
      const hasDiscountPct = hasSavings && Math.round(p.savings_percent) > 0;
      const pricePerKg = Math.round(mainPrice / Math.max(p.weight_kg, 1));

      let badgeHtml = '';
      if (p.destacado_mes) {
        badgeHtml = `
          <span class="badge-discount text-[9px] sm:text-[11px] bg-amber-400/25 text-amber-300 border-amber-400/40 font-black">
            ⭐ TOP
          </span>`;
      } else if (p.pack_funcional) {
        badgeHtml = `
          <span class="badge-discount text-[9px] sm:text-[11px] bg-purple-500/25 text-purple-200 border-purple-400/40 font-black">
            📦 COMBO
          </span>`;
      } else if (p.has_preferential_price) {
        badgeHtml = `
          <span class="badge-discount text-[9px] sm:text-[11px] bg-emerald-500/25 text-emerald-300 border-emerald-400/40 font-black">
            ⭐ PREFERENCIAL
          </span>`;
      } else if (hasDiscountPct) {
        badgeHtml = `
          <span class="badge-discount text-[9px] sm:text-[11px] ${p.has_custom_discount ? 'bg-purple-500/25 text-purple-200 border-purple-400/40' : 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40'} font-black" title="Precio preferencial">
            ⚡ -${Math.round(p.savings_percent)}%
          </span>`;
      } else {
        badgeHtml = `
          <span class="text-[9px] sm:text-[11px] text-gray-400 bg-white/5 px-1.5 sm:px-2 py-0.5 rounded-md border border-white/10 font-bold">
            Lista
          </span>`;
      }

      const beneficioHtml = p.beneficio_exclusivo ? `
        <div class="mt-1">
          <span class="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            ✨ ${p.beneficio_exclusivo}
          </span>
        </div>` : '';

      return `
        <div class="glass-panel card-interactive rounded-xl sm:rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between relative group h-full">
          
          <!-- Top Badges Row -->
          <div class="flex items-center justify-between mb-2 sm:mb-3 gap-1 sm:gap-2">
            <span class="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-500/15 px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg border border-purple-500/25 truncate max-w-[80px] sm:max-w-[120px]">
              ${p.brand}
            </span>
            ${badgeHtml}
          </div>

          <!-- Product Image Showcase (Optimizado Móvil 2 Columnas) -->
          <a href="/product.html?id=${p.id}" class="block relative w-full h-32 sm:h-48 rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3.5 bg-black/40 border border-white/5 flex items-center justify-center p-1.5 sm:p-2 group-hover:border-emerald-500/40 transition-all cursor-pointer">
            <img 
              src="${p.image_url}" 
              alt="${p.name}" 
              class="w-full h-full object-contain rounded-md transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'"
            />
            <div class="absolute bottom-1.5 sm:bottom-2.5 left-1.5 sm:left-2.5 bg-black/80 backdrop-blur-md px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[11px] font-bold text-gray-100 border border-white/10 font-mono shadow-md">
              ${p.weight_kg} kg
            </div>
            ${p.stock <= 12 ? `<div class="absolute top-1.5 sm:top-2.5 left-1.5 sm:left-2.5 bg-amber-500/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black text-black shadow-md">STOCK: ${p.stock}</div>` : ''}
            ${p.secondary_image_url ? `<div class="absolute top-1.5 sm:top-2.5 right-1.5 sm:right-2.5 bg-emerald-500/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold text-black shadow-md flex items-center gap-0.5"><span>🔬</span> Ficha</div>` : ''}
          </a>

          <!-- Product Info & Attributes -->
          <div class="space-y-1.5 sm:space-y-2 mb-2 sm:mb-4 flex-1">
            <div class="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] font-semibold text-gray-300 flex-wrap">
              <span class="px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                ${p.animal === 'perro' ? '🐕 Perro' : '🐈 Gato'}
              </span>
              <span class="px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 border border-white/5 capitalize hidden xs:inline sm:inline">
                ${p.life_stage}
              </span>
            </div>

            <a href="/product.html?id=${p.id}" class="block group/title">
              <h3 class="font-black text-xs sm:text-[15px] text-white line-clamp-2 leading-snug tracking-tight group-hover/title:text-emerald-400 transition-colors min-h-[2rem] sm:min-h-[2.5rem] flex items-center">
                ${p.name}
              </h3>
            </a>

            ${beneficioHtml}
          </div>

          <!-- Dual Price Block & CTA -->
          <div class="pt-2 sm:pt-3.5 border-t border-white/10 space-y-2 sm:space-y-3">
            <div>
              <div class="flex items-baseline justify-between gap-1">
                <span class="price-display-promo text-sm sm:text-2xl font-black text-emerald-400 font-mono">
                  $${mainPrice.toLocaleString('es-AR')}
                </span>
                ${strikePrice ? `<span class="price-display-list text-[10px] sm:text-xs text-gray-500 line-through font-mono">$${strikePrice.toLocaleString('es-AR')}</span>` : ''}
              </div>
              <div class="flex justify-between items-center text-[9px] sm:text-[11px] text-gray-400 pt-0.5 font-medium">
                <span class="font-mono text-gray-400">$${pricePerKg.toLocaleString('es-AR')}/kg</span>
                <span class="text-emerald-400 font-bold">${hasSavings ? (p.has_custom_discount ? `Pref (-${Math.round(p.savings_percent)}%)` : 'Preferencial') : (isPromo ? 'Único' : 'Lista')}</span>
              </div>
            </div>

            <!-- Action Buttons: Ver Ficha + Agregar al Carrito -->
            <div class="grid grid-cols-1 sm:grid-cols-5 gap-1.5 sm:gap-2 pt-0.5">
              <a 
                href="/product.html?id=${p.id}" 
                class="sm:col-span-2 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl btn-subtle text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 hover:border-emerald-400/50 hover:text-emerald-400 transition-colors text-center"
                title="Ver ficha nutricional y fotos"
              >
                <span>Ver Ficha</span>
              </a>
              <button 
                onclick="App.addToCart(${p.id})" 
                class="sm:col-span-3 py-1.5 sm:py-2.5 btn-primary-neon text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-transform"
              >
                <span>🛒</span> <span class="hidden sm:inline">Agregar</span><span class="sm:hidden">Comprar</span>
              </button>
            </div>
          </div>

        </div>
      `;
    }).join('');

    this.renderPagination();
    this.syncDrawerPagination();
  },

  renderPagination() {
    const container = document.getElementById('catalogPagination');
    if (!container) return;

    const { page, totalPages, totalItems, pageSize } = this.state.pagination;

    if (totalItems <= pageSize) {
      container.innerHTML = '';
      return;
    }

    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    let pageButtonsHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
        const isCurrent = p === page;
        pageButtonsHtml += `
          <button 
            type="button"
            onclick="App.goToPage(${p})" 
            class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-bold font-mono transition-all ${
              isCurrent 
                ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' 
                : 'bg-black/50 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10'
            }"
          >
            ${p}
          </button>
        `;
      } else if (p === page - 2 || p === page + 2) {
        pageButtonsHtml += `<span class="text-gray-500 px-1 text-xs">...</span>`;
      }
    }

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-black/30 border border-white/5">
        <div class="text-xs text-gray-400">
          Mostrando <strong class="text-white font-mono">${startItem}-${endItem}</strong> de <strong class="text-emerald-400 font-mono">${totalItems}</strong> alimentos
        </div>
        
        <div class="flex items-center gap-1.5 flex-wrap justify-center">
          <button 
            type="button"
            onclick="App.prevPage()" 
            ${page <= 1 ? 'disabled' : ''} 
            class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold border border-white/10 transition-all ${
              page <= 1 ? 'opacity-30 cursor-not-allowed bg-black/20 text-gray-500' : 'bg-black/50 text-white hover:border-emerald-500 hover:text-emerald-400'
            }"
          >
            ← Anterior
          </button>

          ${pageButtonsHtml}

          <button 
            type="button"
            onclick="App.nextPage()" 
            ${page >= totalPages ? 'disabled' : ''} 
            class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold border border-white/10 transition-all ${
              page >= totalPages ? 'opacity-30 cursor-not-allowed bg-black/20 text-gray-500' : 'bg-black/50 text-white hover:border-emerald-500 hover:text-emerald-400'
            }"
          >
            Siguiente →
          </button>
        </div>

        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span>Por página:</span>
          <select 
            onchange="App.setPageSize(this.value)" 
            class="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono font-bold outline-none cursor-pointer"
          >
            <option value="12" ${pageSize === 12 ? 'selected' : ''}>12</option>
            <option value="24" ${pageSize === 24 ? 'selected' : ''}>24</option>
            <option value="48" ${pageSize === 48 ? 'selected' : ''}>48</option>
          </select>
        </div>
      </div>
    `;
  },

  goToPage(p) {
    if (p < 1 || p > this.state.pagination.totalPages) return;
    this.state.pagination.page = p;
    this.renderProducts();
    document.getElementById('catalogAnchor')?.scrollIntoView({ behavior: 'smooth' });
  },

  prevPage() {
    if (this.state.pagination.page > 1) {
      this.goToPage(this.state.pagination.page - 1);
    }
  },

  nextPage() {
    if (this.state.pagination.page < this.state.pagination.totalPages) {
      this.goToPage(this.state.pagination.page + 1);
    }
  },

  setPageSize(size) {
    this.state.pagination.pageSize = parseInt(size, 10) || 12;
    this.state.pagination.page = 1;
    this.renderProducts();
  },

  syncDrawerPagination() {
    const currentEl = document.getElementById('drawerPageCurrent');
    const totalEl = document.getElementById('drawerPageTotal');
    const prevBtn = document.getElementById('drawerPrevPageBtn');
    const nextBtn = document.getElementById('drawerNextPageBtn');
    const { page, totalPages } = this.state.pagination;

    if (currentEl) currentEl.textContent = page;
    if (totalEl) totalEl.textContent = totalPages;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
  },

  resetFilters() {
    this.state.filters = {
      search: '',
      animal: 'todos',
      life_stage: 'todos',
      breed_size: 'todas',
      brand: 'todas',
      weight: '',
      sort: 'featured'
    };
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.tab-animal').forEach((b, idx) => {
      if (idx === 0) {
        b.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
      } else {
        b.classList.remove('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
      }
    });
    ['filterBrand', 'filterStage', 'filterWeight', 'filterSort'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    this.loadProducts();
  },

  addToCart(productId) {
    const product = this.state.products.find(p => p.id === productId);
    if (!product) return;

    const existing = this.state.cart.find(it => it.id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.state.cart.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        weight_kg: product.weight_kg,
        price_list: product.price_list,
        price_promo: product.price_promo,
        image_url: product.image_url,
        quantity: 1
      });
    }

    this.saveCart();
    this.updateCartBadge();
    this.showToast(`🐾 ${product.name} sumado a tu carrito.`);
  },

  updateCartBadge() {
    const count = this.state.cart.reduce((sum, it) => sum + it.quantity, 0);
    const badges = document.querySelectorAll('#cartCountBadge, #bottomBarCartBadge, .cart-count-badge');
    badges.forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    });
  },

  saveCart() {
    localStorage.setItem('convivia_cart', JSON.stringify(this.state.cart));
    localStorage.setItem('pawpulse_cart', JSON.stringify(this.state.cart));
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

  renderCartItems() {
    const container = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('cartEmptyState');
    const footer = document.getElementById('cartFooter');
    if (!container) return;

    if (this.state.cart.length === 0) {
      container.innerHTML = '';
      emptyState?.classList.remove('hidden');
      footer?.classList.add('hidden');
      this.updateFreeShippingBar(0);
      return;
    }

    emptyState?.classList.add('hidden');
    footer?.classList.remove('hidden');

    const isPromo = this.state.priceMode === 'promo';
    let total = 0;
    let listTotal = 0;

    container.innerHTML = this.state.cart.map(it => {
      const price = isPromo ? it.price_promo : it.price_list;
      const sub = price * it.quantity;
      total += sub;
      listTotal += (it.price_list * it.quantity);

      return `
        <div class="flex items-center gap-3.5 p-3.5 bg-[#090e18] rounded-2xl border border-white/5">
          <img src="${it.image_url}" class="w-14 h-14 object-cover rounded-xl bg-gray-950 border border-white/10 flex-shrink-0" />
          <div class="flex-1 min-w-0 space-y-1">
            <h4 class="text-xs font-bold text-white truncate">${it.name}</h4>
            <div class="text-[11px] text-gray-400 font-mono">${it.weight_kg}kg • $${price.toLocaleString('es-AR')} c/u</div>
            <div class="flex items-center gap-2 pt-0.5">
              <button onclick="App.changeQty(${it.id}, -1)" class="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition-colors">-</button>
              <span class="text-xs font-mono font-bold text-white px-1">${it.quantity}</span>
              <button onclick="App.changeQty(${it.id}, 1)" class="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition-colors">+</button>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-bold text-emerald-400 font-mono">$${sub.toLocaleString('es-AR')}</div>
            <button onclick="App.removeFromCart(${it.id})" class="text-[11px] text-red-400 hover:text-red-300 mt-2 block font-medium">Quitar</button>
          </div>
        </div>
      `;
    }).join('');

    const savings = Math.max(0, listTotal - total);
    document.getElementById('cartTotalLabel').textContent = '$' + total.toLocaleString('es-AR');
    
    const savingsEl = document.getElementById('cartSavingsLabel');
    if (savingsEl) {
      if (isPromo && savings > 0) {
        savingsEl.textContent = `Ahorrás $${savings.toLocaleString('es-AR')} con Transferencia`;
        savingsEl.classList.remove('hidden');
      } else {
        savingsEl.classList.add('hidden');
      }
    }

    this.updateFreeShippingBar(total);
  },

  updateFreeShippingBar(total) {
    const threshold = parseFloat(this.state.settings.free_shipping_threshold) || 60000;
    const bar = document.getElementById('freeShippingBar');
    const text = document.getElementById('freeShippingText');
    const status = document.getElementById('freeShippingStatus');

    if (!bar || !text || !status) return;

    if (total >= threshold) {
      bar.style.width = '100%';
      text.textContent = '¡Genial! Tenés Envío Express GRATIS';
      status.textContent = '✓ DESBLOQUEADO';
      status.className = 'text-emerald-400 font-bold font-mono text-[11px]';
    } else {
      const remaining = threshold - total;
      const pct = Math.min(100, Math.round((total / threshold) * 100));
      bar.style.width = pct + '%';
      text.textContent = `Faltan $${remaining.toLocaleString('es-AR')} para Envío Gratis`;
      status.textContent = `${pct}%`;
      status.className = 'text-gray-400 font-mono text-[11px]';
    }
  },

  changeQty(productId, delta) {
    const item = this.state.cart.find(it => it.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.state.cart = this.state.cart.filter(it => it.id !== productId);
    }

    this.saveCart();
    this.updateCartBadge();
    this.renderCartItems();
  },

  removeFromCart(productId) {
    this.state.cart = this.state.cart.filter(it => it.id !== productId);
    this.saveCart();
    this.updateCartBadge();
    this.renderCartItems();
  },

  toggleSmartBowlMainSection() {
    const content = document.getElementById('sbMainSectionContent');
    const text = document.getElementById('sbMainSectionToggleText');
    const icon = document.getElementById('sbMainSectionToggleIcon');
    if (!content) return;

    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
      content.classList.remove('hidden');
      if (text) text.textContent = '✕ Plegar Calculadora';
      if (icon) icon.style.transform = 'rotate(180deg)';
      this.renderSmartBowlCalendar();
      this.renderSmartBowlSuggestedFoods();
    } else {
      content.classList.add('hidden');
      if (text) text.textContent = '👁️ Desplegar Calculadora Aquí';
      if (icon) icon.style.transform = 'rotate(0deg)';
    }
  },

  filterSmartBowlBrand(brandName) {
    this.state.smartBowl.selectedBrand = brandName;
    
    const btnMap = {
      'todas': 'sbBrandBtn_todas',
      'Fawna': 'sbBrandBtn_Fawna',
      'Old Prince': 'sbBrandBtn_OldPrince',
      'Nutricare': 'sbBrandBtn_Nutricare',
      'Kongo': 'sbBrandBtn_Kongo',
      'Maintenance Criadores': 'sbBrandBtn_Maintenance',
      'Mon Ami': 'sbBrandBtn_MonAmi'
    };

    document.querySelectorAll('.sb-brand-chip').forEach(btn => {
      btn.classList.remove('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/15');
      btn.classList.add('border-white/10', 'text-gray-300', 'bg-black/40');
    });

    const activeId = btnMap[brandName];
    if (activeId) {
      document.querySelectorAll(`#${activeId}`).forEach(el => {
        el.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/15');
        el.classList.remove('border-white/10', 'text-gray-300', 'bg-black/40');
      });
    }

    if (this._updateSmartBowlCalc) {
      this._updateSmartBowlCalc();
    }
  },

  initSmartBowl() {
    const tabDog = document.getElementById('sbTabDog');
    if (!tabDog) return;
    const tabCat = document.getElementById('sbTabCat');
    const tabBoth = document.getElementById('sbTabBoth');

    const dogControls = document.getElementById('sbDogControls');
    const catControls = document.getElementById('sbCatControls');
    const metricsDogBox = document.getElementById('sbMetricsDogBox');
    const metricsCatBox = document.getElementById('sbMetricsCatBox');
    const calSwitch = document.getElementById('sbCalendarSwitchContainer');
    const calSwitchDog = document.getElementById('sbCalSwitchDog');
    const calSwitchCat = document.getElementById('sbCalSwitchCat');

    const dogSlider = document.getElementById('sbDogWeightSlider');
    const dogValLabel = document.getElementById('sbDogWeightVal');
    const dogBagSelect = document.getElementById('sbDogBagSelect');
    const dogStageSelect = document.getElementById('sbDogStageSelect');

    const catSlider = document.getElementById('sbCatWeightSlider');
    const catValLabel = document.getElementById('sbCatWeightVal');
    const catBagSelect = document.getElementById('sbCatBagSelect');
    const catStageSelect = document.getElementById('sbCatStageSelect');

    const sugSwitch = document.getElementById('sbSuggestedSwitchContainer');
    const sugSwitchDog = document.getElementById('sbSugSwitchDog');
    const sugSwitchCat = document.getElementById('sbSugSwitchCat');

    const setSpeciesTab = (type) => {
      this.state.smartBowl.petType = type;
      [tabDog, tabCat, tabBoth].forEach(t => {
        t?.classList.remove('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
        t?.classList.add('text-gray-400', 'border-transparent');
      });

      if (type === 'perro') {
        tabDog?.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
        tabDog?.classList.remove('text-gray-400', 'border-transparent');
        dogControls?.classList.remove('hidden');
        catControls?.classList.add('hidden');
        metricsDogBox?.classList.remove('hidden');
        metricsCatBox?.classList.add('hidden');
        calSwitch?.classList.add('hidden');
        sugSwitch?.classList.add('hidden');
        this.state.smartBowl.activeCalendarView = 'dog';
        this.state.smartBowl.activeSuggestedView = 'dog';
      } else if (type === 'gato') {
        tabCat?.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
        tabCat?.classList.remove('text-gray-400', 'border-transparent');
        dogControls?.classList.add('hidden');
        catControls?.classList.remove('hidden');
        metricsDogBox?.classList.add('hidden');
        metricsCatBox?.classList.remove('hidden');
        calSwitch?.classList.add('hidden');
        sugSwitch?.classList.add('hidden');
        this.state.smartBowl.activeCalendarView = 'cat';
        this.state.smartBowl.activeSuggestedView = 'cat';
      } else {
        // ambos
        tabBoth?.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
        tabBoth?.classList.remove('text-gray-400', 'border-transparent');
        dogControls?.classList.remove('hidden');
        catControls?.classList.remove('hidden');
        metricsDogBox?.classList.remove('hidden');
        metricsCatBox?.classList.remove('hidden');
        calSwitch?.classList.remove('hidden');
        sugSwitch?.classList.remove('hidden');
        this.state.smartBowl.activeSuggestedView = 'dog';
        if (sugSwitchDog) sugSwitchDog.className = 'px-3 py-1 rounded-lg font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 transition-all';
        if (sugSwitchCat) sugSwitchCat.className = 'px-3 py-1 rounded-lg font-bold text-gray-400 hover:text-white transition-all border border-transparent';
      }

      updateCalculation();
    };

    tabDog?.addEventListener('click', () => setSpeciesTab('perro'));
    tabCat?.addEventListener('click', () => setSpeciesTab('gato'));
    tabBoth?.addEventListener('click', () => setSpeciesTab('ambos'));

    calSwitchDog?.addEventListener('click', () => {
      this.state.smartBowl.activeCalendarView = 'dog';
      calSwitchDog.className = 'px-2.5 py-1 rounded-lg font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30';
      calSwitchCat.className = 'px-2.5 py-1 rounded-lg font-bold text-gray-400 hover:text-white';
      this.renderSmartBowlCalendar();
    });

    calSwitchCat?.addEventListener('click', () => {
      this.state.smartBowl.activeCalendarView = 'cat';
      calSwitchCat.className = 'px-2.5 py-1 rounded-lg font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30';
      calSwitchDog.className = 'px-2.5 py-1 rounded-lg font-bold text-gray-400 hover:text-white';
      this.renderSmartBowlCalendar();
    });

    sugSwitchDog?.addEventListener('click', () => {
      this.state.smartBowl.activeSuggestedView = 'dog';
      if (sugSwitchDog) sugSwitchDog.className = 'px-3 py-1 rounded-lg font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 transition-all';
      if (sugSwitchCat) sugSwitchCat.className = 'px-3 py-1 rounded-lg font-bold text-gray-400 hover:text-white transition-all border border-transparent';
      this.renderSmartBowlSuggestedFoods();
    });

    sugSwitchCat?.addEventListener('click', () => {
      this.state.smartBowl.activeSuggestedView = 'cat';
      if (sugSwitchCat) sugSwitchCat.className = 'px-3 py-1 rounded-lg font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 transition-all';
      if (sugSwitchDog) sugSwitchDog.className = 'px-3 py-1 rounded-lg font-bold text-gray-400 hover:text-white transition-all border border-transparent';
      this.renderSmartBowlSuggestedFoods();
    });

    const updateCalculation = async () => {
      const type = this.state.smartBowl.petType;
      const dWeight = parseFloat(dogSlider?.value) || 25;
      const dBag = parseFloat(dogBagSelect?.value) || 15;
      const dStage = dogStageSelect?.value || 'adulto';

      const cWeight = parseFloat(catSlider?.value) || 4.0;
      const cBag = parseFloat(catBagSelect?.value) || 7.5;
      const cStage = catStageSelect?.value || 'adulto';

      if (dogValLabel) dogValLabel.textContent = dWeight;
      if (catValLabel) catValLabel.textContent = cWeight;

      this.state.smartBowl.dogWeight = dWeight;
      this.state.smartBowl.dogBag = dBag;
      this.state.smartBowl.dogStage = dStage;
      this.state.smartBowl.catWeight = cWeight;
      this.state.smartBowl.catBag = cBag;
      this.state.smartBowl.catStage = cStage;

      try {
        const params = new URLSearchParams({
          animal: type,
          dog_weight: dWeight,
          dog_bag_weight: dBag,
          dog_stage: dStage,
          cat_weight: cWeight,
          cat_bag_weight: cBag,
          cat_stage: cStage
        });

        if (this.state.smartBowl.selectedBrand && this.state.smartBowl.selectedBrand !== 'todas') {
          params.append('brand', this.state.smartBowl.selectedBrand);
        }

        const res = await fetch(`/api/smart_bowl.php?${params.toString()}`);
        const data = await res.json();

        if (data.status === 'success') {
          this.state.smartBowl.schedule = data.schedule;
          this.state.smartBowl.suggestedFoods = data.suggested_foods;

          // Perro metrics con Proporciones Baires S.A.
          if (data.schedule.dog) {
            const dog = data.schedule.dog;
            const dailyEl = document.getElementById('sbDailyGrams');
            const durEl = document.getElementById('sbDurationDays');
            const weeksEl = document.getElementById('sbDogWeeks');
            const portEl = document.getElementById('sbDogPortionsDetail');
            const cupsEl = document.getElementById('sbDogCupsDetail');

            if (dailyEl) dailyEl.textContent = `${dog.daily_grams} g/día`;
            if (durEl) durEl.textContent = `${dog.duration_days} días`;
            if (weeksEl) weeksEl.textContent = `~${dog.duration_weeks} semanas`;
            if (portEl) portEl.textContent = `${dog.servings_per_day} tomas de ${dog.grams_per_serving}g`;
            if (cupsEl) cupsEl.textContent = `~${dog.cups_per_day} vasos/día`;
          }

          // Gato metrics con Proporciones Baires S.A.
          if (data.schedule.cat) {
            const cat = data.schedule.cat;
            const catDailyEl = document.getElementById('sbCatDailyGrams');
            const catDurEl = document.getElementById('sbCatDurationDays');
            const catWeeksEl = document.getElementById('sbCatWeeks');
            const catPortEl = document.getElementById('sbCatPortionsDetail');
            const catCupsEl = document.getElementById('sbCatCupsDetail');

            if (catDailyEl) catDailyEl.textContent = `${cat.daily_grams} g/día`;
            if (catDurEl) catDurEl.textContent = `${cat.duration_days} días`;
            if (catWeeksEl) catWeeksEl.textContent = `~${cat.duration_weeks} semanas`;
            if (catPortEl) catPortEl.textContent = `${cat.servings_per_day} tomas de ${cat.grams_per_serving}g`;
            if (catCupsEl) catCupsEl.textContent = `~${cat.cups_per_day} vasos/día`;
          }

          // Fechas de alerta y vaciado
          const primarySchedule = data.schedule[this.state.smartBowl.activeCalendarView] || data.schedule.dog || data.schedule.cat;
          if (primarySchedule) {
            const alertEl = document.getElementById('sbAlertDate');
            const emptyEl = document.getElementById('sbEmptyDate');
            if (alertEl) alertEl.textContent = primarySchedule.alert_date_formatted;
            if (emptyEl) emptyEl.textContent = primarySchedule.empty_date_formatted;

            // Fechas en la barra del desplegable
            const sumAlert = document.getElementById('sbCalSummaryAlertDate');
            const sumEmpty = document.getElementById('sbCalSummaryEmptyDate');
            if (sumAlert) sumAlert.textContent = primarySchedule.alert_date_formatted;
            if (sumEmpty) sumEmpty.textContent = primarySchedule.empty_date_formatted;
          }

          this.renderSmartBowlCalendar();
          this.renderSmartBowlSuggestedFoods();
        }
      } catch (err) {
        console.error('Error calculando Smart Bowl:', err);
      }
    };

    // Toggle desplegable del Calendario Smart Bowl
    const toggleHeader = document.getElementById('sbCalendarToggleHeader');
    const collapseContent = document.getElementById('sbCalendarCollapseContent');
    const toggleText = document.getElementById('sbCalendarToggleText');
    const toggleIcon = document.getElementById('sbCalendarToggleIcon');
    const collapseBottomBtn = document.getElementById('sbCalendarCollapseBottomBtn');

    const toggleAccordion = () => {
      if (!collapseContent) return;
      const isHidden = collapseContent.classList.contains('hidden');
      if (isHidden) {
        collapseContent.classList.remove('hidden');
        if (toggleText) toggleText.textContent = '✕ Plegar Calendario';
        if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
        this.renderSmartBowlCalendar();
      } else {
        collapseContent.classList.add('hidden');
        if (toggleText) toggleText.textContent = '👁️ Desplegar Calendario Día por Día';
        if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
      }
    };

    toggleHeader?.addEventListener('click', toggleAccordion);
    collapseBottomBtn?.addEventListener('click', () => {
      if (collapseContent && !collapseContent.classList.contains('hidden')) {
        toggleAccordion();
        toggleHeader?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    [dogSlider, catSlider].forEach(el => el?.addEventListener('input', updateCalculation));
    [dogBagSelect, dogStageSelect, catBagSelect, catStageSelect].forEach(el => el?.addEventListener('change', updateCalculation));

    this._updateSmartBowlCalc = updateCalculation;
    updateCalculation();
  },

  renderSmartBowlCalendar() {
    const grid = document.getElementById('sbCalendarGrid');
    if (!grid || !this.state.smartBowl.schedule) return;

    const view = this.state.smartBowl.activeCalendarView || 'dog';
    const schedule = this.state.smartBowl.schedule[view] || this.state.smartBowl.schedule.dog || this.state.smartBowl.schedule.cat;
    if (!schedule || !schedule.calendar_days) return;

    const days = schedule.calendar_days;
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    grid.innerHTML = days.map((d, idx) => {
      let statusClass = 'calendar-day-tile';
      let badgeLabel = '';
      let badgeColor = '';

      if (d.status === 'start') {
        statusClass += ' status-start';
        badgeLabel = '🟢 Inicio Bolsa';
        badgeColor = 'text-emerald-300 bg-emerald-500/20 font-bold';
      } else if (d.status === 'alert') {
        statusClass += ' status-alert';
        badgeLabel = '⚠️ Alerta (-5d)';
        badgeColor = 'text-amber-300 bg-amber-500/20 font-black ring-1 ring-amber-400';
      } else if (d.status === 'empty') {
        statusClass += ' status-empty';
        badgeLabel = '🔴 Plato Vacío';
        badgeColor = 'text-red-300 bg-red-500/20 font-black ring-1 ring-red-400';
      } else if (d.status === 'depleted') {
        statusClass += ' status-depleted';
        badgeLabel = 'Agotado';
        badgeColor = 'text-gray-500';
      } else {
        const remainingKg = (d.remaining_grams / 1000).toFixed(1);
        badgeLabel = `${remainingKg} kg`;
        badgeColor = 'text-gray-400';
      }

      const dayName = dayNames[d.day_of_week] || '';

      return `
        <div class="${statusClass} p-1.5 sm:p-2 rounded-xl flex flex-col justify-between min-h-[56px] sm:min-h-[64px] text-left cursor-default select-none shadow-sm" title="Día ${idx + 1}: ${d.date} | Restan ${d.remaining_grams}g">
          <div class="flex items-center justify-between">
            <span class="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase">${dayName}</span>
            <span class="text-[11px] sm:text-xs font-mono font-black text-white">${d.day_num}</span>
          </div>
          <div class="mt-0.5 sm:mt-1">
            <span class="text-[8px] sm:text-[9px] px-1 py-0.5 rounded font-mono font-semibold block truncate ${badgeColor}">
              ${badgeLabel}
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderSmartBowlSuggestedFoods() {
    const grid = document.getElementById('sbSuggestedGrid');
    const subtitle = document.getElementById('sbSuggestedSubtitle');
    if (!grid || !this.state.smartBowl.suggestedFoods) return;

    const view = this.state.smartBowl.activeSuggestedView || (this.state.smartBowl.petType === 'gato' ? 'cat' : 'dog');
    const foods = this.state.smartBowl.suggestedFoods[view] 
      || this.state.smartBowl.suggestedFoods.dog 
      || this.state.smartBowl.suggestedFoods.cat 
      || [];

    const isPromo = this.state.priceMode === 'promo';

    if (subtitle) {
      const animalLabel = (view === 'cat') ? 'tu Gato Felino' : 'tu Perro Canino';
      const count = foods.length;
      subtitle.innerHTML = `Mostrando <strong class="text-white">${count} fórmulas oficiales Baires S.A.</strong> optimizadas para ${animalLabel} con cálculo en vivo de duración y costo diario:`;
    }

    if (foods.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-8 text-center text-gray-400 text-xs">
          No se encontraron alimentos sugeridos para estos parámetros. Explorá nuestro catálogo completo.
        </div>
      `;
      return;
    }

    grid.innerHTML = foods.map(item => {
      const priceMain = isPromo ? item.price_promo : item.price_list;
      const priceDaily = isPromo ? item.daily_cost_promo : item.daily_cost_list;
      const hasSavings = isPromo && item.savings > 0;

      return `
        <div class="glass-panel card-interactive rounded-2xl p-4 flex flex-col justify-between group border border-white/10 hover:border-emerald-500/50 transition-all shadow-lg bg-[#0a101f]/80">
          
          <div>
            <!-- Top brand and tier pill -->
            <div class="flex items-center justify-between gap-1.5 mb-2.5">
              <span class="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold tracking-wide uppercase border border-purple-500/30 truncate max-w-[170px]" title="${item.brand} • ${item.brand_tier}">
                ${item.brand} • ${item.brand_tier}
              </span>
              <span class="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                ${item.weight_kg} kg
              </span>
            </div>

            <!-- Image with interactive hover -->
            <div class="relative w-full h-40 rounded-xl overflow-hidden mb-3 bg-black/40 border border-white/5 flex items-center justify-center p-2 group-hover:border-emerald-500/40 transition-colors">
              <a href="/product.html?id=${item.id}" class="w-full h-full flex items-center justify-center">
                <img 
                  src="${item.image_url}" 
                  alt="${item.name}" 
                  class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onerror="this.src='https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80'"
                />
              </a>
              
              <!-- Dura X días badge -->
              <div class="absolute bottom-2 left-2 bg-[#06151f]/95 border border-emerald-500/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-extrabold text-emerald-300 shadow flex items-center gap-1">
                <span>⏳</span> <span>Dura <strong>${item.duration_days} días</strong> (${item.duration_weeks} sem)</span>
              </div>

              <!-- Savings badge -->
              ${hasSavings && item.savings_percent > 0 ? `
                <div class="absolute top-2 right-2 bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow flex items-center gap-0.5">
                  <span>⚡ PRECIO PREFERENCIAL</span> -${item.savings_percent}%
                </div>
              ` : ''}
            </div>

            <!-- Title & Daily Cost Strip -->
            <div class="space-y-1.5 mb-3">
              <a href="/product.html?id=${item.id}" class="font-bold text-xs text-white line-clamp-2 hover:text-emerald-300 transition-colors" title="${item.name}">
                ${item.name}
              </a>
              
              <div class="flex items-center justify-between text-[11px] bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                <span class="text-gray-400">Inversión diaria:</span>
                <span class="font-mono font-black text-amber-300">~$${priceDaily.toLocaleString('es-AR')} / día</span>
              </div>
            </div>
          </div>

          <!-- Pricing & Actions Strip -->
          <div class="pt-2 border-t border-white/10 space-y-2.5">
            <div class="flex items-baseline justify-between">
              <div>
                <span class="text-[9px] text-gray-400 uppercase tracking-wider block font-semibold">${isPromo ? 'Promo Transferencia' : 'Precio de Lista'}</span>
                <span class="text-base font-black text-emerald-400 font-mono">$${priceMain.toLocaleString('es-AR')}</span>
              </div>
              ${hasSavings ? `
                <div class="text-right">
                  <span class="text-[9px] text-gray-500 block font-semibold">Lista</span>
                  <span class="text-xs text-gray-400 line-through font-mono">$${item.price_list.toLocaleString('es-AR')}</span>
                </div>
              ` : ''}
            </div>

            <!-- Action buttons -->
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                onclick="App.addSuggestedToCart(${item.id})"
                class="w-full py-2 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <span>🛒</span>
                <span>Agregar</span>
              </button>

              <button 
                type="button" 
                onclick="App.applySuggestedBag(${item.weight_kg}, '${item.animal}')"
                title="Sincronizar calculadora con esta bolsa de ${item.weight_kg} kg"
                class="w-full py-2 px-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/40 text-purple-200 hover:text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all active:scale-95"
              >
                <span>🥣</span>
                <span>Usar Bolsa</span>
              </button>
            </div>

            <a 
              href="/product.html?id=${item.id}" 
              class="block text-center text-[10px] text-gray-400 hover:text-emerald-300 py-0.5 transition-colors font-semibold"
            >
              Ficha Técnica & Nutricional →
            </a>
          </div>

        </div>
      `;
    }).join('');
  },

  addSuggestedToCart(productId) {
    let item = this.state.products?.find(p => p.id === productId);
    if (!item && this.state.smartBowl.suggestedFoods) {
      const allSug = [
        ...(this.state.smartBowl.suggestedFoods.dog || []),
        ...(this.state.smartBowl.suggestedFoods.cat || [])
      ];
      item = allSug.find(p => p.id === productId);
    }

    if (!item) {
      this.showToast('No se encontró el producto en el catálogo.');
      return;
    }

    const existingIndex = this.state.cart.findIndex(c => c.id === item.id);
    if (existingIndex > -1) {
      this.state.cart[existingIndex].quantity += 1;
    } else {
      this.state.cart.push({
        id: item.id,
        name: item.name,
        brand: item.brand,
        weight_kg: item.weight_kg,
        price_list: item.price_list,
        price_promo: item.price_promo,
        image_url: item.image_url,
        quantity: 1
      });
    }

    this.saveCart();
    this.updateCartBadge();
    this.showToast(`🛒 "${item.name}" agregado al carrito.`);
  },

  applySuggestedBag(weightKg, animal) {
    const isDog = (animal === 'perro' || (!animal && this.state.smartBowl.petType !== 'gato'));
    const selectEl = isDog ? document.getElementById('sbDogBagSelect') : document.getElementById('sbCatBagSelect');

    if (selectEl) {
      let optionExists = false;
      for (let i = 0; i < selectEl.options.length; i++) {
        if (parseFloat(selectEl.options[i].value) === parseFloat(weightKg)) {
          selectEl.selectedIndex = i;
          optionExists = true;
          break;
        }
      }

      if (!optionExists) {
        const opt = document.createElement('option');
        opt.value = weightKg;
        opt.textContent = `${weightKg} kg (Bolsa Selección)`;
        selectEl.appendChild(opt);
        selectEl.value = weightKg;
      }

      selectEl.dispatchEvent(new Event('change'));
      this.showToast(`🥣 Calculadora y calendario sincronizados con bolsa de ${weightKg} kg.`);
      document.getElementById('smartBowlSection')?.scrollIntoView({ behavior: 'smooth' });
    }
  },

  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Funciones de navegación global adaptables a todos los dispositivos
window.openMobileMenu = function() {
  if (window.App && typeof window.App.openMobileMenu === 'function') {
    window.App.openMobileMenu();
  } else {
    document.getElementById('mobileNavDrawer')?.classList.add('active');
    document.getElementById('mobileNavOverlay')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};

window.closeMobileMenu = function() {
  if (window.App && typeof window.App.closeMobileMenu === 'function') {
    window.App.closeMobileMenu();
  } else {
    document.getElementById('mobileNavDrawer')?.classList.remove('active');
    document.getElementById('mobileNavOverlay')?.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

window.openConviviaCart = function() {
  if (window.App && typeof window.App.openCart === 'function') {
    window.App.openCart();
  } else if (window.ProductPage && typeof window.ProductPage.openCart === 'function') {
    window.ProductPage.openCart();
  } else {
    window.location.href = '/#catalogAnchor';
  }
};

window.setGlobalPriceMode = function(mode) {
  if (window.App && typeof window.App.setPriceMode === 'function') {
    window.App.setPriceMode(mode);
  } else if (window.ProductPage && typeof window.ProductPage.setPriceMode === 'function') {
    window.ProductPage.setPriceMode(mode);
  }
};
