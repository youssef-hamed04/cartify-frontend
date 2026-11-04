/**
 * Cartify Frontend — index.js
 * Handles: categories grid, category product grids (with pagination + sorting),
 * home page featured products swiper.
 *
 * Product detail is now handled entirely by product.html's own inline module.
 */

import { productsAPI, categoriesAPI } from './api.js';

const category = document.body.dataset.category;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function starsHTML(rating = 0) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let html = '';
  for (let i = 0; i < full; i++) html += '<i class="fa-solid fa-star"></i>';
  if (half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
  return html;
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

function getBadge(product, index) {
  if (product.discount > 0) return `<span class="card-badge badge-new" style="background-color:#ef4444;">HOT DEAL</span>`;
  if (index === 0) return `<span class="card-badge badge-new">NEW ARRIVAL</span>`;
  if ((product.rating?.count || 0) > 1000) return `<span class="card-badge badge-new">BEST SELLER</span>`;
  return '';
}

function priceHTML(product) {
  const final = product.finalPrice || product.price || 0;
  const original = product.price || 0;
  if (product.discount > 0) {
    return `<div class="price-old">$${original.toFixed(2)}</div>
            <div class="price price-hot">$${final.toFixed(2)}</div>`;
  }
  return `<div class="price">$${final.toFixed(2)}</div>`;
}

// ─── Product card HTML ────────────────────────────────────────────────────────
// IMPORTANT:
//   data-product-id and data-default-color are on the OUTER .col wrapper.
//   The .btn-add-cart button also has data-product-id and data-color directly,
//   so main.js delegation can read them from the button OR the card — both work.
//   color is NEVER empty: falls back to first variant color or 'Default'.

function productCardHTML(product, index = 0) {
  const image = product.variants?.[0]?.images?.[0]?.url || '';
  const color = product.variants?.[0]?.color || 'Default';
  const rating = product.rating?.average || 0;
  const count = product.rating?.count || 0;

  return `
    <div class="col product-item wow fadeInUp" data-wow-delay="${(index % 4) * 0.1}s"
         data-product-id="${product._id}" data-default-color="${color}">
      <div class="product-card" style="cursor:pointer;"
           >
        <div class="product-img-wrapper">
          ${getBadge(product, index)}
          <button class="btn-wishlist"
           data-product-id="${product._id}" >
            <i class="fa-regular fa-heart"></i>
          </button>
          <img src="${image}" alt="${product.name}"
               onerror="this.src='./img/placeholder.png'" loading="lazy" />
        </div>
        <div class="product-details">
          <div class="d-flex align-items-center mb-2">
            <div class="rating">${starsHTML(rating)}</div>
            <span class="rating-count">(${formatCount(count)})</span>
          </div>
          <h3 class="product-title">${product.name}</h3>
          <div class="product-price-row">
            ${priceHTML(product)}
            <button class="btn-add-cart"
                    data-product-id="${product._id}"
                    data-color="${color}">
              <i class="fa-solid fa-cart-arrow-down"></i>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

// ─── Category → backend name map ──────────────────────────────────────────────
const CATEGORY_MAP = {
  electronics: 'Electronics',
  fashion: 'Fashion',
  living: 'Home & Living',
  beauty: 'Beauty',
  accessories: 'Accessories',
  school: 'School Supplies',
};

// ─── Pagination state ─────────────────────────────────────────────────────────
let currentPage = 1;
let totalPages = 1;
let currentParams = {};
const ITEMS_PER_PAGE = 4;

// ─── Load category products ───────────────────────────────────────────────────
async function loadCategoryProducts(page = 1) {
  const gridId = `product-grid-${category}`;
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

  try {
    const backendCategory = CATEGORY_MAP[category];
    const params = {
      ...currentParams,
      page,
      limit: ITEMS_PER_PAGE,
      ...(backendCategory ? { category: backendCategory } : {}),
    };

    const data = await productsAPI.getAll(params);
    currentPage = data.page || 1;
    totalPages = data.totalPages || 1;

    if (!data.products?.length) {
      grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">No products found.</div>';
      renderPagination();
      return;
    }

    grid.innerHTML = data.products.map((p, i) => productCardHTML(p, i)).join('');

    renderPagination(data.totalPages, data.page);

    // Sync wishlist hearts after cards are in DOM
    // (main.js exports syncWishlistButtons but we avoid circular imports —
    //  wishlist sync is triggered on each page init in main.js anyway)

    if (window.WOW) { try { new WOW({ live: true }).init(); } catch (_) { } }

  } catch (err) {
    console.error(err);
    console.error('Failed to load products:', err);
    grid.innerHTML = '<div class="col-12 text-center py-5 text-danger">Failed to load products. Is the backend running?</div>';
  }
}

// ─── Pagination renderer ──────────────────────────────────────────────────────
function renderPagination(total = totalPages, current = currentPage) {
  const container = document.querySelector('.pagination-custom');
  if (!container) return;

  const goTo = (p) => { loadCategoryProducts(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  let html = `<li><a href="#" class="${current <= 1 ? 'disabled' : ''}" id="prev-page">
                <i class="fa-solid fa-chevron-left"></i></a></li>`;

  const maxVisible = 5;
  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (start > 1) {
    html += `<li><a href="#" data-page="1">1</a></li>`;
    if (start > 2) html += `<li><a href="#" class="dots">…</a></li>`;
  }
  for (let i = start; i <= end; i++) {
    html += `<li><a href="#" class="${i === current ? 'active' : ''}" data-page="${i}">${i}</a></li>`;
  }
  if (end < total) {
    if (end < total - 1) html += `<li><a href="#" class="dots">…</a></li>`;
    html += `<li><a href="#" data-page="${total}">${total}</a></li>`;
  }

  html += `<li><a href="#" class="${current >= total || total === 0 ? 'disabled' : ''}" id="next-page">
             <i class="fa-solid fa-chevron-right"></i></a></li>`;

  container.innerHTML = html;

  container.querySelectorAll('a[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const p = parseInt(link.dataset.page);
      if (!isNaN(p) && p !== currentPage) goTo(p);
    });
  });

  container.querySelector('#prev-page')?.addEventListener('click', e => {
    e.preventDefault();
    if (currentPage > 1) goTo(currentPage - 1);
  });
  container.querySelector('#next-page')?.addEventListener('click', e => {
    e.preventDefault();
    if (currentPage < totalPages) goTo(currentPage + 1);
  });
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────
const sortMap = {
  'Most Popular': 'rating',
  'Newest': 'newest',
  'Price: Low to High': 'price_asc',
};

document.querySelectorAll('.sort-by .dropdown-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const label = item.textContent.trim();
    currentParams.sort = sortMap[label] || 'newest';
    const sortBtn = document.querySelector('.sort-by .filter-btn');
    if (sortBtn) sortBtn.innerHTML = `${label} <i class="fa-solid fa-chevron-down ms-1" style="font-size:0.7rem"></i>`;
    loadCategoryProducts(1);
  });
});

// ─── Navbar search (category pages) ──────────────────────────────────────────
const searchInput = document.querySelector('.nav-search input');
if (searchInput && category) {
  let _searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      const q = searchInput.value.trim();
      currentParams.search = q || undefined;
      loadCategoryProducts(1);
    }, 400);
  });
}

// ─── Categories page ──────────────────────────────────────────────────────────
async function loadCategories() {
  const container = document.getElementById('categories-grid');
  if (!container) return;

  container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

  try {
    const data = await categoriesAPI.getAll();
    const categories = data.categories || [];

    if (!categories.length) {
      container.innerHTML = '<div class="col-12 text-center text-muted py-5">No categories found.</div>';
      return;
    }

    const bgMap = {
      'electronics': './img/Background electronics.png',
      'fashion': './img/Background fashion.png',
      'home-and-living': './img/Background home-and-living.png',
      'beauty': './img/Background beauty.png',
      'accessories': './img/Background accessories.png',
      'school-supplies': './img/Background school-supplies.png',
    };

    const pageMap = {
      'electronics': './cat-electronics.html',
      'fashion': './cat-fashion.html',
      'home-and-living': './cat-home-and-living.html',
      'beauty': './cat-beauty.html',
      'accessories': './cat-accessories.html',
      'school-supplies': './cat-school-supplies.html',
    };

    container.innerHTML = categories.map(cat => {
      const bgImg = cat.image?.url || bgMap[cat.slug] || './img/placeholder.png';
      const page = pageMap[cat.slug] || '#';
      return `
        <div class="col-lg-3 col-md-6">
          <a href="${page}" class="category-card wow fadeInUp">
            <img src="${bgImg}" alt="${cat.name}"
                 onerror="this.src='./img/placeholder.png'" loading="lazy" />
            <div class="category-overlay">
              <div class="mb-2">
                <i class="${cat.icon || 'fa-solid fa-tag'} fa-2x text-white"></i>
              </div>
              <h5 class="fw-bold m-0">${cat.name}</h5>
              <small class="opacity-75">${cat.productCount || 0} Products</small>
            </div>
          </a>
        </div>`;
    }).join('');

    if (window.WOW) { try { new WOW({ live: true }).init(); } catch (_) { } }

  } catch (err) {
    console.error(err);
    console.error('Failed to load categories:', err);
    container.innerHTML = '<div class="col-12 text-center text-danger py-5">Failed to load categories. Is the backend running?</div>';
  }
}

// ─── Home page — Featured Products Swiper ────────────────────────────────────
async function loadFeaturedProducts() {
  const swiperWrapper = document.querySelector('.productSwiper .swiper-wrapper');
  if (!swiperWrapper) return;

  try {
    const data = await productsAPI.getFeatured(12);
    const products = data.products || [];
    if (!products.length) return;

    swiperWrapper.innerHTML = products.map(p => {
      const image = p.variants?.[0]?.images?.[0]?.url || '';
      const color = p.variants?.[0]?.color || 'Default';
      const final = p.finalPrice || p.price || 0;
      const rating = p.rating?.average || 0;
      const count = p.rating?.count || 0;
      return `
        <div class="swiper-slide h-auto"
             data-product-id="${p._id}" data-default-color="${color}">
          <div class=" bg-light border-0 text-start card-producct h-100"
               style="cursor:pointer;"
               >
            <div class="bg-image" style="position:relative;">
              <img src="${image}" class="w-100 d-block" alt="${p.name}"
                   onerror="this.src='./img/placeholder.png'" loading="lazy" />
            </div>
            <div class="p-3">
              <h6>
                <i class="fa-solid fa-star" style="color:rgb(255,212,59)"></i>
                ${rating.toFixed(1)} (${formatCount(count)} reviews)
              </h6>
              <h5>${p.name}</h5>
              <h4>$${final.toFixed ? final.toFixed(2) : final}</h4>
              <span class="btn button-cartt w-100 mt-2 add-to-cart-btn"
                    data-product-id="${p._id}"
                    data-color="${color}"
                    >
                <i class="fa-solid fa-cart-shopping"></i> Add to Cart
              </span>
            </div>
          </div>
        </div>`;
    }).join('');

    if (window.Swiper) {
      new Swiper('.productSwiper', {
        slidesPerView: 1,
        spaceBetween: 24,
        loop: true,
        autoplay: { delay: 4000, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true, dynamicBullets: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        breakpoints: { 576: { slidesPerView: 2 }, 992: { slidesPerView: 3 }, 1200: { slidesPerView: 4 } },
      });
    }
  } catch (err) {
    console.error(err);
    console.error('Failed to load featured products:', err);
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
(async function () {
  if (document.getElementById('categories-grid')) await loadCategories();
  if (document.querySelector('.productSwiper .swiper-wrapper')) await loadFeaturedProducts();
  if (category) await loadCategoryProducts(1);
  // product.html is fully self-contained — index.js does NOT run there.
})();
