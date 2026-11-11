/**
 * Cartify Frontend — AI Shopping Assistant widget
 * Loaded on every store page through main.js. Adds a chat launcher and panel.
 *
 * - Answers come from the backend agent (/assistant/chat); no AI key in the browser.
 * - Product cards, comparison tables, cart and order cards are rendered from structured data
 *   returned by the backend tools (verified catalog data) using the store's existing product card
 *   markup. The assistant's own text is labelled as AI-generated.
 * - "Add to cart" from the assistant only happens when the customer presses Confirm.
 */
import { assistantAPI, cartAPI } from './api.js';

const STORE_KEY = 'cartify_assistant_conversation';
const SUGGESTIONS = ['Find a laptop for programming and university', 'Gift ideas under $60', 'Compare two headphones', "What's in my cart?", 'Where is my order?'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const store = {
  get: () => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(STORE_KEY, v) : localStorage.removeItem(STORE_KEY); } catch { /* private mode */ } },
};

// Stylesheet lives next to the other store styles
const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('../CSS/assistant.css', import.meta.url).href;
document.head.appendChild(css);

// ─── Markup ──────────────────────────────────────────────────────────────────
const root = document.createElement('div');
root.className = 'cartify-assistant';
root.innerHTML = `
  <button class="ca-launcher" type="button" aria-haspopup="dialog" aria-controls="ca-panel" aria-label="Open the Cartify shopping assistant">
    <i class="fa-solid fa-wand-magic-sparkles"></i><span>Ask Cartify</span>
  </button>
  <section class="ca-panel" id="ca-panel" role="dialog" aria-modal="false" aria-label="Cartify shopping assistant" hidden>
    <header class="ca-head">
      <div class="ca-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
      <div class="ca-title"><b>Cartify Assistant</b><span>AI shopping help · prices & stock are live</span></div>
      <button class="ca-icon" type="button" data-ca="new" title="New conversation" aria-label="Start a new conversation"><i class="fa-solid fa-rotate-right"></i></button>
      <button class="ca-icon" type="button" data-ca="close" title="Close" aria-label="Close the assistant"><i class="fa-solid fa-xmark"></i></button>
    </header>
    <div class="ca-msgs" aria-live="polite"></div>
    <div class="ca-suggest"></div>
    <form class="ca-input">
      <textarea rows="1" maxlength="2000" placeholder="Ask about products or orders…" aria-label="Message"></textarea>
      <button type="submit" class="ca-send" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
    </form>
  </section>`;
document.body.appendChild(root);

const panel = root.querySelector('.ca-panel');
const launcher = root.querySelector('.ca-launcher');
const msgs = root.querySelector('.ca-msgs');
const suggest = root.querySelector('.ca-suggest');
const form = root.querySelector('.ca-input');
const input = form.querySelector('textarea');
const sendBtn = form.querySelector('.ca-send');

let conversationId = store.get();
let started = false;
let busy = false;

// ─── Rendering ───────────────────────────────────────────────────────────────
// Escape first, then allow **bold** and "- " lists only.
function formatText(text) {
  let html = '', list = false;
  for (const raw of esc(text).split('\n')) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const li = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)$/);
    if (li) { if (!list) { html += '<ul>'; list = true; } html += `<li>${li[1]}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (line.trim()) html += `<p>${line}</p>`;
  }
  return html + (list ? '</ul>' : '');
}

const stars = (r = 0) => '<i class="fa-solid fa-star"></i>'.repeat(Math.floor(r)) + (r % 1 >= 0.5 ? '<i class="fa-solid fa-star-half-stroke"></i>' : '');
const fmtCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n || 0));

// Same markup and classes as the store's product cards (Js/index.js), so main.js handles
// opening the product page, add-to-cart and the wishlist heart exactly as elsewhere.
function productCard(p) {
  const color = p.defaultColor || 'Default';
  return `
    <div class="product-item ca-card" data-product-id="${esc(p.id)}" data-default-color="${esc(color)}">
      <div class="product-card">
        <div class="product-img-wrapper">
          ${p.discount > 0 ? '<span class="card-badge badge-new" style="background-color:#ef4444;">HOT DEAL</span>' : ''}
          ${p.inStock ? '' : '<span class="card-badge badge-new" style="background-color:#64748b;">OUT OF STOCK</span>'}
          <button class="btn-wishlist" data-product-id="${esc(p.id)}" aria-label="Add to wishlist"><i class="fa-regular fa-heart"></i></button>
          <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.src='./img/placeholder.png'" loading="lazy" />
        </div>
        <div class="product-details">
          <div class="d-flex align-items-center mb-2"><div class="rating">${stars(p.rating)}</div><span class="rating-count">(${fmtCount(p.reviews)})</span></div>
          <h3 class="product-title">${esc(p.name)}</h3>
          <div class="product-price-row">
            <div>${p.oldPrice ? `<div class="price-old">${money(p.oldPrice)}</div><div class="price price-hot">${money(p.price)}</div>` : `<div class="price">${money(p.price)}</div>`}</div>
            ${p.inStock ? `<button class="btn-add-cart" data-product-id="${esc(p.id)}" data-color="${esc(color)}" aria-label="Add ${esc(p.name)} to cart"><i class="fa-solid fa-cart-arrow-down"></i></button>` : `<a class="ca-options" href="./product.html?id=${esc(p.id)}" aria-label="View ${esc(p.name)}"><i class="fa-solid fa-arrow-right"></i></a>`}
          </div>
        </div>
      </div>
    </div>`;
}

const verified = (label) => `<div class="ca-verified"><i class="fa-solid fa-circle-check"></i> ${label}</div>`;
const ORDER_STATUS = { placed: 'Placed', confirmed: 'Confirmed', shipping: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' };

function blockHTML(b) {
  if (b.type === 'products') {
    return `<div class="ca-block">${verified(`From the Cartify catalog${b.title ? ` · ${esc(b.title)}` : ''}`)}<div class="ca-cards">${b.products.map(productCard).join('')}</div></div>`;
  }
  if (b.type === 'comparison') {
    const rows = [
      ['Price', (p) => `<b>${money(p.price)}</b>${p.oldPrice ? ` <s>${money(p.oldPrice)}</s>` : ''}`],
      ['Rating', (p) => `${(p.rating || 0).toFixed(1)} ★ <span class="ca-muted">(${fmtCount(p.reviews)})</span>`],
      ['Brand', (p) => esc(p.brand || '—')],
      ['Category', (p) => esc(p.category)],
      ['In stock', (p) => (p.inStockColors?.length ? esc(p.inStockColors.join(', ')) : '<span class="ca-muted">Out of stock</span>')],
      ['About', (p) => `<span class="ca-muted">${esc(p.description)}</span>`],
    ];
    return `<div class="ca-block">${verified('Comparison from the catalog')}
      <div class="ca-table-wrap"><table class="ca-table">
        <thead><tr><th></th>${b.products.map((p) => `<th><a href="./product.html?id=${esc(p.id)}"><img src="${esc(p.image)}" alt="" onerror="this.style.display='none'">${esc(p.name)}</a></th>`).join('')}</tr></thead>
        <tbody>${rows.map(([label, f]) => `<tr><th>${label}</th>${b.products.map((p) => `<td>${f(p)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div></div>`;
  }
  if (b.type === 'cart') {
    return `<div class="ca-block">${verified('Your cart')}
      ${b.items.length ? `<ul class="ca-lines">${b.items.map((i) => `<li><img src="${esc(i.image)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(i.name)}<small>${esc(i.color)} · ${i.quantity} × ${money(i.unitPrice)}</small></span><b>${money(i.lineTotal)}</b></li>`).join('')}</ul>
        <div class="ca-total"><span>Subtotal (${b.totalQuantity} item${b.totalQuantity === 1 ? '' : 's'})</span><b>${money(b.subtotal)}</b></div>` : '<p class="ca-muted">Your cart is empty.</p>'}
      <a class="ca-link" href="./cart.html">Go to cart <i class="fa-solid fa-arrow-right"></i></a></div>`;
  }
  if (b.type === 'order') {
    const o = b.order;
    return `<div class="ca-block">${verified(`Order #${esc(o.orderNumber)}`)}
      <div class="ca-order-status"><span class="ca-pill ca-pill-${esc(o.status)}">${esc(o.statusLabel)}</span><span class="ca-muted">${money(o.total)} · ${o.itemCount} item${o.itemCount === 1 ? '' : 's'}</span></div>
      <ol class="ca-timeline">${o.history.map((h) => `<li><b>${esc(ORDER_STATUS[h.status] || h.status)}</b><span>${new Date(h.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></li>`).join('')}</ol>
      ${o.trackingNumber ? `<p class="ca-muted">Tracking number: ${esc(o.trackingNumber)}</p>` : ''}
      <a class="ca-link" href="./history.html">Order history <i class="fa-solid fa-arrow-right"></i></a></div>`;
  }
  if (b.type === 'confirm_action' && b.kind === 'add_to_cart') {
    return `<div class="ca-block ca-confirm" data-action="${esc(b.actionId)}">
      <div class="ca-confirm-title"><i class="fa-solid fa-cart-plus"></i> ${esc(b.title)}</div>
      <div class="ca-confirm-item"><img src="${esc(b.product.image)}" alt="" onerror="this.style.visibility='hidden'"><span><b>${esc(b.product.name)}</b><small>${esc(b.color)} · Qty ${b.quantity}</small></span><b>${money(b.lineTotal)}</b></div>
      <div class="ca-confirm-actions"><button type="button" class="btn-cta-secondary" data-decide="cancel">Cancel</button><button type="button" class="btn-cta-primary" data-decide="confirm">Confirm</button></div>
    </div>`;
  }
  return '';
}

function addMessage(role, text, blocks = [], { ok = true } = {}) {
  const el = document.createElement('div');
  el.className = `ca-msg ca-${role}${ok ? '' : ' ca-fail'}`;
  el.setAttribute('dir', 'auto');
  if (role === 'ai') el.innerHTML = `${text ? `<div class="ca-bubble">${formatText(text)}<span class="ca-ai-note"><i class="fa-solid fa-wand-magic-sparkles"></i> AI-generated · check details on the product page</span></div>` : ''}${blocks.map(blockHTML).join('')}`;
  else el.innerHTML = `<div class="ca-bubble">${esc(text)}</div>`;
  msgs.appendChild(el);
  el.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', () => decide(b.closest('[data-action]'), b.dataset.decide)));
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

function showSuggestions(show) {
  suggest.innerHTML = show ? SUGGESTIONS.map((s) => `<button type="button">${esc(s)}</button>`).join('') : '';
  suggest.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => send(b.textContent)));
}

async function refreshCartBadge() {
  try {
    const { totalQuantity = 0 } = await cartAPI.getQuantity();
    document.querySelectorAll('.cart-badge').forEach((b) => { b.textContent = totalQuantity; b.style.display = totalQuantity > 0 ? 'flex' : 'none'; });
  } catch { /* badge refresh is best-effort */ }
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function decide(card, decision) {
  card.querySelectorAll('button').forEach((b) => (b.disabled = true));
  const actions = card.querySelector('.ca-confirm-actions');
  try {
    const r = decision === 'confirm' ? await assistantAPI.confirm(card.dataset.action, conversationId) : await assistantAPI.cancel(card.dataset.action, conversationId);
    actions.innerHTML = `<span class="ca-done ${decision === 'confirm' ? '' : 'ca-muted'}"><i class="fa-solid ${decision === 'confirm' ? 'fa-check' : 'fa-xmark'}"></i> ${esc(r.result.message)}</span>`;
    if (decision === 'confirm') refreshCartBadge();
  } catch (err) {
    actions.innerHTML = `<span class="ca-done ca-err"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message)}</span>`;
  }
}

async function send(text) {
  text = String(text || '').trim();
  if (!text || busy) return;
  busy = true; sendBtn.disabled = true;
  showSuggestions(false);
  addMessage('user', text);
  const typing = document.createElement('div');
  typing.className = 'ca-msg ca-ai';
  typing.innerHTML = '<div class="ca-bubble ca-typing" aria-label="The assistant is typing"><i></i><i></i><i></i></div><span class="ca-wait">Looking through the catalog… this can take up to a minute</span>';
  msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
  try {
    let r;
    try {
      r = await assistantAPI.chat(text, conversationId);
    } catch (err) {
      if (err.status !== 404 || !conversationId) throw err;
      conversationId = null; store.set(null); // conversation expired or belongs to a previous session
      r = await assistantAPI.chat(text);
    }
    conversationId = r.conversationId; store.set(conversationId);
    typing.remove();
    addMessage('ai', r.reply.text, r.reply.blocks || []);
  } catch (err) {
    typing.remove();
    addMessage('sys', err.status === 503 ? 'The assistant is not available right now. You can still browse and search the store.' : err.message || 'Something went wrong. Please try again.', [], { ok: false });
  }
  busy = false; sendBtn.disabled = false;
  input.focus();
}

async function start() {
  if (started) return;
  started = true;
  try {
    const s = await assistantAPI.status();
    if (!s.enabled) {
      addMessage('sys', 'The shopping assistant is not available right now. You can still browse categories and search products.', [], { ok: false });
      form.hidden = true;
      return;
    }
  } catch { /* network issue: let the first message report it */ }
  if (conversationId) {
    try {
      const h = await assistantAPI.conversation(conversationId);
      h.transcript.forEach((t) => addMessage(t.role === 'assistant' ? 'ai' : t.role === 'user' ? 'user' : 'sys', t.text, t.blocks || [], { ok: t.ok !== false }));
      const pending = new Set((h.pendingActions || []).map((a) => a.actionId));
      msgs.querySelectorAll('[data-action]').forEach((c) => { if (!pending.has(c.dataset.action)) c.querySelector('.ca-confirm-actions').innerHTML = '<span class="ca-done ca-muted">Handled</span>'; });
    } catch { conversationId = null; store.set(null); }
  }
  if (!msgs.children.length) {
    addMessage('ai', "Hi! I'm the Cartify assistant. Tell me what you're looking for — your budget, what it's for — and I'll find matching products. I can also compare products, show your cart and check your orders.");
    showSuggestions(true);
  }
}

function open() {
  panel.hidden = false;
  root.classList.add('ca-open');
  launcher.setAttribute('aria-expanded', 'true');
  start();
  setTimeout(() => input.focus(), 50);
}
function close() {
  panel.hidden = true;
  root.classList.remove('ca-open');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.focus();
}

launcher.addEventListener('click', () => (panel.hidden ? open() : close()));
root.querySelector('[data-ca="close"]').addEventListener('click', close);
root.querySelector('[data-ca="new"]').addEventListener('click', () => {
  conversationId = null; store.set(null); msgs.innerHTML = ''; started = false; form.hidden = false; start();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value; input.value = ''; input.style.height = ''; send(t); });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 110)}px`; });
