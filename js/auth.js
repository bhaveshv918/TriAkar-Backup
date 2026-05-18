/* TriAkar — auth.js */

const Auth = (function () {
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://triakar.onrender.com';

  const TOKEN_KEY = 'ta_token';
  const USER_KEY  = 'ta_user';

  function getToken()  { return localStorage.getItem(TOKEN_KEY); }
  function isLoggedIn() { return !!getToken(); }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch (_) { return null; }
  }

  function authHeader() {
    const t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function _save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function _clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function signup(email, password, full_name, phone) {
    const res = await fetch(API_BASE + '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name, phone: phone || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    return data;
  }

  async function login(email, password) {
    const res = await fetch(API_BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    _save(data.access_token, data.user);
    _updateNav();
    return data;
  }

  async function logout() {
    const token = getToken();
    if (token) {
      try {
        await fetch(API_BASE + '/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        });
      } catch (_) {}
    }
    _clear();
    _updateNav();
    window.location.href = 'index.html';
  }

  function _updateNav() {
    // Delegate to shared.js updateNavAuth if available
    if (typeof updateNavAuth === 'function') { updateNavAuth(); return; }
  }

  function init() { _updateNav(); }

  return { signup, login, logout, getToken, getUser, isLoggedIn, authHeader, init, API_BASE };
})();
