/**
 * Cartify Frontend — API Configuration & Helper
 * All backend communication goes through this file.
 */

const API_BASE = 'http://localhost:3001';
// const API_BASE = 'https://cartify-backend-mqtt.vercel.app';

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    credentials: 'include',       // always send cookies (token + sessionId)
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }
  if (config.body instanceof FormData) {
    delete config.headers['Content-Type']; // let browser set multipart boundary
  }
  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.err || data.msg || 'Request failed', data };
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email) => apiFetch('/users/auth', { method: 'POST', body: { email } }),
  logout: () => apiFetch('/users/logout', { method: 'POST' }),
  getMe: () => apiFetch('/users/me'),
  updateMe: (data) => apiFetch('/users/me', { method: 'PATCH', body: data }),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products${qs ? '?' + qs : ''}`);
  },
  getById: (id) => apiFetch(`/products/${id}`),
  getBySlug: (slug) => apiFetch(`/products/slug/${slug}`),
  getFeatured: (limit = 8) => apiFetch(`/products/featured?limit=${limit}`),
  getCategories: () => apiFetch('/products/categories'),
  getBrands: () => apiFetch('/products/brands'),
  getReviews: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products/${id}/reviews${qs ? '?' + qs : ''}`);
  },
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const categoriesAPI = {
  getAll: () => apiFetch('/categories'),
  getBySlug: (slug) => apiFetch(`/categories/${slug}`),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────
export const cartAPI = {
  get: () => apiFetch('/cart'),
  getQuantity: () => apiFetch('/cart/quantity'),
  add: (productId, color, quantity = 1) => apiFetch('/cart', { method: 'POST', body: { productId, color, quantity } }),
  addQuantity: (productId, color) => apiFetch('/cart/add-quantity', { method: 'PATCH', body: { productId, color } }),
  reduceQuantity: (productId, color) => apiFetch('/cart/reduce-quantity', { method: 'PATCH', body: { productId, color } }),
  removeItem: (productId, color) => apiFetch('/cart/remove-item', { method: 'PATCH', body: { productId, color } }),
  empty: () => apiFetch('/cart/empty', { method: 'PATCH' }),
};

// ─── Wishlist ──────────────────────────────────────────────────────────────────
export const wishlistAPI = {
  get: () => apiFetch('/wishlist'),
  toggle: (productId) => apiFetch('/wishlist/toggle', { method: 'POST', body: { productId } }),
  remove: (productId) => apiFetch(`/wishlist/item/${productId}`, { method: 'DELETE' }),
  empty: () => apiFetch('/wishlist/empty', { method: 'DELETE' }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersAPI = {
  getMy: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/orders/my${qs ? '?' + qs : ''}`);
  },
  getById: (id) => apiFetch(`/orders/${id}`),
  create: (data) => apiFetch('/orders', { method: 'POST', body: data }),
  getShippingRates: () => apiFetch('/orders/shipping-rates'),
};

// ─── Returns ──────────────────────────────────────────────────────────────────
export const returnsAPI = {
  create: (data) => apiFetch('/returns', { method: 'POST', body: data }),
  getMy: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/returns/my${qs ? '?' + qs : ''}`);
  },
  getById: (id) => apiFetch(`/returns/${id}`),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviewsAPI = {
  create: (data) => apiFetch('/reviews', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/reviews/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => apiFetch(`/reviews/${id}`, { method: 'DELETE' }),
};

export default apiFetch;
