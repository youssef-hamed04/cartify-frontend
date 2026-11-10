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
  // multipart: fields + variantsMeta JSON + image files (no JSON Content-Type)
  create: async (formData) => {
    const res = await fetch(BASE + '/products', { method: 'POST', credentials: 'include', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.err || data.errors?.[0]?.msg || data.message || 'Request failed'), { status: res.status, data });
    return data;
  },
  syncCategoryCounts: () => adminFetch('/categories/sync-counts', { method: 'POST' }),
  setWeights: (id, weights) => adminFetch(`/products/${id}/weights`, { method: 'PATCH', body: JSON.stringify({ weights }) }),
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

// ── Demand forecasting ────────────────────────────────────────────────────────
const qs = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return q ? '?' + q : '';
};

export const forecastAdminAPI = {
  status:  ()            => adminFetch('/forecasts/status'),
  run:     (horizons)    => adminFetch('/forecasts/run', { method: 'POST', body: JSON.stringify(horizons ? { horizons } : {}) }),
  latest:  (params = {}) => adminFetch(`/forecasts/latest${qs(params)}`),
  product: (id, params = {}) => adminFetch(`/forecasts/products/${id}${qs(params)}`),
  runs:    ()            => adminFetch('/forecasts/runs'),
};

// ── Branches & inventory intelligence ─────────────────────────────────────────
export const branchesAdminAPI = {
  getAll: () => adminFetch('/branches'),
};

export const inventoryAdminAPI = {
  overview:        (params = {}) => adminFetch(`/inventory/overview${qs(params)}`),
  branch:          (id, params = {}) => adminFetch(`/inventory/branches/${id}${qs(params)}`),
  setStock:        (branchId, productId, data) => adminFetch(`/inventory/branches/${branchId}/products/${productId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  product:         (id, params = {}) => adminFetch(`/inventory/products/${id}${qs(params)}`),
  lowStock:        (params = {}) => adminFetch(`/inventory/low-stock${qs(params)}`),
  excess:          (params = {}) => adminFetch(`/inventory/excess${qs(params)}`),
  anomalies:       (params = {}) => adminFetch(`/inventory/anomalies${qs(params)}`),
  movements:       (params = {}) => adminFetch(`/inventory/movements${qs(params)}`),
  createMovement:  (data) => adminFetch('/inventory/movements', { method: 'POST', body: JSON.stringify(data) }),
  movementAction:  (id, action, note) => adminFetch(`/inventory/movements/${id}/${action}`, { method: 'PATCH', body: JSON.stringify(note ? { note } : {}) }),
  recommendations: (params = {}) => adminFetch(`/inventory/recommendations${qs(params)}`),
  generate:        (horizonDays) => adminFetch('/inventory/recommendations/generate', { method: 'POST', body: JSON.stringify({ horizonDays }) }),
  decide:          (id, action, note) => adminFetch(`/inventory/recommendations/${id}/${action}`, { method: 'PATCH', body: JSON.stringify(note ? { note } : {}) }),
};

// ── Inventory agent (AI) ──────────────────────────────────────────────────────
export const agentAdminAPI = {
  status:  ()                         => adminFetch('/assistant/status'),
  chat:    (message, conversationId)  => adminFetch('/assistant/inventory/chat', { method: 'POST', body: JSON.stringify({ message, conversationId }) }),
  history: (id)                       => adminFetch(`/assistant/inventory/conversations/${id}`),
  confirm: (actionId, conversationId) => adminFetch(`/assistant/inventory/actions/${actionId}/confirm`, { method: 'POST', body: JSON.stringify({ conversationId }) }),
  cancel:  (actionId, conversationId) => adminFetch(`/assistant/inventory/actions/${actionId}/cancel`, { method: 'POST', body: JSON.stringify({ conversationId }) }),
};
