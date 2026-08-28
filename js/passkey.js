/* TriAkar, passkey.js
 *
 * Browser half of passkey sign-in. Deliberately dependency-free: the whole job here is
 * base64url conversion plus two navigator.credentials calls, and pulling a library in for
 * that would add weight to a page that already carries supabase-js. Signature checking,
 * the part that genuinely should not be hand-written, happens on the server.
 *
 * Depends on Auth (js/auth.js) for API_BASE, apiFetch and session storage. Load it after.
 */

const Passkey = (function () {
  /* typeof, not window.Auth: js/auth.js declares `const Auth`, and a top-level const in a
     classic script lands in the global LEXICAL environment, never on window. Checking
     window.Auth therefore always reads undefined, which silently turned every request
     below into a relative URL and sent it to the site's own origin instead of the API. */
  const API = function () {
    if (typeof Auth === 'undefined' || !Auth.API_BASE) {
      throw new Error('Sign-in is not ready yet. Please refresh and try again.');
    }
    return Auth.API_BASE;
  };

  /* ── base64url <-> ArrayBuffer ────────────────────────────
     WebAuthn speaks ArrayBuffers, JSON does not. The server sends and expects base64url
     (not plain base64: '-' and '_' instead of '+' and '/', and no '=' padding). */
  function b64urlToBuf(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function bufToB64url(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* ── capability checks ────────────────────────────────────
     Two different questions. supported() asks whether the browser knows what a passkey is
     at all; platformAvailable() asks whether THIS device can make one with a fingerprint,
     face or PIN. A desktop with no biometrics answers yes to the first and no to the
     second, which is why the "add a passkey" prompt only appears on the second. */
  function supported() {
    return typeof window !== 'undefined'
      && typeof window.PublicKeyCredential !== 'undefined'
      && !!(navigator.credentials && navigator.credentials.create);
  }

  async function platformAvailable() {
    if (!supported()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (_) { return false; }
  }

  async function conditionalAvailable() {
    if (!supported()) return false;
    try {
      if (!PublicKeyCredential.isConditionalMediationAvailable) return false;
      return await PublicKeyCredential.isConditionalMediationAvailable();
    } catch (_) { return false; }
  }

  /* Cancelling the Face ID sheet is the single most common outcome of these calls and it
     is not a failure, so it gets its own flag rather than an error message. */
  function isCancel(err) {
    return !!err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
  }

  async function post(path, body, authed) {
    const url = API() + '/api/auth/passkeys' + path;
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    };
    const res = authed ? await Auth.apiFetch(url, opts) : await fetch(url, opts);
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  /* ── register a passkey on this device ────────────────────
     Requires an existing session: this adds a faster door to an account you are already
     inside, it never creates one. */
  async function register(label) {
    if (!supported()) throw new Error('This browser does not support passkeys.');

    const { challengeId, options } = await post('/register/options', {}, true);

    options.challenge = b64urlToBuf(options.challenge);
    options.user.id   = b64urlToBuf(options.user.id);
    if (options.excludeCredentials) {
      options.excludeCredentials = options.excludeCredentials.map(function (c) {
        return Object.assign({}, c, { id: b64urlToBuf(c.id) });
      });
    }

    const cred = await navigator.credentials.create({ publicKey: options });
    if (!cred) throw new Error('No passkey was created.');

    const r = cred.response;
    const response = {
      id: cred.id,
      rawId: bufToB64url(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment || undefined,
      clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      response: {
        clientDataJSON:    bufToB64url(r.clientDataJSON),
        attestationObject: bufToB64url(r.attestationObject),
        transports:        r.getTransports ? r.getTransports() : undefined,
      },
    };

    const out = await post('/register/verify', { challengeId, response, label }, true);
    return out.passkey;
  }

  /* ── sign in with a passkey ───────────────────────────────
     No email is sent up and none is needed: the credential the customer picks identifies
     them on its own.

     conditional:true is the browser-autofill variant. It does not open a modal; it waits
     quietly and offers the passkey inside the email field's autofill dropdown. It only
     resolves if the customer actually picks one, so it is fire-and-forget. */
  async function login(opts) {
    opts = opts || {};
    if (!supported()) throw new Error('This browser does not support passkeys.');

    const { challengeId, options } = await post('/login/options', {});

    options.challenge = b64urlToBuf(options.challenge);
    if (options.allowCredentials && options.allowCredentials.length) {
      options.allowCredentials = options.allowCredentials.map(function (c) {
        return Object.assign({}, c, { id: b64urlToBuf(c.id) });
      });
    } else {
      delete options.allowCredentials;
    }

    const getOpts = { publicKey: options };
    if (opts.conditional) getOpts.mediation = 'conditional';
    if (opts.signal) getOpts.signal = opts.signal;

    const cred = await navigator.credentials.get(getOpts);
    if (!cred) throw new Error('No passkey was used.');

    const r = cred.response;
    const response = {
      id: cred.id,
      rawId: bufToB64url(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment || undefined,
      clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      response: {
        clientDataJSON:    bufToB64url(r.clientDataJSON),
        authenticatorData: bufToB64url(r.authenticatorData),
        signature:         bufToB64url(r.signature),
        userHandle:        r.userHandle ? bufToB64url(r.userHandle) : undefined,
      },
    };

    const data = await post('/login/verify', { challengeId, response });

    // Same landing point as a password login, so cart/wishlist merge and the nav refresh
    // happen once, in one place, however the customer got here.
    await Auth.setSession(data.access_token, data.user, data.refresh_token, data.expires_in);
    return data;
  }

  /* ── Settings tab ─────────────────────────────────────── */
  async function list() {
    const res = await Auth.apiFetch(API() + '/api/auth/passkeys');
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not load your passkeys.');
    return data.passkeys || [];
  }

  async function remove(id) {
    const res = await Auth.apiFetch(API() + '/api/auth/passkeys/' + encodeURIComponent(id), { method: 'DELETE' });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not remove this passkey.');
    return true;
  }

  async function rename(id, label) {
    const res = await Auth.apiFetch(API() + '/api/auth/passkeys/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not rename this passkey.');
    return data.passkey;
  }

  return { supported, platformAvailable, conditionalAvailable, isCancel, register, login, list, remove, rename };
})();

if (typeof window !== 'undefined') window.Passkey = Passkey;
