/* TriAkar, auth.js */

const Auth = (function () {
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://triakar.onrender.com';

  const TOKEN_KEY   = 'ta_token';
  const USER_KEY    = 'ta_user';
  const REFRESH_KEY = 'ta_refresh';   // FIX #11: store refresh token
  const EXPIRY_KEY  = 'ta_expiry';    // FIX #11: store expiry timestamp
  const ACCOUNTS_KEY = 'ta_accounts'; // remembered profiles for the sign-in picker

  const SUPABASE_URL = 'https://qarjbmogersuaerkhlcu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcmpibW9nZXJzdWFlcmtobGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMzNzMsImV4cCI6MjA5NDU3OTM3M30.iS7VcO9j9UjlmBN0EhhuWBOu6Vvrg8-SQrb3oZ25AIs';

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

  // Synchronous fallback (for callers that can't await), token may be stale
  function authHeader() {
    const t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function _save(token, user, refresh, expiresIn) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    // store expiry as unix ms, default to 55 min if not provided (Supabase default is 60min)
    const expiry = Date.now() + ((expiresIn || 3300) * 1000);
    localStorage.setItem(EXPIRY_KEY, String(expiry));
  }

  function _clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    // ACCOUNTS_KEY deliberately survives a sign-out. That list is the whole point of the
    // sign-in picker: "welcome back, tap your face" only works if signing out does not
    // wipe the memory of who was here. It holds no credential of any kind (see below), so
    // leaving it behind gives a later visitor nothing but a name they could already read
    // off the browser's own autofill.
  }

  /* ── Remembered accounts, for the sign-in picker ───────────
     A display-only list: name, email, avatar initial, when it was last used, and whether
     that account has a passkey on file. Explicitly NOT stored: access tokens, refresh
     tokens, passwords, anything that could restore a session. Tapping a remembered
     profile still has to prove itself, either with the device's passkey prompt or with
     the password, so a stolen phone gains nothing from this list.

     That is the deliberate difference from the account switchers on some big sites, which
     do keep a live token per profile and hand a shared or stolen device an instant way in. */
  function getKnownAccounts() {
    try {
      const list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list
        .filter(a => a && a.id && a.email)
        .sort((a, b) => (b.last_used || 0) - (a.last_used || 0));
    } catch (_) { return []; }
  }

  function _saveAccounts(list) {
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list.slice(0, 5))); } catch (_) {}
  }

  function rememberAccount(user) {
    // Anonymous sessions (Instant Quote) have no email and are not a person, so they never
    // land in the picker.
    if (!user || !user.id || !user.email) return;
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || user.email.split('@')[0];
    const all  = getKnownAccounts();
    const prev = all.find(a => a.id === user.id);
    const list = all.filter(a => a.id !== user.id);
    list.unshift({
      id: user.id,
      email: user.email,
      name: name,
      avatar: (meta.avatar_url || meta.picture || '') || null,
      // Sticky: a device that has signed in with a passkey once should keep offering it,
      // even after a password sign-in on the same device.
      has_passkey: prev ? !!prev.has_passkey : false,
      last_used: Date.now(),
    });
    _saveAccounts(list);
  }

  function markAccountPasskey(userId, has) {
    const list = getKnownAccounts();
    const hit = list.find(a => a.id === userId);
    if (!hit) return;
    hit.has_passkey = !!has;
    _saveAccounts(list);
  }

  function forgetAccount(userId) {
    _saveAccounts(getKnownAccounts().filter(a => a.id !== userId));
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
        const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.access_token) {
            const user = getUser();
            _save(d.access_token, user, d.refresh_token || refresh, d.expires_in);
          }
        } else {
          // Refresh failed, token is truly expired, log out silently
          _clear();
          _updateNav();
        }
      } catch (_) { /* network error, keep existing token */ }
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
    if (!res.ok) {
      let msg = 'Signup failed';
      try { const e = await res.json(); msg = e.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    return data;
  }

  async function login(email, password) {
    const res = await fetch(API_BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      let msg = 'Login failed';
      try { const e = await res.json(); msg = e.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    _save(data.access_token, data.user, data.refresh_token, data.expires_in);
    rememberAccount(data.user);
    _updateNav();
    // Merge any guest cart with the server cart so nothing added while
    // logged out is lost. Best-effort, never blocks the login result.
    try { if (typeof Cart !== 'undefined' && Cart.mergeOnLogin) await Cart.mergeOnLogin(); } catch (_) {}
    // Merge guest wishlist with the server wishlist on login. Best-effort.
    try { if (typeof Wishlist !== 'undefined' && Wishlist.mergeOnLogin) await Wishlist.mergeOnLogin(); } catch (_) {}
    return data;
  }

  // Bridge an externally-obtained Supabase session (e.g. Google OAuth) into the
  // app's auth storage so the rest of the site, which is token-based, works
  // identically to a password login. The OAuth access_token is a normal Supabase
  // token and passes the server's requireAuth check.
  async function setSession(token, user, refresh, expiresIn) {
    _save(token, user, refresh, expiresIn);
    rememberAccount(user);
    _updateNav();
    try { if (typeof Cart !== 'undefined' && Cart.mergeOnLogin) await Cart.mergeOnLogin(); } catch (_) {}
    try { if (typeof Wishlist !== 'undefined' && Wishlist.mergeOnLogin) await Wishlist.mergeOnLogin(); } catch (_) {}
  }

  // Starts a real (but nameless) Supabase session with no email/password, so
  // a feature like Instant Quote can require *a* session (for RLS/ownership,
  // rate limiting, the server's requireAuth check) without making the visitor
  // create an account first. Requires "Allow anonymous sign-ins" to be turned
  // on in the Supabase dashboard (Authentication -> Settings), it is off by
  // default on new projects, so this throws a clear error if it isn't enabled
  // rather than failing silently.
  async function signInAnonymously() {
    const res = await fetch(SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      let msg = 'Could not start a session';
      try { const e = await res.json(); msg = e.msg || e.error_description || e.message || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('Anonymous sign-in is not enabled for this project');
    _save(data.access_token, data.user, data.refresh_token, data.expires_in);
    _updateNav();
    try { if (typeof Cart !== 'undefined' && Cart.mergeOnLogin) await Cart.mergeOnLogin(); } catch (_) {}
    return data;
  }

  // A session exists (real login or anonymous) or gets created on the spot.
  // Use this instead of isLoggedIn() wherever a feature should work for a
  // first-time visitor without forcing them through a login screen first.
  async function ensureSession() {
    if (isLoggedIn()) return true;
    await signInAnonymously();
    return true;
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

  // BUG 5: true once the session has expired and could not be refreshed.
  function isExpired() {
    const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
    return !!expiry && Date.now() >= expiry;
  }

  // BUG 5: graceful session-expiry. Clears the session and notifies the page
  // so it can show a friendly "please sign in again" state instead of a 401.
  function _expireSession() {
    _clear();
    _updateNav();
    try { window.dispatchEvent(new CustomEvent('ta-auth-expired')); } catch (_) {}
  }

  // BUG 5: centralized authenticated fetch.
  // - refreshes a near-expiry token before the request,
  // - on a 401 it force-refreshes once and retries,
  // - if it still fails, the session is expired gracefully.
  // Returns the Response (callers handle non-OK as usual). Throws on network error.
  async function apiFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {}, await authHeaderAsync());
    let res = await fetch(url, Object.assign({}, options, { headers }));
    if (res.status === 401 && localStorage.getItem(REFRESH_KEY)) {
      const ok = await _forceRefresh();
      if (ok) {
        const retryHeaders = Object.assign({}, options.headers || {}, authHeader());
        res = await fetch(url, Object.assign({}, options, { headers: retryHeaders }));
      }
      if (res.status === 401) _expireSession();
    }
    return res;
  }

  // BUG 5: refresh regardless of the expiry timer (used after a real 401).
  async function _forceRefresh() {
    localStorage.setItem(EXPIRY_KEY, '0'); // force _maybeRefresh to act
    await _maybeRefresh();
    return !!getToken();
  }

  // BUG 5: on page load, proactively refresh a near-expiry token (or clear a
  // dead one) so the nav and gated UI reflect the real session state.
  function init() {
    _updateNav();
    if (getToken()) {
      if (isExpired() && !localStorage.getItem(REFRESH_KEY)) {
        _expireSession();
      } else {
        _maybeRefresh().then(_updateNav).catch(function () {});
      }
    }
  }

  return { signup, login, setSession, logout, getToken, getUser, isLoggedIn, authHeader, authHeaderAsync, apiFetch, isExpired, init, API_BASE, signInAnonymously, ensureSession,
           getKnownAccounts, rememberAccount, markAccountPasskey, forgetAccount };
})();
