/**
 * Js/admin-api.js
 * All admin API calls — mirrors the pattern in api.js but for admin endpoints.
 * Uses credentials: 'include' exactly like the existing api.js.
 */

const BASE = 'http://localhost:3001';

async function adminFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.err || data.message || 'Request failed'), { status: res.status, data });
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const adminAuth = {
  login:   (email, password) => adminFetch('/users/auth', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout:  ()                => adminFetch('/users/logout', { method: 'POST' }),
  me:      ()                => adminFetch('/users/me'),
};

// ── Dashboard stats ───────────────────────────────────────────────────────────
export const statsAPI = {
  products:  ()  => adminFetch('/products?limit=1'),
  orders:    ()  => adminFetch('/orders?limit=1'),
  returns:   ()  => adminFetch('/returns?limit=1'),
  users:     ()  => adminFetch('/users?limit=1'),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsAdminAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return adminFetch(`/products${q ? '?' + q : ''}`);
  },
  delete: (id) => adminFetch(`/products/${id}`, { method: 'DELETE' }),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersAdminAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return adminFetch(`/orders${q ? '?' + q : ''}`);
  },
  updateStatus: (id, status) =>
    adminFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ── Returns ───────────────────────────────────────────────────────────────────
export const returnsAdminAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return adminFetch(`/returns${q ? '?' + q : ''}`);
  },
  getById: (id)        => adminFetch(`/returns/${id}`),
  updateStatus: (id, status) =>
    adminFetch(`/returns/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ── Camera sessions ───────────────────────────────────────────────────────────
export const cameraAdminAPI = {
  getSessions:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return adminFetch(`/camera/sessions${q ? '?' + q : ''}`);
  },
  getSession:         (id)       => adminFetch(`/camera/session/${id}`),
  getByReturn:        (returnId) => adminFetch(`/camera/return/${returnId}`),
  deleteSession:      (id)       => adminFetch(`/camera/session/${id}`, { method: 'DELETE' }),
};

// ── Categories ────────────────────────────────────────────────────────────────
export const categoriesAdminAPI = {
  getAll: () => adminFetch('/categories'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAdminAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return adminFetch(`/users${q ? '?' + q : ''}`);
  },
};
