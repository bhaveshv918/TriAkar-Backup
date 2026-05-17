/* TriAkar — auth.js */

const Auth = (function () {
  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000' : '';

  const TOKEN_KEY = 'ta_token';
  const USER_KEY  = 'ta_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (_) { return null; }
  }

  function isLoggedIn() { return !!getToken(); }

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

  function authHeader() {
    const t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function _updateNav() {
    const user = getUser();
    document.querySelectorAll('.nav-auth-link').forEach(el => el.remove());

    const label = user
      ? ((user.user_metadata?.full_name || user.email || 'Account').split(' ')[0])
      : 'Login';

    document.querySelectorAll('.nav-links').forEach(nav => {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href = 'account.html';
      a.textContent = label;
      a.className = 'nav-auth-link';
      li.appendChild(a);
      nav.appendChild(li);
    });

    document.querySelectorAll('.nav-drawer').forEach(nav => {
      const a = document.createElement('a');
      a.href = 'account.html';
      a.textContent = label;
      a.className = 'nav-auth-link';
      nav.appendChild(a);
    });
  }

  function init() { _updateNav(); }

  return { signup, login, logout, getToken, getUser, isLoggedIn, authHeader, init };
})();
