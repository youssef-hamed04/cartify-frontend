/**
 * Cartify Frontend — Auth State Manager
 * Manages current user session across all pages.
 */

import { authAPI } from './api.js';

const AUTH_KEY = 'cartify_user';

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser = null;

try {
  const stored = localStorage.getItem(AUTH_KEY);
  if (stored) currentUser = JSON.parse(stored);
} catch (_) { }

export function getUser() { return currentUser; }
export function isLoggedIn() { return !!currentUser; }
export function isAdmin() { return currentUser?.role === 'admin'; }

function saveUser(user) {
  currentUser = user;
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_KEY);
}

// ─── Login (magic link / email only) ─────────────────────────────────────────
export async function login(email) {
  const data = await authAPI.login(email);
  saveUser(data.user);
  return data.user;
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function logout() {
  try { await authAPI.logout(); } catch (_) { }
  saveUser(null);
  window.location.href = './index.html';
}

// ─── Refresh user from server ─────────────────────────────────────────────────
export async function refreshUser() {
  try {
    const data = await authAPI.getMe();
    saveUser(data.user);
    return data.user;
  } catch (_) {
    saveUser(null);
    return null;
  }
}

// ─── Update user profile ──────────────────────────────────────────────────────
export async function updateProfile(payload) {
  const data = await authAPI.updateMe(payload);
  saveUser(data.user);
  return data.user;
}

// ─── Update navbar icons based on login state ────────────────────────────────
export function updateNavAuthUI() {
  const user = getUser();
  const accountLinks = document.querySelectorAll('a[href="./login.html"], a[href="./profile.html"]');
  accountLinks.forEach(link => {
    if (user) {
      link.setAttribute('href', './profile.html');
      link.setAttribute('title', user.firstName || user.email);
    } else {
      link.setAttribute('href', './login.html');
      link.setAttribute('title', 'Account');
    }
  });
}
