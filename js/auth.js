/* TriAkar — auth.js */

const Auth = (function () {
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://triakar.onrender.com';

  const TOKEN_KEY   = 'ta_token';
  const USER_KEY    = 'ta_user';
  const REFRESH_KEY = 'ta_refresh';   // FIX #11: store refresh token
  const EXPIRY_KEY  = 'ta_expiry';    // FIX #11: store expiry timestamp

  function getToken()   { return localStorage.getItem(TOKEN_KEY); }
  function isLoggedIn() { return !!getToken(); }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch (_) { return null; }
  }

  // FIX #11: authHeader automatically refreshes the token if it's expired/near-expiry
  async function authHeaderAsync() {
    await _maybeRefresh();
    const t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  // Synchronous fallback (for callers that can't await) — token may be stale
  function authHeader() {
    const t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function _save(token, user, refresh, expiresIn) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    // store expiry as unix ms — default to 55 min if not provided (Supabase default is 60min)
    const expiry = Date.now() + ((expiresIn || 3300) * 1000);
    localStorage.setItem(EXPIRY_KEY, String(expiry));
  }

  function _clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }

  // FIX #11: refresh the Supabase access token using the refresh token
  // Called before any authenticated API request
  let _refreshPromise = null;
  async function _maybeRefresh() {
    const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
    // Refresh if expired or expiring within 5 minutes
    if (expiry && Date.now() < expiry - 5 * 60 * 1000) return;
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return;
    // Deduplicate concurrent refresh calls
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async () => {
      try {
        // Use Supabase's token refresh endpoint directly
        const res = await fetch('https://qarjbmogersuaerkhlcu.supabase.co/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcmpibW9nZXJzdWFlcmtobGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMzNzMsImV4cCI6MjA5NDU3OTM3M30.iS7VcO9j9UjlmBN0EhhuWBOu6Vvrg8-SQrb3oZ25AIs' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.access_token) {
            const user = getUser();
            _save(d.access_token, user, d.refresh_token || refresh, d.expires_in);
          }
        } else {
          // Refresh failed — token is truly expired, log out silently
          _clear();
          _updateNav();
        }
      } catch (_) { /* network error — keep existing token */ }
      finally { _refreshPromise = null; }
    })();
    return _refreshPromise;
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
    _save(data.access_token, data.user, data.refresh_token, data.expires_in);
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

  return { signup, login, logout, getToken, getUser, isLoggedIn, authHeader, authHeaderAsync, init, API_BASE };
})();
