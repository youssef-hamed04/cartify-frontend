/**
 * Js/admin-core.js
 * Shared utilities injected into every admin page.
 * - Auth guard (redirect to login if not admin)
 * - Sidebar injection
 * - Toast notifications
 * - Pagination helper
 * - Date/status formatters
 */

import { adminAuth } from './admin-api.js';

// ── Auth guard ────────────────────────────────────────────────────────────────
export async function requireAdmin() {
  try {
    const data = await adminAuth.me();
    const user = data.data?.user || data.user;
    if (!user || user.role !== 'admin') throw new Error('Not admin');
    return user;
  } catch {
    window.location.href = './admin-login.html';
    return null;
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const SIDEBAR_LINKS = [
  {
    section: 'Overview', links: [
      { href: 'admin-dashboard.html', icon: 'fa-solid fa-gauge', label: 'Dashboard' },
    ]
  },
  {
    section: 'Catalogue', links: [
      { href: 'admin-products.html', icon: 'fa-solid fa-box', label: 'Products' },
    ]
  },
  {
    section: 'Orders', links: [
      { href: 'admin-orders.html', icon: 'fa-solid fa-receipt', label: 'Orders' },
      { href: 'admin-returns.html', icon: 'fa-solid fa-rotate-left', label: 'Return Orders', badge: 'returns' },
    ]
  },
  {
    section: 'System', links: [
      { href: 'admin-camera.html', icon: 'fa-solid fa-camera', label: 'Camera Sessions' },
      { href: 'admin-users.html', icon: 'fa-solid fa-users', label: 'Users' },
    ]
  },
];

export function injectSidebar(user, pendingReturns = 0) {
  const sidebar = document.getElementById('admin-sidebar');
  if (!sidebar) return;

  const current = window.location.pathname.split('/').pop();
  const initial = (user?.name || user?.email || 'A')[0].toUpperCase();

  let navHtml = '';
  for (const sec of SIDEBAR_LINKS) {
    navHtml += `<div class="nav-section-label">${sec.section}</div>`;
    for (const link of sec.links) {
      const active = current === link.href ? 'active' : '';
      const badge = link.badge === 'returns' && pendingReturns > 0
        ? `<span class="sidebar-badge">${pendingReturns}</span>` : '';
      navHtml += `<a href="./${link.href}" class="sidebar-link ${active}">
        <i class="${link.icon}"></i>${link.label}${badge}
      </a>`;
    }
  }

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <img src="./img/the main logo 2.png" alt="Cartify" onerror="this.style.display='none'">
      <span>Cartify</span>
      <span class="badge-admin">Admin</span>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-footer">
      <div class="avatar">${initial}</div>
      <div class="user-info">
        <div class="user-name">${user?.name || user?.email || 'Admin'}</div>
        <div class="user-role">Administrator</div>
      </div>
      <button class="logout-btn" id="logout-btn" title="Logout">
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>
    </div>`;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await adminAuth.logout().catch(() => { });
    window.location.href = './admin-login.html';
  });

  // Hamburger toggle for mobile
  document.getElementById('hamburger')?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'default') {
  let el = document.querySelector('.admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'admin-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `admin-toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Date formatter ────────────────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
  pending: 'badge-pending',
  completed: 'badge-completed',
  expired: 'badge-expired',
  denied: 'badge-denied',
  confirmed: 'badge-confirmed',
  failed: 'badge-failed',
  uploading: 'badge-uploading',
  processing: 'badge-processing',
  delivered: 'badge-completed',
  processing_order: 'badge-processing',
  shipped: 'badge-info',
  cancelled: 'badge-denied',
};
export function statusBadge(status) {
  const cls = STATUS_MAP[status] || 'badge-info';
  return `<span class="badge ${cls}">${status || '—'}</span>`;
}

// ── Pagination builder ────────────────────────────────────────────────────────
export function buildPagination(containerId, infoId, page, totalPages, total, limit, onGo) {
  const info = document.getElementById(infoId);
  const box = document.getElementById(containerId);
  if (!box) return;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  if (info) info.textContent = total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`;

  let html = `<button class="pg-btn" id="pg-prev" ${page <= 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-left" style="font-size:.65rem"></i></button>`;

  const maxBtn = 5;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + maxBtn - 1);
  for (let i = start; i <= end; i++) {
    html += `<button class="pg-btn ${i === page ? 'active' : ''}" data-p="${i}">${i}</button>`;
  }

  html += `<button class="pg-btn" id="pg-next" ${page >= totalPages ? 'disabled' : ''}>
             <i class="fa-solid fa-chevron-right" style="font-size:.65rem"></i></button>`;

  box.innerHTML = html;

  box.querySelector('#pg-prev')?.addEventListener('click', () => onGo(page - 1));
  box.querySelector('#pg-next')?.addEventListener('click', () => onGo(page + 1));
  box.querySelectorAll('[data-p]').forEach(b =>
    b.addEventListener('click', () => onGo(parseInt(b.dataset.p)))
  );
}

// ── generateLockerCode (must match backend algorithm exactly) ─────────────────
// We re-implement it client-side so the admin can see the current code.
// Uses Web Crypto API (available in all modern browsers).
export async function generateLockerCode(userId, secretKey, dateStr = null) {
  if (!userId || !secretKey) return null;

  const date = dateStr || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const input = `${date}:${String(userId)}:${secretKey}`;

  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(hashBuf);

  const raw = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
  const code = (raw % 9000) + 1000;
  return String(code);
}
