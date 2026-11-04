/**
 * Cartify Frontend — Main JS
 * Global: cart badge, wishlist badge, add-to-cart delegation,
 * wishlist toggle, wishlist/cart page rendering, track page init,
 * navbar, newsletter, animations.
 *
 * Pages that own their own logic (inline modules — do NOT duplicate here):
 *   checkout.html  → renderCheckoutItems, placeOrder
 *   history.html   → filterOrders, loadOrders
 *   returns.html   → submitReturnRequest, selectItem, selectReason
 *   support.html   → activateTab (inline <script>)
 */

import { cartAPI, wishlistAPI } from './api.js';
import { getUser, updateNavAuthUI } from './auth.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CART — backend-driven
// ═══════════════════════════════════════════════════════════════════════════════

let _cartCache = null;

async function getCart() {
  try {
    if (_cartCache) return _cartCache;
    const data = await cartAPI.get();
    _cartCache = data;
    return data;
  } catch (_) {
    return { cart: { items: [] }, subtotal: 0, totalQuantity: 0 };
  }
}

function invalidateCart() { _cartCache = null; }

async function getCartCount() {
  try {
    const data = await cartAPI.getQuantity();
    return data.totalQuantity || 0;
  } catch (_) { return 0; }
}

export async function updateCartBadge() {
  const count = await getCartCount();
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });
}
export async function addToCartBackend(productId, color, quantity = 1) {
  console.log('ADDING', {
    productId,
    color,
    quantity
  });

  try {
    const data = await cartAPI.add(productId, color, quantity);
    invalidateCart();
    if (data.stockLimitReached) {
      showToast(`Only ${data.available} left in stock`);
      return false;
    }
    await updateCartBadge();
    document.querySelectorAll('.cart-badge').forEach(badge => {
      badge.style.transform = 'scale(1.5)';
      setTimeout(() => badge.style.transform = 'scale(1)', 300);
    });
    return true;
  } catch (err) {
    console.error(err);
    showToast('Could not add to cart: ' + (err.message || ''));
    return false;
  }
}
document.addEventListener('click', (e) => {
  const card = e.target.closest('.product-card,.card-producct');

  if (!card) return;

  // Ignore action buttons
  if (e.target.closest('.btn-add-cart, .btn-wishlist, .add-to-cart-btn')) {
    return;
  }

  const productId = card.closest('[data-product-id]')?.dataset.productId;

  if (productId) {
    window.location.href = `./product.html?id=${productId}`;
  }
});
// ─── Add-to-cart global delegation ──────────────────────────────────────────
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-add-cart, .button-cartt, .add-to-cart-btn');
  if (!btn) return;
  if (btn.closest('#add-all-to-cart')) return;
  // Walk up to the card container that holds data-product-id
  const card = btn.closest(
    '[data-product-id], .product-card, .product-item, ' +
    '.swiper-slide, .card-producct, .card-product, .rec-card'
  );
  if (!card) return;

  const productId = btn.dataset.productId || card.dataset.productId;
  const color = btn.dataset.color || card.dataset.defaultColor;

  if (!productId || !color) {
    showToast('Please select a color/variant first');
    return;
  }
  console.log('ADD TO CART CLICKED', { productId, color });
  // On product detail page respect the quantity selector
  let qty = 1;
  const qtyEl = document.getElementById('quantity');
  if (qtyEl && btn.closest('.col-lg-6, #add-to-cart-btn')) {
    qty = parseInt(qtyEl.textContent) || 1;
  }

  const titleEl = card.querySelector('.product-title, h5, h3, h4.rec-title');
  const name = titleEl ? titleEl.textContent.trim() : 'Item';

  btn.disabled = true;
  const added = await addToCartBackend(productId, color, qty);
  if (added) showToast(`Added ${qty}x ${name} to cart`);
  setTimeout(() => { btn.disabled = false; }, 1000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════

function showToast(msg) {
  let toast = document.querySelector('.wishlist-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'wishlist-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WISHLIST — backend-driven
// ═══════════════════════════════════════════════════════════════════════════════

let _wishlistCache = null;

async function getWishlist() {
  try {
    if (_wishlistCache) return _wishlistCache;
    const data = await wishlistAPI.get();
    _wishlistCache = data.wishList || { items: [] };
    return _wishlistCache;
  } catch (_) {
    return { items: [] };
  }
}

function invalidateWishlist() { _wishlistCache = null; }

async function updateWishlistBadge() {
  try {
    const wishlist = await getWishlist();
    const count = wishlist.items?.length || 0;
    document.querySelectorAll('.wishlist-badge').forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
    const countText = document.getElementById('wishlist-count-text');
    if (countText) countText.textContent = count + (count === 1 ? ' item' : ' items');
  } catch (_) { }
}

async function syncWishlistButtons() {
  try {
    const wishlist = await getWishlist();
    const wishlistIds = new Set(
      (wishlist.items || []).map(i =>
        i.productId?._id?.toString() || i.productId?.toString()
      )
    );
    document.querySelectorAll('.btn-wishlist, .cardswhishlist').forEach(btn => {
      const card = btn.closest(
        '.product-card, .product-item, .swiper-slide, ' +
        '.card-producct, .card-product, .rec-card, [data-product-id]'
      );
      if (!card) return;
      const productId = card.dataset.productId;
      if (!productId) return;
      const icon = btn.querySelector('i');
      if (!icon) return;
      if (wishlistIds.has(productId)) {
        icon.classList.replace('fa-regular', 'fa-solid');
        icon.style.color = '#ef4444';
        btn.classList.add('active-wish');
      } else {
        icon.classList.replace('fa-solid', 'fa-regular');
        icon.style.color = '';
        btn.classList.remove('active-wish');
      }
    });
  } catch (_) { }
}

// ─── Wishlist toggle global delegation ──────────────────────────────────────
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-wishlist, .cardswhishlist');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const card = btn.closest(
    '.product-card, .product-item, .swiper-slide, ' +
    '.card-producct, .card-product, .rec-card, [data-product-id]'
  );
  if (!card) return;
  const productId = card.dataset.productId;
  if (!productId) return;

  try {
    const data = await wishlistAPI.toggle(productId);
    invalidateWishlist();
    const icon = btn.querySelector('i');
    if (data.added) {
      if (icon) { icon.classList.replace('fa-regular', 'fa-solid'); icon.style.color = '#ef4444'; }
      btn.classList.add('active-wish');
      showToast('Added to wishlist');
    } else {
      if (icon) { icon.classList.replace('fa-solid', 'fa-regular'); icon.style.color = ''; }
      btn.classList.remove('active-wish');
      showToast('Removed from wishlist');
    }
    await updateWishlistBadge();
  } catch (_) {
    showToast('Could not update wishlist');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WISHLIST PAGE
// ═══════════════════════════════════════════════════════════════════════════════

async function renderWishlistPage() {
  const grid = document.getElementById('wishlist-grid');
  const emptyState = document.getElementById('wishlist-empty');
  const heroSection = document.querySelector('.wishlist-hero');
  if (!grid) return;

  try {
    const wishlist = await getWishlist();
    const items = wishlist.items || [];
    await updateWishlistBadge();

    if (items.length === 0) {
      grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (heroSection) {
        const actions = heroSection.querySelector('.wishlist-actions');
        if (actions) actions.style.display = 'none';
      }
      return;
    }

    grid.style.display = '';
    if (emptyState) emptyState.style.display = 'none';
    if (heroSection) {
      const actions = heroSection.querySelector('.wishlist-actions');
      if (actions) actions.style.display = 'flex';
    }

    grid.innerHTML = '';

    items.forEach((item, index) => {
      const product = item.productId;
      if (!product) return;
      const productId = product._id || product;
      const name = product.name || 'Product';
      const price = product.finalPrice || product.price || 0;
      const image = product.variants?.[0]?.images?.[0]?.url || '';
      const rating = product.rating?.average || 4.5;
      const color = product.variants?.[0]?.color || '';

      const col = document.createElement('div');
      col.className = 'col';
      col.style.animationDelay = (index * 0.08) + 's';

      const fullStars = Math.floor(rating);
      const hasHalf = rating % 1 >= 0.5;
      let starsHTML = '';
      for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fa-solid fa-star"></i>';
      if (hasHalf) starsHTML += '<i class="fa-solid fa-star-half-stroke"></i>';

      col.innerHTML = `
        <div class="wishlist-card" data-product-id="${productId}">
          <div class="wishlist-card-img">
            <button class="wishlist-remove-btn" data-product-id="${productId}" title="Remove">
              <i class="fa-solid fa-xmark"></i>
            </button>
            <img src="${image}" alt="${name}" onerror="this.src='./img/placeholder.png'" />
          </div>
          <div class="wishlist-card-body">
            <div class="wishlist-card-rating">
              <span class="stars">${starsHTML}</span>
              <span class="rating-val">${rating}</span>
            </div>
            <h3 class="wishlist-card-title">${name}</h3>
            <div class="wishlist-card-price">$${price.toFixed ? price.toFixed(2) : price}</div>
            <button class="wishlist-add-cart-btn"
                    data-product-id="${productId}"
                    data-color="${color}">
              <i class="fa-solid fa-cart-shopping"></i> Add to Cart
            </button>
          </div>
        </div>`;
      grid.appendChild(col);
    });

    // Remove-from-wishlist buttons
    grid.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
      btn.addEventListener('click', async function () {
        const pid = this.dataset.productId;
        const wc = this.closest('.wishlist-card');
        if (wc) wc.classList.add('wishlist-card-removing');
        setTimeout(async () => {
          try {
            await wishlistAPI.remove(pid);
            invalidateWishlist();
            await renderWishlistPage();
            showToast('Removed from wishlist');
          } catch (_) { }
        }, 350);
      });
    });

    // Add-to-cart from wishlist page
    grid.querySelectorAll('.wishlist-add-cart-btn').forEach(btn => {
      btn.addEventListener('click', async function () {
        const pid = this.dataset.productId;
        const clr = this.dataset.color;
        if (!pid || !clr) { showToast('No variant available'); return; }
        this.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
        this.classList.add('added');
        await addToCartBackend(pid, clr, 1);
        setTimeout(() => {
          this.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Add to Cart';
          this.classList.remove('added');
        }, 1500);
      });
    });

  } catch (err) {
    console.error(err);
    console.error('Wishlist render error:', err);
  }
}

// Clear All wishlist
const clearAllBtn = document.getElementById('clear-all-wishlist');
if (clearAllBtn) {
  clearAllBtn.addEventListener('click', async () => {
    try {
      await wishlistAPI.empty();
      invalidateWishlist();
      await renderWishlistPage();
      showToast('Wishlist cleared');
    } catch (_) { }
  });
}

// Add All to Cart
const addAllBtn = document.getElementById('add-all-to-cart');
if (addAllBtn) {
  addAllBtn.addEventListener('click', async () => {
    try {
      const wishlist = await getWishlist();
      const items = wishlist.items || [];
      if (!items.length) return;
      for (const item of items) {
        const product = item.productId;
        if (!product?._id) continue;
        const color = product.variants?.[0]?.color;
        if (color) await addToCartBackend(product._id, color, 1);
      }
      showToast(`Added ${items.length} item(s) to cart`);
    } catch (_) { }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CART PAGE
// ═══════════════════════════════════════════════════════════════════════════════

async function renderCartPage() {
  const container = document.getElementById('cart-items-container');
  const emptyState = document.getElementById('cart-empty-state');
  const summarySection = document.getElementById('cart-summary-section');
  const actionsBottom = document.getElementById('cart-actions-bottom');
  const leftCol = document.getElementById('cart-left-column');
  if (!container) return;

  try {
    const { cart, subtotal } = await getCart();
    const items = cart?.items || [];

    if (items.length === 0) {
      if (leftCol) leftCol.className = 'col-12';
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (summarySection) summarySection.style.display = 'none';
      if (actionsBottom) actionsBottom.style.setProperty('display', 'none', 'important');
      return;
    }

    if (leftCol) leftCol.className = 'col-lg-7 col-xl-8';
    if (emptyState) emptyState.style.display = 'none';
    if (summarySection) summarySection.style.display = 'block';
    if (actionsBottom) actionsBottom.style.setProperty('display', 'flex', 'important');

    container.innerHTML = '';

    items.forEach(item => {
      const product = item.productId;
      if (!product) return;
      const productId = product._id;
      const name = product.name || 'Product';
      const color = item.color;
      const price = (product.finalPrice || product.price || 0) * item.quantity;
      const image = product.variants
        ?.find(v => v.color.toLowerCase() === color.toLowerCase())?.images?.[0]?.url
        || product.variants?.[0]?.images?.[0]?.url || '';
      const category = (product.category || '').toLowerCase();

      let bgColor = '#cbd5e1';
      if (category.includes('electronic')) bgColor = '#bfdbfe';
      else if (category.includes('fashion')) bgColor = '#fecdd3';
      else if (category.includes('beauty')) bgColor = '#fce7f3';
      else if (category.includes('home') || category.includes('living')) bgColor = '#bbf7d0';
      else if (category.includes('school')) bgColor = '#fef9c3';
      else if (category.includes('accessories')) bgColor = '#fef3c7';

      const div = document.createElement('div');
      div.className = 'cart-item-card';
      div.innerHTML = `
        <div class="cart-img-wrapper" style="background-color:${bgColor}">
          <img src="${image}" alt="${name}" onerror="this.src='./img/placeholder.png'" />
        </div>
        <div class="cart-item-details flex-grow-1">
          <div class="cart-item-title">${name}</div>
          <div class="cart-item-subtitle">${color} · ${product.category || ''}</div>
          <div class="qty-delete-wrapper d-flex align-items-center mt-2">
            <div class="qty-control shadow-sm">
              <button class="qty-btn qty-minus"
                      data-product-id="${productId}" data-color="${color}">
                <i class="fa-solid fa-minus"></i>
              </button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn qty-plus"
                      data-product-id="${productId}" data-color="${color}">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
            <button class="cart-item-delete"
                    data-product-id="${productId}" data-color="${color}" title="Remove">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="cart-item-price align-self-center">$${price.toFixed(2)}</div>`;
      container.appendChild(div);
    });

    const subEl = document.getElementById('summary-subtotal');
    const totEl = document.getElementById('summary-total');
    if (subEl) subEl.textContent = `$${(subtotal || 0).toFixed(2)}`;
    if (totEl) totEl.textContent = `$${(subtotal || 0).toFixed(2)}`;

    container.querySelectorAll('.qty-minus').forEach(btn => {
      btn.addEventListener('click', async function () {
        try {
          await cartAPI.reduceQuantity(this.dataset.productId, this.dataset.color);
          invalidateCart(); await renderCartPage(); await updateCartBadge();
        } catch (_) { }
      });
    });

    container.querySelectorAll('.qty-plus').forEach(btn => {
      btn.addEventListener('click', async function () {
        try {
          await cartAPI.addQuantity(this.dataset.productId, this.dataset.color);
          invalidateCart(); await renderCartPage(); await updateCartBadge();
        } catch (_) { }
      });
    });

    container.querySelectorAll('.cart-item-delete').forEach(btn => {
      btn.addEventListener('click', async function () {
        const card = this.closest('.cart-item-card');
        if (card) card.classList.add('cart-item-removing');
        const pid = this.dataset.productId;
        const clr = this.dataset.color;
        setTimeout(async () => {
          try {
            await cartAPI.removeItem(pid, clr);
            invalidateCart(); await renderCartPage(); await updateCartBadge();
          } catch (_) { }
        }, 400);
      });
    });

  } catch (err) {
    console.error(err);
    console.error('Cart render error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER TRACKING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function initTrackPage() {
  const trackDetails = document.getElementById('track-order-details');
  if (!trackDetails) return;

  const lastOrder = JSON.parse(localStorage.getItem('cartifyLastOrder') || 'null');
  if (!lastOrder) {
    const mainCard = document.querySelector('.track-main-card');
    if (mainCard) mainCard.innerHTML = `
      <div class="text-center py-5">
        <i class="fa-solid fa-box-open fa-3x text-muted mb-3"></i>
        <h4>No active order to track.</h4>
        <a href="./Categories.html" class="btn btn-primary rounded-pill mt-3 px-4">Start Shopping</a>
      </div>`;
    return;
  }

  trackDetails.textContent = `Order #${lastOrder.orderId} • Placed ${lastOrder.date}`;

  if (lastOrder.items?.length) {
    const fi = lastOrder.items[0];
    const img = document.getElementById('track-product-img');
    const nme = document.getElementById('track-product-name');
    const prc = document.getElementById('track-product-price');
    const ddate = document.getElementById('track-delivery-date');
    const plDate = document.getElementById('track-placed-date');
    const procDate = document.getElementById('track-processing-date');

    if (img) img.src = fi.imageUrl || fi.image || '';
    if (nme) nme.textContent = fi.name || 'Product';
    if (prc) prc.textContent = `$${((fi.unitPrice || fi.price || 0) * (fi.quantity || 1)).toFixed(2)}`;

    const ord = new Date(lastOrder.date);
    const deliv = new Date(ord); deliv.setDate(ord.getDate() + 4);
    const proc = new Date(ord); proc.setDate(ord.getDate() + 1);
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };

    if (ddate) ddate.textContent = deliv.toLocaleDateString('en-US', opts);
    if (plDate) plDate.textContent = lastOrder.date + ' - 09:42 AM';
    if (procDate) procDate.textContent = 'Estimated ' + proc.toLocaleDateString('en-US', opts);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════

const navbar = document.querySelector('.nav-home');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
}

(function () {
  const pg = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.classList.remove('active');
    const pt = link.dataset.page;
    if (pt === 'home' && pg === 'index.html') link.classList.add('active');
    else if (pt === 'returns' && pg === 'returns.html') link.classList.add('active');
    else if (pt === 'support' && pg === 'support.html') link.classList.add('active');
    else if (pt === 'categories' && (
      pg === 'Categories.html' ||
      pg.toLowerCase().includes('cat-') ||
      pg.toLowerCase().includes('categories')
    )) link.classList.add('active');
  });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// NEWSLETTER
// ═══════════════════════════════════════════════════════════════════════════════

function _showInputErr(input, msg) {
  input.parentElement.querySelector('.input-error-msg')?.remove();
  const s = document.createElement('span');
  s.className = 'input-error-msg';
  s.textContent = msg;
  s.style.cssText = 'color:#f11b1b;font-size:13px;font-weight:700;display:block;margin-top:6px;';
  input.style.borderColor = '#f11b1b';
  input.parentElement.appendChild(s);
  setTimeout(() => {
    input.style.borderColor = '';
    s.remove();
  }, 3500);
}

const newsletterForms = document.querySelectorAll('.newsletter-form');
newsletterForms.forEach(form => {
  const inp = form.querySelector('input[type="email"], input');
  const bnt = form.querySelector('button');
  if (inp) inp.removeAttribute('required');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = inp?.value?.trim() || '';
    if (!email) { _showInputErr(inp, 'Please enter your email!'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _showInputErr(inp, 'Invalid email address'); return; }
    if (bnt) bnt.textContent = 'Joined ✓';
    if (inp) inp.value = '';
  });
});

const emailBox = document.querySelector('.email-box input');
const sendIcn = document.querySelector('.send-icon');
if (emailBox && sendIcn) {
  sendIcn.style.cssText += ';pointer-events:all;cursor:pointer;';
  const _doSubmit = () => {
    const v = emailBox.value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!v || !ok) {
      emailBox.style.border = '2px solid red';
      emailBox.value = '';
      emailBox.placeholder = v ? 'Invalid email!' : 'Enter your email!';
      setTimeout(() => { emailBox.style.border = ''; emailBox.placeholder = 'Email address'; }, 2500);
      return;
    }
    emailBox.style.border = '2px solid #4caf50';
    emailBox.value = '';
    emailBox.placeholder = 'Subscribed! ✓';
    sendIcn.style.color = '#4caf50';
    setTimeout(() => {
      emailBox.style.border = ''; emailBox.placeholder = 'Email address'; sendIcn.style.color = '';
    }, 3000);
  };
  sendIcn.addEventListener('click', _doSubmit);
  emailBox.addEventListener('keypress', e => { if (e.key === 'Enter') _doSubmit(); });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const leftMain = document.querySelector('.left-main');
const rightMain = document.querySelector('.right-main');
if (leftMain && rightMain) {
  window.addEventListener('load', () => {
    leftMain.style.cssText += ';opacity:0;transform:translateX(-40px);transition:all 0.8s ease;';
    rightMain.style.cssText += ';opacity:0;transform:translateX(40px);transition:all 0.8s ease 0.3s;';
    setTimeout(() => { leftMain.style.opacity = '1'; leftMain.style.transform = 'none'; }, 100);
    setTimeout(() => { rightMain.style.opacity = '1'; rightMain.style.transform = 'none'; }, 300);
  });
}

const cta1 = document.querySelector('.button-log');
if (cta1) cta1.addEventListener('click', () => { window.location.href = './signup.html'; });

const cta2 = document.querySelector('.log-home .button-logg');
if (cta2 && cta2.textContent.trim() === 'Explore Shop') {
  cta2.addEventListener('click', () => { window.location.href = './Categories.html'; });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL — qty + gallery
// ═══════════════════════════════════════════════════════════════════════════════

const decreaseBtn = document.getElementById('decrease');
const increaseBtn = document.getElementById('increase');
const quantitySpan = document.getElementById('quantity');
if (decreaseBtn && increaseBtn && quantitySpan) {
  let _qty = parseInt(quantitySpan.textContent) || 1;
  decreaseBtn.addEventListener('click', () => {
    if (_qty > 1) { _qty--; quantitySpan.textContent = _qty; }
  });
  increaseBtn.addEventListener('click', () => {
    _qty++; quantitySpan.textContent = _qty;
  });
}

const mainProductImg = document.getElementById('product-img');
const smallImgs = document.getElementsByClassName('small-img');
if (mainProductImg && smallImgs.length > 0) {
  for (let i = 0; i < smallImgs.length; i++) {
    smallImgs[i].addEventListener('click', function () {
      mainProductImg.src = this.src;
      Array.from(smallImgs).forEach(s => s.classList.remove('active'));
      this.classList.add('active');
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACK TO TOP
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  const btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
  document.body.appendChild(btn);
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 350), { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

window.addEventListener('load', () => {
  if (window.location.hash) {
    const el = document.querySelector(window.location.hash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════

(async function init() {
  try {
    await updateCartBadge();
    await updateWishlistBadge();
    updateNavAuthUI();

    if (document.getElementById('wishlist-grid')) await renderWishlistPage();
    if (document.getElementById('cart-items-container')) await renderCartPage();
    if (document.getElementById('track-order-details')) initTrackPage();
    // checkout.html, history.html, returns.html all self-init via their own inline modules

    await syncWishlistButtons();
  } catch (err) {
    console.error(err);
    console.error('[main] init error:', err);
  }
})();

