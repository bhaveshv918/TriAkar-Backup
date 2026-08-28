/* ══════════════ ADMIN TWO-FACTOR, TOTP ══════════════
   Google Authenticator / Authy style 6-digit codes on top of the existing password
   login, for admin.html and admin-biz.html. Loaded by both.

   Why this shape:

   Supabase Auth already tracks an "assurance level" per session. A password-only
   session is aal1. Once a TOTP code is verified the same session is reissued as aal2,
   and that level travels inside the access token as the `aal` claim. So the Express
   backend can check it with no new table, no session store and no extra round trip
   (server/middleware/requireAdmin.js). Nothing here invents its own auth.

   Enforcement is deliberately conditional. Until a factor is actually enrolled AND
   verified, every check below is a no-op: gate() lets you straight through and the
   server keeps accepting aal1. That means turning 2FA on can never strand the owner
   half way through enrolment, and it means the customer-facing site is untouched
   either way, because Supabase does not force MFA on any other sign-in route.

   What this does NOT cover, on purpose: the admin panels also read and write Supabase
   directly with the anon key, and those RLS policies still only check auth.email().
   So this hardens the Express API, not the RLS path. Adding `AND (auth.jwt()->>'aal')
   = 'aal2'` to the admin policies is a separate migration sweep across every policy.

   Three entry points, all async:

     await AdminMFA.gate(sb)                  // after login and on session restore
     AdminMFA.mountSettings(sb, el)           // the enrol / turn off card
     await AdminMFA.isEnrolled(sb)            // true when a verified factor exists

   gate() resolves true when the session is already aal2 or when nothing is enrolled,
   and false only when the person closes the prompt without verifying, in which case
   the caller should sign them out. */
(function () {
  var FRIENDLY_NAME = 'TriAkar Admin';

  function esc(s) {
    return (s == null) ? '' : String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Styling is injected rather than kept in admin-theme.css because the verification
     prompt has to render on the login screen too, before the panel's own shell exists.
     Colours read the panel's variables where they are available and fall back to the
     brand palette, so the same markup looks right in both admin pages and in both
     light and dark themes. */
  var cssInjected = false;
  function injectCss() {
    if (cssInjected) return;
    cssInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.tamfa-back{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      'background:rgba(10,10,12,.55);backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);padding:20px}',
      '.tamfa-card{width:100%;max-width:380px;background:var(--bg-1,#fff);border:1px solid var(--border,rgba(0,0,0,.1));',
      'border-radius:var(--radius,14px);padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.28);color:var(--text,#141414)}',
      '.tamfa-h{font-weight:700;font-size:15px;margin-bottom:6px}',
      '.tamfa-p{font-size:12px;line-height:1.55;color:var(--text-3,#6b6b6b);margin-bottom:14px}',
      '.tamfa-code{width:100%;padding:12px 14px;font-size:22px;letter-spacing:.34em;text-align:center;font-variant-numeric:tabular-nums;',
      'background:var(--bg-2,#f6f6f7);border:1px solid var(--border,rgba(0,0,0,.12));border-radius:10px;color:var(--text,#141414);outline:none}',
      '.tamfa-code:focus{border-color:#C4622A;box-shadow:0 0 0 3px rgba(196,98,42,.16)}',
      '.tamfa-err{font-size:12px;color:var(--red,#c0392b);margin-top:10px;min-height:16px}',
      '.tamfa-row{display:flex;gap:8px;margin-top:14px}',
      '.tamfa-btn{flex:1;padding:11px 14px;border-radius:999px;border:1px solid transparent;font-size:13px;font-weight:600;cursor:pointer}',
      '.tamfa-btn-primary{background:#C4622A;color:#fff}',
      '.tamfa-btn-primary:disabled{opacity:.55;cursor:default}',
      '.tamfa-btn-ghost{background:transparent;color:var(--text-3,#6b6b6b);border-color:var(--border,rgba(0,0,0,.14))}',
      '.tamfa-qr{display:block;width:190px;height:190px;margin:0 auto 12px;background:#fff;border-radius:10px;padding:8px}',
      '.tamfa-secret{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;text-align:center;',
      'background:var(--bg-2,#f6f6f7);border:1px solid var(--border,rgba(0,0,0,.12));border-radius:8px;padding:9px;margin-bottom:12px}',
      '.tamfa-pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;',
      'padding:3px 9px;border-radius:999px;vertical-align:middle;margin-left:8px}',
      '.tamfa-pill-on{background:rgba(39,174,96,.14);color:var(--green,#219653)}',
      '.tamfa-pill-off{background:rgba(196,98,42,.14);color:#C4622A}',
      '.tamfa-warn{font-size:11px;line-height:1.5;color:var(--text-3,#6b6b6b);background:rgba(196,98,42,.08);',
      'border:1px solid rgba(196,98,42,.22);border-radius:8px;padding:9px 11px;margin-bottom:12px}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Supabase MFA wrappers, all failure-tolerant ──────────
     Every one of these returns null rather than throwing. A Supabase hiccup must not
     be able to take the whole admin panel down, and the email allowlist plus the
     password are still standing underneath. */

  async function listFactors(sb) {
    try {
      var r = await sb.auth.mfa.listFactors();
      if (r.error) return null;
      return r.data || { all: [], totp: [] };
    } catch (_) { return null; }
  }

  async function assurance(sb) {
    try {
      var r = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (r.error) return null;
      return r.data || null;
    } catch (_) { return null; }
  }

  function verifiedTotp(data) {
    if (!data) return null;
    var list = (data.totp && data.totp.length) ? data.totp
      : (data.all || []).filter(function (f) { return f.factor_type === 'totp' && f.status === 'verified'; });
    return list.length ? list[0] : null;
  }

  async function isEnrolled(sb) {
    return !!verifiedTotp(await listFactors(sb));
  }

  /* ── The verification prompt ──────────────────────────────
     Resolves true once the session reaches aal2, false if it is closed unverified. */
  function promptForCode(sb, factorId) {
    injectCss();
    return new Promise(function (resolve) {
      var back = document.createElement('div');
      back.className = 'tamfa-back';
      back.innerHTML =
        '<div class="tamfa-card" role="dialog" aria-modal="true" aria-labelledby="tamfaTitle">' +
          '<div class="tamfa-h" id="tamfaTitle">Two-factor verification</div>' +
          '<div class="tamfa-p">Open your authenticator app and enter the current 6-digit code for ' + esc(FRIENDLY_NAME) + '.</div>' +
          '<input class="tamfa-code" id="tamfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="6-digit code">' +
          '<div class="tamfa-err" id="tamfaErr"></div>' +
          '<div class="tamfa-row">' +
            '<button type="button" class="tamfa-btn tamfa-btn-ghost" id="tamfaCancel">Cancel</button>' +
            '<button type="button" class="tamfa-btn tamfa-btn-primary" id="tamfaGo">Verify</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(back);

      var input = back.querySelector('#tamfaCode');
      var errEl = back.querySelector('#tamfaErr');
      var goBtn = back.querySelector('#tamfaGo');
      var busy = false;

      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        back.remove();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape' && !busy) { e.preventDefault(); close(false); }
        else if (e.key === 'Enter' && !busy) { e.preventDefault(); submit(); }
      }

      async function submit() {
        var code = (input.value || '').replace(/\D/g, '');
        if (code.length !== 6) { errEl.textContent = 'Enter all 6 digits.'; return; }
        busy = true; goBtn.disabled = true; goBtn.textContent = 'Verifying...'; errEl.textContent = '';
        try {
          var r = await sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: code });
          if (r.error) throw r.error;
          close(true);
        } catch (err) {
          // Codes rotate every 30s and Supabase rate limits challenges, so a wrong
          // code has to leave the prompt open and retryable rather than bailing out.
          errEl.textContent = (err && err.message) ? err.message : 'That code was not accepted.';
          input.value = ''; input.focus();
          busy = false; goBtn.disabled = false; goBtn.textContent = 'Verify';
        }
      }

      // Typing the sixth digit is the natural "done", so submit on it rather than
      // making someone reach for the button with a code that expires in seconds.
      input.addEventListener('input', function () {
        var v = (input.value || '').replace(/\D/g, '').slice(0, 6);
        if (input.value !== v) input.value = v;
        if (v.length === 6 && !busy) submit();
      });
      back.querySelector('#tamfaCancel').addEventListener('click', function () { if (!busy) close(false); });
      goBtn.addEventListener('click', function () { if (!busy) submit(); });
      document.addEventListener('keydown', onKey, true);
      setTimeout(function () { input.focus(); }, 40);
    });
  }

  /* ── gate ─────────────────────────────────────────────────
     Call after a successful password login and again on session restore, because a
     restored session can be an aal1 one from a tab that never completed the step. */
  async function gate(sb) {
    var a = await assurance(sb);
    if (!a) return true;                       // MFA unavailable, never lock anyone out
    if (a.currentLevel === 'aal2') return true;
    if (a.nextLevel !== 'aal2') return true;   // nothing enrolled on this account
    var factor = verifiedTotp(await listFactors(sb));
    if (!factor) return true;
    return await promptForCode(sb, factor.id);
  }

  /* ── The Settings card ────────────────────────────────────
     Turn on: enrol, scan, verify. Turn off: two-step, no browser confirm(). */
  async function mountSettings(sb, el) {
    if (!el) return;
    injectCss();
    el.innerHTML = '<div style="font-size:12px;color:var(--text-3,#6b6b6b)">Checking two-factor status...</div>';

    var data = await listFactors(sb);
    if (!data) {
      el.innerHTML = '<div style="font-size:12px;color:var(--red,#c0392b)">Could not read two-factor status. Reload the page.</div>';
      return;
    }
    var factor = verifiedTotp(data);
    if (factor) renderOn(factor); else renderOff();

    function head(pillClass, pillText) {
      return '<div style="font-weight:700;font-size:13px;margin-bottom:8px">Two-factor authentication' +
        '<span class="tamfa-pill ' + pillClass + '">' + pillText + '</span></div>';
    }

    function renderOff() {
      el.innerHTML = head('tamfa-pill-off', 'Off') +
        '<div class="tamfa-p" style="margin-bottom:12px">Right now this panel is protected by your password alone. Turn this on and every admin sign-in will also ask for a 6-digit code from your phone.</div>' +
        '<button type="button" class="tamfa-btn tamfa-btn-primary" id="tamfaOn" style="flex:none;padding:9px 18px">Turn on 2FA</button>' +
        '<div class="tamfa-err" id="tamfaSetupErr"></div>';
      el.querySelector('#tamfaOn').addEventListener('click', startEnrol);
    }

    async function startEnrol() {
      var errEl = el.querySelector('#tamfaSetupErr');
      var btn = el.querySelector('#tamfaOn');
      btn.disabled = true; btn.textContent = 'Preparing...'; errEl.textContent = '';
      try {
        // An abandoned attempt leaves an unverified factor behind, and Supabase then
        // rejects a fresh enrol under the same friendly name. Clear those first so
        // "Turn on" always works on the second and third try.
        var stale = (data.all || []).filter(function (f) { return f.status === 'unverified'; });
        for (var i = 0; i < stale.length; i++) {
          try { await sb.auth.mfa.unenroll({ factorId: stale[i].id }); } catch (_) {}
        }
        var r = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: FRIENDLY_NAME });
        if (r.error) throw r.error;
        renderScan(r.data.id, r.data.totp || {});
      } catch (err) {
        errEl.textContent = (err && err.message) ? err.message : 'Could not start enrolment.';
        btn.disabled = false; btn.textContent = 'Turn on 2FA';
      }
    }

    function renderScan(factorId, totp) {
      el.innerHTML = head('tamfa-pill-off', 'Setup') +
        '<div class="tamfa-p">Scan this with Google Authenticator, then enter the 6-digit code it shows to finish.</div>' +
        (totp.qr_code ? '<img class="tamfa-qr" alt="Two-factor QR code" src="' + esc(totp.qr_code) + '">' : '') +
        '<div class="tamfa-p" style="margin-bottom:6px">Or type this key in manually:</div>' +
        '<div class="tamfa-secret">' + esc(totp.secret || '') + '</div>' +
        '<div class="tamfa-warn"><b>Save that key somewhere offline before you continue.</b> Supabase does not issue backup codes, so if you lose the phone and have not kept the key, the only way back in is the service role from the Supabase dashboard.</div>' +
        '<input class="tamfa-code" id="tamfaSetupCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="6-digit code">' +
        '<div class="tamfa-err" id="tamfaSetupErr"></div>' +
        '<div class="tamfa-row">' +
          '<button type="button" class="tamfa-btn tamfa-btn-ghost" id="tamfaAbort">Cancel</button>' +
          '<button type="button" class="tamfa-btn tamfa-btn-primary" id="tamfaFinish">Verify and turn on</button>' +
        '</div>';

      var input = el.querySelector('#tamfaSetupCode');
      var errEl = el.querySelector('#tamfaSetupErr');
      var finish = el.querySelector('#tamfaFinish');

      input.addEventListener('input', function () {
        var v = (input.value || '').replace(/\D/g, '').slice(0, 6);
        if (input.value !== v) input.value = v;
      });
      el.querySelector('#tamfaAbort').addEventListener('click', async function () {
        try { await sb.auth.mfa.unenroll({ factorId: factorId }); } catch (_) {}
        data = (await listFactors(sb)) || { all: [], totp: [] };
        renderOff();
      });
      finish.addEventListener('click', async function () {
        var code = (input.value || '').replace(/\D/g, '');
        if (code.length !== 6) { errEl.textContent = 'Enter all 6 digits.'; return; }
        finish.disabled = true; finish.textContent = 'Verifying...'; errEl.textContent = '';
        try {
          var r = await sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: code });
          if (r.error) throw r.error;
          data = (await listFactors(sb)) || { all: [], totp: [] };
          var f = verifiedTotp(data);
          if (f) renderOn(f, true); else renderOff();
        } catch (err) {
          errEl.textContent = (err && err.message) ? err.message : 'That code was not accepted.';
          input.value = ''; input.focus();
          finish.disabled = false; finish.textContent = 'Verify and turn on';
        }
      });
      setTimeout(function () { input.focus(); }, 40);
    }

    function renderOn(f, justEnabled) {
      el.innerHTML = head('tamfa-pill-on', 'On') +
        (justEnabled ? '<div style="font-size:12px;color:var(--green,#219653);margin-bottom:10px">Two-factor is on. Your next admin sign-in will ask for a code.</div>' : '') +
        '<div class="tamfa-p" style="margin-bottom:12px">Every admin sign-in asks for a code from your authenticator app, and the backend now rejects admin requests from any session that has not passed it.</div>' +
        '<button type="button" class="tamfa-btn tamfa-btn-ghost" id="tamfaOff" style="flex:none;padding:9px 18px">Turn off 2FA</button>' +
        '<div class="tamfa-err" id="tamfaOffErr"></div>';

      var offBtn = el.querySelector('#tamfaOff');
      var errEl = el.querySelector('#tamfaOffErr');
      var armed = false;
      offBtn.addEventListener('click', async function () {
        // Two-step rather than a dialog: turning this off drops the account back to
        // password-only, so it should not be one stray click away.
        if (!armed) {
          armed = true;
          offBtn.textContent = 'Click again to confirm';
          errEl.textContent = 'This puts the panel back behind the password alone.';
          setTimeout(function () {
            if (!armed) return;
            armed = false; offBtn.textContent = 'Turn off 2FA'; errEl.textContent = '';
          }, 6000);
          return;
        }
        armed = false;
        offBtn.disabled = true; offBtn.textContent = 'Turning off...';
        try {
          var r = await sb.auth.mfa.unenroll({ factorId: f.id });
          if (r.error) throw r.error;
          data = (await listFactors(sb)) || { all: [], totp: [] };
          renderOff();
        } catch (err) {
          errEl.textContent = (err && err.message) ? err.message : 'Could not turn it off.';
          offBtn.disabled = false; offBtn.textContent = 'Turn off 2FA';
        }
      });
    }
  }

  window.AdminMFA = { gate: gate, mountSettings: mountSettings, isEnrolled: isEnrolled };
})();
