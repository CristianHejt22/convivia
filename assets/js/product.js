// assets/js/product.js - Lógica interactiva para la Página de Detalle de Producto

const ProductPage = {
  state: {
    product: null,
    related: [],
    discountPercent: 15,
    quantity: 1,
    activeImage: 'primary', // 'primary' | 'secondary'
    priceMode: 'promo',
    cart: JSON.parse(localStorage.getItem('convivia_cart') || localStorage.getItem('pawpulse_cart') || '[]'),
    settings: {}
  },

  async init() {
    this.bindEvents();
    await this.loadSettings();
    await this.loadProduct();
    this.updateCartBadge();
  },

  async loadSettings() {
    try {
      const res = await fetch(`/api/settings.php?_t=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'success') {
        this.state.settings = data.settings;
        this.applySettings();
        return;
      }
    } catch (e) {
      console.warn('Fallback a settings.json en página de producto');
      try {
        const res = await fetch(`/assets/data/settings.json?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success') {
          this.state.settings = data.settings;
          this.applySettings();
        }
      } catch (err2) {
        console.error('Error cargando configuración fallback:', err2);
      }
    }
  },

  applySettings() {
    const s = this.state.settings;
    if (!s) return;

    const isGeneralEnabled = s.discount_transfer_enabled !== '0' && s.discount_transfer_enabled !== 0 && s.discount_transfer_enabled !== false;
    const discount = (s.discount_transfer_percent !== undefined && s.discount_transfer_percent !== null && s.discount_transfer_percent !== '') 
      ? parseFloat(s.discount_transfer_percent) 
      : 15;
    this.state.generalDiscountEnabled = isGeneralEnabled;
    this.state.generalDiscountPercent = discount;

    if (s.announcement_badge) document.getElementById('announcementBadge').textContent = s.announcement_badge;
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
    if (s.shipping_top_text) document.getElementById('shippingTopText').textContent = '🚚 ' + s.shipping_top_text;
    if (s.shipping_delivery_title) {
      const el = document.getElementById('productDeliveryNoticeTitle');
      if (el) el.textContent = s.shipping_delivery_title;
    }
    if (s.shipping_delivery_desc) {
      const el = document.getElementById('productDeliveryNoticeDesc');
      if (el) el.textContent = s.shipping_delivery_desc;
    }
    if (s.whatsapp_number) {
      const cleanWa = s.whatsapp_number.replace(/[^\d]/g, '');
      const link = document.getElementById('whatsappTopLink');
      const num = document.getElementById('whatsappTopNumber');
      if (link) link.href = `https://wa.me/${cleanWa}`;
      if (num) num.textContent = s.whatsapp_number;
    }

    // Switch de Precios en cabecera: Precio Preferencial vs Tarjeta
    const text = document.getElementById('switchModePromoText');
    if (text) {
      text.innerHTML = `<span>⚡</span> <span class="hidden md:inline">Precio </span><span>Preferencial</span>`;
    }

    // Checkout Badges
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
  },

  async loadProduct() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const slug = params.get('slug');

    if (!id && !slug) {
      window.location.href = '/';
      return;
    }

    const query = id ? `id=${id}` : `slug=${encodeURIComponent(slug)}`;

    try {
      const res = await fetch(`/api/products.php?${query}&_t=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      if (data.status === 'success' && data.product) {
        this.state.product = data.product;
        this.state.packItems = data.pack_items || [];
        this.state.variants = data.variants || [];
        this.state.related = data.related || [];
        this.state.generalDiscountEnabled = data.general_discount_enabled !== false;
        this.state.generalDiscountPercent = (data.discount_percent !== undefined) ? data.discount_percent : (this.state.generalDiscountPercent || 0);
        this.state.discountPercent = data.product.has_custom_discount 
          ? data.product.custom_discount_percent 
          : (this.state.generalDiscountEnabled ? this.state.generalDiscountPercent : 0);
        this.renderProductDetails();
        this.renderWeightVariants();
        this.renderRelatedProducts();
        this.initSmartBowlWidget();
        return;
      } else {
        throw new Error('Producto no encontrado en PHP');
      }
    } catch (e) {
      console.warn('Fallback a products.json para detalle de producto:', e);
      try {
        const res = await fetch(`/assets/data/products.json?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.products)) {
          const product = id 
            ? data.products.find(p => String(p.id) === String(id)) 
            : data.products.find(p => p.slug === slug);
          
          if (product) {
            this.state.product = product;
            this.state.packItems = product.pack_items || [];
            
            // Variantes por peso (mismo prefijo de nombre)
            const baseName = product.name.split(' x ')[0].toLowerCase().trim();
            this.state.variants = data.products
              .filter(p => String(p.id) !== String(product.id) && p.name.toLowerCase().startsWith(baseName))
              .map(p => ({ id: p.id, weight_kg: p.weight_kg, price_promo: p.price_promo, price_list: p.price_list }));
            
            // Relacionados
            this.state.related = data.products
              .filter(p => String(p.id) !== String(product.id) && (p.brand === product.brand || p.animal === product.animal))
              .slice(0, 4);

            this.state.generalDiscountEnabled = data.general_discount_enabled !== false;
            this.state.generalDiscountPercent = (data.discount_percent !== undefined) ? data.discount_percent : 15;
            this.state.discountPercent = product.has_custom_discount 
              ? product.custom_discount_percent 
              : (this.state.generalDiscountEnabled ? this.state.generalDiscountPercent : 0);

            this.renderProductDetails();
            this.renderWeightVariants();
            this.renderRelatedProducts();
            this.initSmartBowlWidget();
            return;
          }
        }
      } catch (fallbackErr) {
        console.error('Error en fallback producto:', fallbackErr);
      }
      this.renderNotFound();
    }
  },

  renderProductDetails() {
    const p = this.state.product;
    const isPromo = this.state.priceMode === 'promo';
    const mainPrice = isPromo ? p.price_promo : p.price_list;
    const strikePrice = isPromo ? p.price_list : null;
    const pricePerKg = isPromo ? p.price_per_kg_promo : p.price_per_kg_list;

    // Document Title
    document.title = `${p.name} | CONVIVIA`;

    // Breadcrumbs
    const animalLabel = p.animal === 'gato' ? 'Gatos' : 'Perros';
    document.getElementById('breadcrumbAnimal').textContent = animalLabel;
    document.getElementById('breadcrumbAnimal').href = `/?animal=${p.animal}`;
    document.getElementById('breadcrumbBrand').textContent = p.brand;
    document.getElementById('breadcrumbBrand').href = `/?brand=${encodeURIComponent(p.brand)}`;
    document.getElementById('breadcrumbCurrent').textContent = p.name;

    // Badges de Destacado del Mes, Pack Funcional o Beneficio Exclusivo
    const titleParent = document.getElementById('productTitle')?.parentElement;
    if (titleParent) {
      document.getElementById('extraBadgesContainer')?.remove();
      const extraDiv = document.createElement('div');
      extraDiv.id = 'extraBadgesContainer';
      extraDiv.className = 'flex flex-wrap items-center gap-2 mb-2';
      
      let badgesHtml = '';
      if (p.destacado_mes) {
        badgesHtml += `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-slate-950 uppercase font-mono shadow">⭐ DESTACADO DEL MES</span>`;
      }
      if (p.pack_funcional) {
        badgesHtml += `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-600 text-white uppercase font-mono shadow">📦 PACK FUNCIONAL</span>`;
      }
      if (p.beneficio_exclusivo) {
        badgesHtml += `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 animate-pulse">✨ ${p.beneficio_exclusivo}</span>`;
      }
      if (badgesHtml) {
        extraDiv.innerHTML = badgesHtml;
        titleParent.insertBefore(extraDiv, document.getElementById('productTitle'));
      }
    }

    // Images
    const mainImgEl = document.getElementById('mainProductImage');
    mainImgEl.src = p.image_url;
    mainImgEl.alt = p.name;

    const thumb1 = document.getElementById('thumbPrimary');
    const thumb1Img = document.getElementById('thumbPrimaryImg');
    thumb1Img.src = p.image_url;
    thumb1.classList.add('active', 'ring-2', 'ring-emerald-400', 'border-emerald-500');

    const thumb2 = document.getElementById('thumbSecondary');
    const thumb2Img = document.getElementById('thumbSecondaryImg');
    const secContainer = document.getElementById('secondaryDetailSection');
    const secDetailImg = document.getElementById('secondaryDetailImg');

    if (p.secondary_image_url) {
      thumb2.classList.remove('hidden');
      thumb2Img.src = p.secondary_image_url;
      if (secContainer && secDetailImg) {
        secContainer.classList.remove('hidden');
        secDetailImg.src = p.secondary_image_url;
        secDetailImg.alt = `Tabla nutricional y composición de ${p.name}`;
      }
    } else {
      thumb2.classList.add('hidden');
      if (secContainer) secContainer.classList.add('hidden');
    }

    // Badges & Titles
    document.getElementById('productBrandBadge').textContent = p.brand;
    document.getElementById('productTitle').textContent = p.name;

    const animalIcon = p.animal === 'gato' ? '🐈' : '🐕';
    document.getElementById('productSpeciesBadge').innerHTML = `${animalIcon} ${p.animal.toUpperCase()} • ${p.life_stage.toUpperCase()}`;
    document.getElementById('productWeightBadge').textContent = `${p.weight_kg} kg`;

    // Stock Badge
    const stockBadge = document.getElementById('productStockBadge');
    if (p.stock > 0) {
      stockBadge.textContent = p.stock <= 5 ? `¡Últimas ${p.stock} unidades en stock!` : `En Stock (${p.stock} disponibles)`;
      stockBadge.className = p.stock <= 5 
        ? 'px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30'
        : 'px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      stockBadge.textContent = 'Sin Stock Momentáneo';
      stockBadge.className = 'px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30';
    }

    // Pricing
    this.updatePriceDisplay();

    // Descriptions
    const descEl = document.getElementById('productDescriptionText');

    // Pack Components Box
    document.getElementById('productPackItemsBox')?.remove();
    if (this.state.packItems && this.state.packItems.length > 0 && descEl?.parentElement) {
      const box = document.createElement('div');
      box.id = 'productPackItemsBox';
      box.className = 'p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-2.5 mb-4 shadow-lg';
      box.innerHTML = `
        <h4 class="text-xs sm:text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2 pb-1 border-b border-purple-500/20">
          <span class="text-base">📦</span> <span>Incluye en el combo:</span>
        </h4>
        <div class="space-y-2 pt-1">
          ${this.state.packItems.map(it => `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-black/50 border border-white/10 text-xs gap-3">
              <div class="flex items-center gap-2.5 flex-1 min-w-0">
                ${it.image_url ? `<img src="${it.image_url}" class="w-10 h-10 rounded-lg object-contain bg-black/40 border border-white/5 flex-shrink-0" />` : ''}
                <div class="leading-snug break-words flex-1">
                  <span class="font-black text-emerald-400 mr-1">${it.quantity}x</span>
                  <span class="font-bold text-white text-xs sm:text-[13px]">${it.name}</span>
                </div>
              </div>
              <span class="font-mono text-purple-300 font-bold bg-purple-500/20 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap flex-shrink-0 border border-purple-500/30">${it.weight_kg} kg</span>
            </div>
          `).join('')}
        </div>
      `;
      descEl.parentElement.insertBefore(box, descEl);
    }
    if (descEl) {
      let rawDesc = p.description || 'Alimento balanceado premium con ingredientes seleccionados para el óptimo bienestar y nutrición de tu mascota.';
      
      // Sincronizar dinámicamente cualquier precio en el texto de la descripción con el precio real actual de la web
      if (/por\s+\$[\d\.,]+/i.test(rawDesc)) {
        const webPrice = p.price_list || 0;
        const formattedWebPrice = '$' + Math.round(webPrice).toLocaleString('es-AR') + ',00';
        rawDesc = rawDesc.replace(/por\s+\$[\d\.,]+/gi, `por ${formattedWebPrice}`);
      }

      if (rawDesc.includes('Beneficios destacados:') || rawDesc.includes('Ingredientes completos:') || rawDesc.includes('Composición centesimal:')) {
        let safeDesc = rawDesc
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/Beneficios destacados:/g, '<span class="block text-emerald-400 font-bold mt-4 mb-2 text-xs uppercase tracking-wider">✨ Beneficios destacados:</span>')
          .replace(/Composición centesimal:/g, '<span class="block text-blue-400 font-bold mt-4 mb-2 text-xs uppercase tracking-wider">📊 Composición centesimal garantizada:</span>')
          .replace(/Guía de suministro diario sugerido:/g, '<span class="block text-amber-400 font-bold mt-4 mb-2 text-xs uppercase tracking-wider">🥣 Guía de suministro diario sugerido:</span>')
          .replace(/Ingredientes completos:/g, '<span class="block text-purple-400 font-bold mt-5 mb-2 text-xs uppercase tracking-wider">📋 Ingredientes completos:</span>');
        descEl.innerHTML = safeDesc;
      } else {
        descEl.textContent = rawDesc;
      }
    }

    // WhatsApp Button link
    const waBtn = document.getElementById('askWhatsappBtn');
    if (waBtn) {
      const waNumber = (this.state.settings?.whatsapp_number || '+54 9 291 465-8502').replace(/[^\d]/g, '');
      const waText = encodeURIComponent(`¡Hola! Tengo una consulta sobre el producto "${p.name}" (${p.weight_kg}kg) que vi en la tienda CONVIVIA: ${window.location.href}`);
      waBtn.href = `https://wa.me/${waNumber}?text=${waText}`;
    }

    // Sticky mobile bar
    this.updateMobileStickyBar();
  },

  updatePriceDisplay() {
    const p = this.state.product;
    if (!p) return;

    const isPromo = this.state.priceMode === 'promo';
    const preferentialPrice = p.has_preferential_price ? (isPromo ? p.precio_preferencial_promo : p.precio_preferencial) : null;
    const mainPrice = preferentialPrice || (isPromo ? p.price_promo : p.price_list);
    const strikePrice = preferentialPrice ? p.price_list : (isPromo && p.savings > 0 ? p.price_list : null);
    const hasSavings = isPromo && (p.savings > 0 || p.has_preferential_price) && (Math.round(p.savings_percent) > 0);
    const pricePerKg = Math.round(mainPrice / Math.max(p.weight_kg, 1));

    const mainPriceEl = document.getElementById('productMainPrice');
    const strikePriceEl = document.getElementById('productStrikePrice');
    const savingsEl = document.getElementById('productSavingsBadge');
    const kgEl = document.getElementById('productPricePerKg');
    const priceModeDesc = document.getElementById('priceModeDescription');

    if (mainPriceEl) mainPriceEl.textContent = '$' + mainPrice.toLocaleString('es-AR');
    
    if (strikePriceEl) {
      if (strikePrice) {
        strikePriceEl.classList.remove('hidden');
        strikePriceEl.textContent = '$' + strikePrice.toLocaleString('es-AR');
      } else {
        strikePriceEl.classList.add('hidden');
      }
    }

    if (savingsEl) {
      if (hasSavings) {
        savingsEl.classList.remove('hidden');
        const pctText = `(-${Math.round(p.savings_percent)}%)`;
        savingsEl.textContent = `⚡ PRECIO PREFERENCIAL: Ahorrás $${p.savings.toLocaleString('es-AR')} ${pctText}`;
        savingsEl.className = p.has_custom_discount 
          ? 'inline-block px-3 py-1 rounded-xl text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
          : 'inline-block px-3 py-1 rounded-xl text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      } else {
        savingsEl.classList.add('hidden');
      }
    }

    if (kgEl) {
      kgEl.textContent = `$${pricePerKg.toLocaleString('es-AR')} / kg`;
    }

    if (priceModeDesc) {
      if (isPromo) {
        if (hasSavings) {
          priceModeDesc.textContent = `Precio con precio preferencial exclusivo (-${Math.round(p.savings_percent)}%) pagando con Transferencia Bancaria o Efectivo.`;
        } else {
          priceModeDesc.textContent = 'Precio directo sin descuento adicional pagando por Transferencia o Efectivo.';
        }
      } else {
        priceModeDesc.textContent = 'Precio regular de lista. Hasta 3 cuotas sin interés con todas las tarjetas.';
      }
    }

    // Actualizar Pilar 2 en ficha de producto
    const trustTitle = document.getElementById('productTrustDiscountTitle');
    const trustDesc = document.getElementById('productTrustDiscountDesc');
    if (trustTitle && trustDesc) {
      if (p.has_custom_discount && p.savings_percent > 0) {
        trustTitle.textContent = `${Math.round(p.savings_percent)}% OFF`;
        trustDesc.textContent = 'Precio Preferencial';
      } else if (this.state.generalDiscountEnabled && this.state.generalDiscountPercent > 0) {
        trustTitle.textContent = `${Math.round(this.state.generalDiscountPercent)}% OFF Real`;
        trustDesc.textContent = 'Transferencia';
      } else {
        trustTitle.textContent = 'Precio Directo';
        trustDesc.textContent = 'Sin Comisiones';
      }
    }

    this.updateMobileStickyBar();
  },

  updateMobileStickyBar() {
    const p = this.state.product;
    if (!p) return;
    const isPromo = this.state.priceMode === 'promo';
    const mainPrice = isPromo ? p.price_promo : p.price_list;
    const stickyPrice = document.getElementById('mobileStickyPrice');
    if (stickyPrice) stickyPrice.textContent = '$' + mainPrice.toLocaleString('es-AR');
  },

  switchGalleryImage(type) {
    const p = this.state.product;
    if (!p) return;
    this.state.activeImage = type;

    const mainImgEl = document.getElementById('mainProductImage');
    const thumb1 = document.getElementById('thumbPrimary');
    const thumb2 = document.getElementById('thumbSecondary');

    if (type === 'primary') {
      mainImgEl.src = p.image_url;
      thumb1.classList.add('active', 'ring-2', 'ring-emerald-400', 'border-emerald-500');
      thumb2.classList.remove('active', 'ring-2', 'ring-emerald-400', 'border-emerald-500');
    } else if (type === 'secondary' && p.secondary_image_url) {
      mainImgEl.src = p.secondary_image_url;
      thumb2.classList.add('active', 'ring-2', 'ring-emerald-400', 'border-emerald-500');
      thumb1.classList.remove('active', 'ring-2', 'ring-emerald-400', 'border-emerald-500');
    }
  },

  openLightbox(imgUrl) {
    const targetUrl = imgUrl || (this.state.activeImage === 'secondary' ? this.state.product.secondary_image_url : this.state.product.image_url);
    if (!targetUrl) return;

    const modal = document.getElementById('imageLightboxModal');
    const lightboxImg = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');

    lightboxImg.src = targetUrl;
    lightboxCaption.textContent = this.state.activeImage === 'secondary' 
      ? `Ficha Nutricional & Composición de ${this.state.product.name}`
      : this.state.product.name;

    modal.classList.add('active');
  },

  closeLightbox() {
    document.getElementById('imageLightboxModal')?.classList.remove('active');
  },

  changeQuantity(delta) {
    const newQty = this.state.quantity + delta;
    if (newQty >= 1 && newQty <= (this.state.product?.stock || 50)) {
      this.state.quantity = newQty;
      document.getElementById('quantityInput').value = newQty;
    }
  },

  addToCart(andCheckout = false) {
    const p = this.state.product;
    if (!p) return;

    const qty = parseInt(document.getElementById('quantityInput')?.value || 1);
    const existingIndex = this.state.cart.findIndex(item => item.id === p.id);

    if (existingIndex > -1) {
      this.state.cart[existingIndex].quantity += qty;
    } else {
      this.state.cart.push({
        id: p.id,
        name: p.name,
        brand: p.brand,
        animal: p.animal,
        weight_kg: p.weight_kg,
        price_list: p.price_list,
        price_promo: p.price_promo,
        image_url: p.image_url,
        quantity: qty
      });
    }

    localStorage.setItem('convivia_cart', JSON.stringify(this.state.cart));
    localStorage.setItem('pawpulse_cart', JSON.stringify(this.state.cart));
    this.updateCartBadge();

    if (andCheckout) {
      this.openCart();
      setTimeout(() => {
        if (typeof Checkout !== 'undefined') {
          Checkout.open();
        }
      }, 200);
    } else {
      this.showToast(`✓ ¡${qty}x ${p.name} agregado al carrito!`);
      this.openCart();
    }
  },

  onWeightSelectChange(newId) {
    if (newId && newId != this.state.product?.id) {
      window.location.href = `/product.html?id=${newId}`;
    }
  },

  renderWeightVariants() {
    const container = document.getElementById('productWeightSelectorContainer');
    const pills = document.getElementById('productWeightPills');
    const select = document.getElementById('productWeightSelect');
    const notice = document.getElementById('currentWeightBadgeNotice');
    if (!container) return;

    const variants = this.state.variants || [];
    const isNutricare = (this.state.product?.brand || '').toLowerCase() === 'nutricare';

    // Solo dejar las de Nutricare donde coincide el texto y cambia el peso en KG
    if (!isNutricare || variants.length <= 1) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    const currentId = this.state.product?.id;
    if (notice) notice.textContent = `Bolsa actual: ${this.state.product?.weight_kg} kg`;

    const isPromo = this.state.priceMode === 'promo';

    if (select) {
      select.innerHTML = variants.map(v => {
        const isSelected = v.id === currentId;
        const price = isPromo ? v.price_promo : v.price_list;
        return `
          <option value="${v.id}" ${isSelected ? 'selected' : ''}>
            ${v.weight_kg} kg — $${price.toLocaleString('es-AR')} (${v.name})
          </option>
        `;
      }).join('');
    }

    if (pills) {
      pills.innerHTML = variants.map(v => {
        const isSelected = v.id === currentId;
        const price = isPromo ? v.price_promo : v.price_list;
        return `
          <a 
            href="/product.html?id=${v.id}" 
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all border ${
              isSelected 
                ? 'bg-emerald-500/20 border-emerald-500 text-white font-black shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500' 
                : 'bg-black/50 border-white/10 text-gray-300 hover:border-emerald-500/50 hover:text-white'
            }"
          >
            <span class="font-bold text-xs">${v.weight_kg} kg</span>
            <span class="font-mono text-[11px] ${isSelected ? 'text-emerald-300 font-bold' : 'text-emerald-400 font-semibold'}">$${price.toLocaleString('es-AR')}</span>
            ${isSelected ? '<span class="text-emerald-400 font-bold text-xs ml-0.5">✓</span>' : ''}
          </a>
        `;
      }).join('');
    }
  },

  renderRelatedProducts() {
    const container = document.getElementById('relatedProductsGrid');
    if (!container || !this.state.related || this.state.related.length === 0) {
      document.getElementById('relatedProductsSection')?.classList.add('hidden');
      return;
    }

    container.innerHTML = this.state.related.map(p => {
      const isPromo = this.state.priceMode === 'promo';
      const price = isPromo ? p.price_promo : p.price_list;
      return `
        <div class="glass-panel card-interactive rounded-2xl p-4 flex flex-col justify-between group">
          <div class="relative w-full h-36 rounded-xl overflow-hidden mb-3 bg-black/40 border border-white/5 flex items-center justify-center p-2">
            <a href="/product.html?id=${p.id}" class="w-full h-full flex items-center justify-center">
              <img 
                src="${p.image_url}" 
                alt="${p.name}" 
                class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                loading="lazy"
                onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'"
              />
            </a>
            <div class="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-200">
              ${p.weight_kg} kg
            </div>
            ${(isPromo && p.savings > 0) ? `<div class="absolute top-2 right-2 ${p.has_custom_discount ? 'bg-purple-500/90 text-white' : 'bg-emerald-500/90 text-black'} font-extrabold text-[9px] px-1.5 py-0.5 rounded shadow">-${Math.round(p.savings_percent)}%</div>` : ''}
          </div>
          <div class="space-y-1 mb-3">
            <span class="text-[10px] font-bold uppercase text-purple-300">${p.brand}</span>
            <a href="/product.html?id=${p.id}" class="font-bold text-xs text-white line-clamp-2 hover:text-emerald-400 block transition-colors">
              ${p.name}
            </a>
          </div>
          <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <div>
              <span class="text-sm font-black text-emerald-400 font-mono">$${price.toLocaleString('es-AR')}</span>
            </div>
            <a href="/product.html?id=${p.id}" class="px-2.5 py-1.5 rounded-lg btn-subtle text-[11px] font-bold text-white hover:text-emerald-400 transition-colors">
              Ver
            </a>
          </div>
        </div>
      `;
    }).join('');
  },

  initSmartBowlWidget() {
    const p = this.state.product;
    if (!p) return;

    const slider = document.getElementById('sbWeightSlider');
    const weightVal = document.getElementById('sbWeightValue');
    const dailyGrams = document.getElementById('sbDailyGrams');
    const totalDays = document.getElementById('sbTotalDays');
    const bagNotice = document.getElementById('sbBagNotice');

    const toggleHeader = document.getElementById('productSbCalToggleHeader');
    const collapseContent = document.getElementById('productSbCalCollapseContent');
    const toggleText = document.getElementById('productSbCalToggleText');
    const toggleIcon = document.getElementById('productSbCalToggleIcon');
    const alertDateEl = document.getElementById('productSbAlertDate');
    const emptyDateEl = document.getElementById('productSbEmptyDate');
    const grid = document.getElementById('productSbCalendarGrid');

    // Default pet weights
    let initialPetWeight = p.animal === 'gato' ? 4.0 : (p.breed_size === 'pequeña' ? 6 : (p.breed_size === 'grande' ? 32 : 18));
    slider.value = initialPetWeight;
    slider.min = p.animal === 'gato' ? 1 : 2;
    slider.max = p.animal === 'gato' ? 12 : 70;
    slider.step = p.animal === 'gato' ? 0.2 : 0.5;

    let currentDurationDays = 0;
    let currentDailyGrams = 0;

    const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const renderCalendar = (days, triggerDay, grams) => {
      if (!grid) return;
      const today = new Date();
      const totalGramsInBag = p.weight_kg * 1000;
      let tilesHtml = '';

      const maxDays = Math.min(days + 2, 60);
      for (let i = 0; i <= maxDays; i++) {
        const d = new Date(today.getTime() + (i * 86400000));
        const dayNum = d.getDate();
        const dayOfWeek = dayNames[d.getDay()];
        const remainingGrams = Math.max(0, Math.round(totalGramsInBag - (i * grams)));
        const remainingKg = (remainingGrams / 1000).toFixed(1);

        let statusClass = 'calendar-day-tile';
        let badgeLabel = `${remainingKg} kg`;
        let badgeColor = 'text-gray-400';

        if (i === 0) {
          statusClass += ' status-start';
          badgeLabel = '🟢 Inicio';
          badgeColor = 'text-emerald-300 bg-emerald-500/20 font-bold';
        } else if (i === triggerDay) {
          statusClass += ' status-alert';
          badgeLabel = '⚠️ Alerta (-5d)';
          badgeColor = 'text-amber-300 bg-amber-500/20 font-black ring-1 ring-amber-400';
        } else if (i === days) {
          statusClass += ' status-empty';
          badgeLabel = '🔴 Vacío';
          badgeColor = 'text-red-300 bg-red-500/20 font-black ring-1 ring-red-400';
        } else if (i > days) {
          statusClass += ' status-depleted';
          badgeLabel = 'Agotado';
          badgeColor = 'text-gray-500';
        }

        tilesHtml += `
          <div class="${statusClass} p-1.5 rounded-xl flex flex-col justify-between min-h-[52px] text-left cursor-default select-none shadow-sm" title="Día ${i + 1}: ${dayNum} ${monthsEs[d.getMonth()]} | Restan ${remainingGrams}g">
            <div class="flex items-center justify-between">
              <span class="text-[9px] text-gray-400 font-semibold uppercase">${dayOfWeek}</span>
              <span class="text-[11px] font-mono font-black text-white">${dayNum}</span>
            </div>
            <div class="mt-0.5">
              <span class="text-[8px] px-1 py-0.5 rounded font-mono font-semibold block truncate ${badgeColor}">
                ${badgeLabel}
              </span>
            </div>
          </div>
        `;
      }
      grid.innerHTML = tilesHtml;
    };

    const portionsEl = document.getElementById('sbProductPortions');
    const dailyCostEl = document.getElementById('sbProductDailyCost');

    const calculate = (weight) => {
      weightVal.textContent = `${weight} kg`;
      let grams = 0;
      if (p.animal === 'gato') {
        if (weight <= 3.5) {
          const wNorm = Math.max(2.0, weight);
          grams = 35 + ((wNorm - 2.0) / 1.5) * 20;
        } else if (weight <= 6.0) {
          grams = 55 + ((weight - 3.5) / 2.5) * 35;
        } else {
          const wNorm = Math.min(10.0, weight);
          grams = 90 + ((wNorm - 6.0) / 4.0) * 35;
        }
        if (p.life_stage === 'cachorro') grams *= 1.25;
        else if (p.life_stage === 'senior') grams *= 0.90;
      } else {
        if (weight <= 5.0) {
          const wNorm = Math.max(2.0, weight);
          grams = 60 + ((wNorm - 2.0) / 3.0) * 50;
        } else if (weight <= 10.0) {
          grams = 110 + ((weight - 5.0) / 5.0) * 65;
        } else if (weight <= 20.0) {
          grams = 175 + ((weight - 10.0) / 10.0) * 105;
        } else if (weight <= 30.0) {
          grams = 280 + ((weight - 20.0) / 10.0) * 90;
        } else if (weight <= 40.0) {
          grams = 370 + ((weight - 30.0) / 10.0) * 80;
        } else if (weight <= 50.0) {
          grams = 450 + ((weight - 40.0) / 10.0) * 70;
        } else {
          const wNorm = Math.min(75.0, weight);
          grams = 520 + ((wNorm - 50.0) / 25.0) * 100;
        }
        if (p.life_stage === 'cachorro') grams *= 1.30;
        else if (p.life_stage === 'senior') grams *= 0.88;
      }
      if (grams <= 0) grams = 50;
      grams = Math.max(30, Math.round(grams));

      const totalGramsInBag = p.weight_kg * 1000;
      const days = Math.round(totalGramsInBag / grams);
      const triggerDay = Math.max(1, days - 5);

      const servings = (p.life_stage === 'cachorro') ? 3 : 2;
      const gramsPerServing = Math.round(grams / servings);
      const cups = (grams / 100).toFixed(1);

      const isPromo = this.state.priceMode === 'promo';
      const mainPrice = isPromo ? p.price_promo : p.price_list;
      const dailyCost = Math.round(mainPrice / Math.max(1, days));

      currentDurationDays = days;
      currentDailyGrams = grams;

      dailyGrams.textContent = `${grams} g/día`;
      totalDays.textContent = `${days} días`;
      
      if (portionsEl) portionsEl.textContent = `${servings} tomas de ${gramsPerServing}g (~${cups} vasos/d)`;
      if (dailyCostEl) dailyCostEl.textContent = `~$${dailyCost.toLocaleString('es-AR')} / día`;

      bagNotice.innerHTML = `<strong>Proporción Baires S.A.</strong>: ${servings} tomas de ${gramsPerServing}g. Esta bolsa de ${p.weight_kg} kg rinde <strong>${days} días</strong> (~${(days/7).toFixed(1)} semanas) con un costo de <strong>~$${dailyCost.toLocaleString('es-AR')} / día</strong>.`;

      const today = new Date();
      const alertDate = new Date(today.getTime() + (triggerDay * 86400000));
      const emptyDate = new Date(today.getTime() + (days * 86400000));

      if (alertDateEl) alertDateEl.textContent = `${alertDate.getDate()} de ${monthsEs[alertDate.getMonth()]}`;
      if (emptyDateEl) emptyDateEl.textContent = `${emptyDate.getDate()} de ${monthsEs[emptyDate.getMonth()]}`;

      renderCalendar(days, triggerDay, grams);
    };

    const toggleCalendar = () => {
      if (!collapseContent) return;
      const isHidden = collapseContent.classList.contains('hidden');
      if (isHidden) {
        collapseContent.classList.remove('hidden');
        if (toggleText) toggleText.textContent = '✕ Plegar';
        if (toggleIcon) toggleIcon.textContent = '▲';
        renderCalendar(currentDurationDays, Math.max(1, currentDurationDays - 5), currentDailyGrams);
      } else {
        collapseContent.classList.add('hidden');
        if (toggleText) toggleText.textContent = '👁️ Ver Calendario';
        if (toggleIcon) toggleIcon.textContent = '▼';
      }
    };

    toggleHeader?.addEventListener('click', toggleCalendar);

    calculate(initialPetWeight);
    slider.addEventListener('input', (e) => calculate(parseFloat(e.target.value)));
  },

  renderNotFound() {
    const main = document.querySelector('main');
    if (main) {
      main.innerHTML = `
        <div class="py-24 text-center space-y-4 max-w-md mx-auto">
          <div class="text-6xl">🔍</div>
          <h2 class="text-2xl font-bold text-white">Producto no encontrado</h2>
          <p class="text-xs text-gray-400">El producto solicitado no existe o fue retirado temporalmente del catálogo.</p>
          <a href="/" class="inline-block px-6 py-3 btn-primary-neon text-xs font-bold rounded-xl">
            ← Volver al Catálogo Principal
          </a>
        </div>
      `;
    }
  },

  bindEvents() {
    // Gallery Thumbnails
    document.getElementById('thumbPrimary')?.addEventListener('click', () => this.switchGalleryImage('primary'));
    document.getElementById('thumbSecondary')?.addEventListener('click', () => this.switchGalleryImage('secondary'));

    // Lightbox triggers
    document.getElementById('mainImageContainer')?.addEventListener('click', () => this.openLightbox());
    document.getElementById('openZoomBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openLightbox();
    });
    document.getElementById('secondaryDetailImg')?.addEventListener('click', () => {
      this.openLightbox(this.state.product?.secondary_image_url);
    });
    document.getElementById('closeLightboxBtn')?.addEventListener('click', () => this.closeLightbox());
    document.getElementById('imageLightboxModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'imageLightboxModal') this.closeLightbox();
    });

    // Quantity
    document.getElementById('qtyMinusBtn')?.addEventListener('click', () => this.changeQuantity(-1));
    document.getElementById('qtyPlusBtn')?.addEventListener('click', () => this.changeQuantity(1));

    // Cart actions
    document.getElementById('addToCartBtn')?.addEventListener('click', () => this.addToCart(false));
    document.getElementById('buyNowBtn')?.addEventListener('click', () => this.addToCart(true));
    document.getElementById('mobileStickyAddToCartBtn')?.addEventListener('click', () => this.addToCart(false));

    // Dual switch
    const switchPromo = document.getElementById('switchModePromo');
    const switchList = document.getElementById('switchModeList');
    if (switchPromo && switchList) {
      switchPromo.addEventListener('click', () => this.setPriceMode('promo'));
      switchList.addEventListener('click', () => this.setPriceMode('list'));
    }

    // Cart Drawer triggers
    document.getElementById('cartBtn')?.addEventListener('click', () => this.openCart());
    document.getElementById('closeCartBtn')?.addEventListener('click', () => this.closeCart());
    document.getElementById('cartDrawerOverlay')?.addEventListener('click', () => this.closeCart());
    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
      this.closeCart();
      if (typeof Checkout !== 'undefined') Checkout.open();
    });

    // Mobile Navigation triggers
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => this.openMobileMenu());
    document.getElementById('closeMobileNavBtn')?.addEventListener('click', () => this.closeMobileMenu());
    document.getElementById('mobileNavOverlay')?.addEventListener('click', () => this.closeMobileMenu());

    // ESC key listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMobileMenu();
        this.closeCart();
        this.closeLightbox();
      }
    });
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

  setPriceMode(mode) {
    this.state.priceMode = mode;
    const switchPromo = document.getElementById('switchModePromo');
    const switchList = document.getElementById('switchModeList');
    const discount = this.state.discountPercent;

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
      if (discount > 0) {
        this.showToast(`💸 Precios con ${Math.round(discount)}% OFF activados.`);
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

    this.updatePriceDisplay();
    this.renderWeightVariants();
    this.renderRelatedProducts();
  },

  openCart() {
    this.renderCartItems();
    document.getElementById('cartDrawer')?.classList.add('active');
    document.getElementById('cartDrawerOverlay')?.classList.add('active');
  },

  closeCart() {
    document.getElementById('cartDrawer')?.classList.remove('active');
    document.getElementById('cartDrawerOverlay')?.classList.remove('active');
  },

  updateCartBadge() {
    const totalCount = this.state.cart.reduce((sum, i) => sum + i.quantity, 0);
    const badges = document.querySelectorAll('#cartCountBadge, #bottomBarCartBadge, .cart-count-badge');
    badges.forEach(badge => {
      badge.textContent = totalCount;
      if (totalCount > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
  },

  renderCartItems() {
    const container = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('cartEmptyState');
    const subtotalEl = document.getElementById('cartSubtotal');
    const savingsEl = document.getElementById('cartSavings');
    const totalEl = document.getElementById('cartTotal');

    if (!container) return;

    if (this.state.cart.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      if (subtotalEl) subtotalEl.textContent = '$0';
      if (savingsEl) savingsEl.textContent = '-$0';
      if (totalEl) totalEl.textContent = '$0';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const isPromo = this.state.priceMode === 'promo';
    let subtotalList = 0;
    let totalActual = 0;

    container.innerHTML = this.state.cart.map((item, idx) => {
      const price = isPromo ? item.price_promo : item.price_list;
      const lineList = item.price_list * item.quantity;
      const lineActual = price * item.quantity;
      subtotalList += lineList;
      totalActual += lineActual;

      return `
        <div class="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3">
          <img src="${item.image_url}" class="w-14 h-14 object-contain rounded-xl bg-gray-900 border border-white/10 p-1" />
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
            <div class="text-[10px] text-gray-400 font-medium">
              ${item.brand} • ${item.weight_kg} kg
            </div>
            <div class="text-xs font-black text-emerald-400 font-mono mt-0.5">
              $${price.toLocaleString('es-AR')}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center border border-white/10 rounded-lg bg-black/50">
              <button onclick="ProductPage.updateItemQty(${idx}, -1)" class="w-6 h-6 flex items-center justify-center text-xs text-gray-300 hover:text-white">-</button>
              <span class="w-6 text-center text-xs font-bold text-white">${item.quantity}</span>
              <button onclick="ProductPage.updateItemQty(${idx}, 1)" class="w-6 h-6 flex items-center justify-center text-xs text-gray-300 hover:text-white">+</button>
            </div>
            <button onclick="ProductPage.removeItem(${idx})" class="text-gray-400 hover:text-rose-400 text-xs p-1">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    const savings = Math.max(0, subtotalList - totalActual);
    if (subtotalEl) subtotalEl.textContent = '$' + subtotalList.toLocaleString('es-AR');
    if (savingsEl) savingsEl.textContent = '-$' + savings.toLocaleString('es-AR');
    if (totalEl) totalEl.textContent = '$' + totalActual.toLocaleString('es-AR');
  },

  updateItemQty(idx, delta) {
    if (this.state.cart[idx]) {
      this.state.cart[idx].quantity += delta;
      if (this.state.cart[idx].quantity <= 0) {
        this.state.cart.splice(idx, 1);
      }
      localStorage.setItem('convivia_cart', JSON.stringify(this.state.cart));
    localStorage.setItem('pawpulse_cart', JSON.stringify(this.state.cart));
      this.updateCartBadge();
      this.renderCartItems();
    }
  },

  removeItem(idx) {
    this.state.cart.splice(idx, 1);
    localStorage.setItem('convivia_cart', JSON.stringify(this.state.cart));
    localStorage.setItem('pawpulse_cart', JSON.stringify(this.state.cart));
    this.updateCartBadge();
    this.renderCartItems();
  },

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'glass-panel px-4 py-3 rounded-2xl text-xs font-bold text-white shadow-2xl border border-emerald-500/40 flex items-center gap-2 animate-bounce';
    toast.innerHTML = `<span>✨</span><span>${message}</span>`;
    const container = document.getElementById('toastContainer');
    if (container) {
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProductPage.init();
});

// Funciones de navegación global adaptables a todos los dispositivos
window.openMobileMenu = function() {
  if (window.ProductPage && typeof window.ProductPage.openMobileMenu === 'function') {
    window.ProductPage.openMobileMenu();
  } else {
    document.getElementById('mobileNavDrawer')?.classList.add('active');
    document.getElementById('mobileNavOverlay')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};

window.closeMobileMenu = function() {
  if (window.ProductPage && typeof window.ProductPage.closeMobileMenu === 'function') {
    window.ProductPage.closeMobileMenu();
  } else {
    document.getElementById('mobileNavDrawer')?.classList.remove('active');
    document.getElementById('mobileNavOverlay')?.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

window.openConviviaCart = function() {
  if (window.ProductPage && typeof window.ProductPage.openCart === 'function') {
    window.ProductPage.openCart();
  } else if (window.App && typeof window.App.openCart === 'function') {
    window.App.openCart();
  } else {
    window.location.href = '/#catalogAnchor';
  }
};

window.setGlobalPriceMode = function(mode) {
  if (window.ProductPage && typeof window.ProductPage.setPriceMode === 'function') {
    window.ProductPage.setPriceMode(mode);
  } else if (window.App && typeof window.App.setPriceMode === 'function') {
    window.App.setPriceMode(mode);
  }
};

window.SpecialPages = window.SpecialPages || {
  selectBrandDirect: function(brandName) {
    if (!brandName || brandName === 'todas') {
      window.location.href = '/#catalogAnchor';
    } else {
      window.location.href = `/?brand=${encodeURIComponent(brandName)}#catalogAnchor`;
    }
  },
  filterByAnimal: function(animal) {
    window.location.href = `/?animal=${encodeURIComponent(animal)}#catalogAnchor`;
  }
};

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
