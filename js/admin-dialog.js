/* ══════════════ IN-APP DIALOGS (admin panels) ══════════════
   The browser's own confirm/prompt/alert paint browser chrome
   ("www.triakar.com says…"), which reads as the site breaking rather than the
   app asking, and looks nothing like the rest of the panel. Nothing in the
   admin panels may call them. Use these instead, same three shapes, rendered
   in the app:

     if(!await bizConfirm('Delete this?')) return;
     const name = await bizPrompt('Material name:');          // null = cancelled
     await bizAlert('Could not generate the PDF.');
     const v = await bizForm({title:'Add color', fields:[…]}); // null = cancelled

   All four are async, so the calling function has to be async too. Clicking the
   backdrop cancels, and focus returns to wherever it came from.

   Keyboard, shown on the buttons themselves so it is discoverable rather than
   folklore:
     Enter        confirm (Ctrl/Cmd+Enter too, the only way out of a textarea)
     Esc          cancel
     Y / N        confirm / cancel, on button-only dialogs (never when the
                  dialog has a text field, "y" has to stay a letter there)
     Tab          cycles inside the dialog only, it cannot reach the page behind

   Loaded by admin.html and admin-biz.html, styling lives in admin-theme.css
   (which both already load). Deliberately side-effect free: it defines four
   globals and nothing else, no listeners, no timers, no DOM on load.

   The customer-facing site has its own, older, confirm-only equivalent
   (window.taConfirm in shared.js), kept separate because the admin panels do
   not load shared.js. */
(function () {
  function esc(s) {
    return (s == null) ? '' : String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var openClose = null;   // resolver of the dialog currently on screen

  function dialog(opts) {
    return new Promise(function (resolve) {
      // A second dialog opening over a live one would strand the first promise
      // unresolved forever, so the older one always resolves (cancelled) first.
      if (openClose) openClose(null);

      var prevFocus = document.activeElement;
      var fields = opts.fields || [];
      var lines = String(opts.message == null ? '' : opts.message).split('\n').filter(function (l) { return l !== ''; });
      // Y/N only make sense where every keystroke is a command. With a text field on
      // screen they would eat letters out of what the operator is typing.
      var letterKeys = !fields.length;
      var hasTextarea = fields.some(function (f) { return f.type === 'textarea'; });

      var ov = document.createElement('div');
      ov.className = 'biz-dlg-ov';
      ov.innerHTML = '<div class="biz-dlg" role="dialog" aria-modal="true">'
        + '<div class="biz-dlg-title">' + esc(opts.title || 'Confirm') + '</div>'
        + (lines.length ? '<div class="biz-dlg-body">' + lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>' : '')
        + (fields.length ? '<div class="biz-dlg-fields">' + fields.map(function (f, i) {
              return '<label class="biz-dlg-field"><span>' + esc(f.label || '') + '</span>'
                + (f.type === 'textarea'
                  ? '<textarea rows="3" data-i="' + i + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value == null ? '' : f.value) + '</textarea>'
                  : '<input type="' + esc(f.type || 'text') + '" data-i="' + i + '" value="' + esc(f.value == null ? '' : f.value) + '" placeholder="' + esc(f.placeholder || '') + '">')
                + '</label>';
            }).join('') + '</div>' : '')
        + '<div class="biz-dlg-actions">'
          // An alert has nothing to cancel, so it gets one button, not a fake choice.
          + (opts.cancelLabel === null ? '' : '<button type="button" class="biz-dlg-btn" data-act="cancel" title="' + (letterKeys ? 'Esc or N' : 'Esc') + '">' + esc(opts.cancelLabel || 'Cancel') + '<kbd class="biz-dlg-kbd">Esc</kbd></button>')
          + '<button type="button" class="biz-dlg-btn ' + (opts.danger ? 'biz-dlg-btn-danger' : 'biz-dlg-btn-primary') + '" data-act="ok" title="' + (letterKeys ? 'Enter or Y' : 'Enter') + '">' + esc(opts.confirmLabel || 'OK') + '<kbd class="biz-dlg-kbd">' + (hasTextarea ? 'Ctrl ↵' : '↵') + '</kbd></button>'
        + '</div></div>';

      document.body.appendChild(ov);
      document.body.classList.add('biz-dlg-open');
      var inputs = [].slice.call(ov.querySelectorAll('[data-i]'));

      function done(val) {
        if (openClose !== done) return;
        openClose = null;
        document.removeEventListener('keydown', onKey, true);
        ov.classList.remove('show');
        document.body.classList.remove('biz-dlg-open');
        setTimeout(function () { ov.remove(); }, 160);
        if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
        resolve(val);
      }
      openClose = done;

      function submit() {
        if (!fields.length) return done(true);
        var out = {}, missing = null;
        fields.forEach(function (f, i) {
          var v = inputs[i] ? inputs[i].value : '';
          out[f.id != null ? f.id : i] = v;
          if (f.required && !String(v).trim() && !missing) missing = inputs[i];
        });
        if (missing) { missing.classList.add('biz-dlg-invalid'); missing.focus(); return; }
        done(out);
      }

      ov.querySelector('[data-act="ok"]').onclick = submit;
      var cancelBtn = ov.querySelector('[data-act="cancel"]');
      if (cancelBtn) cancelBtn.onclick = function () { done(null); };
      ov.onclick = function (e) { if (e.target === ov) done(null); };

      function eat(e) { e.preventDefault(); e.stopPropagation(); }

      function onKey(e) {
        if (e.key === 'Escape') { eat(e); return done(null); }

        if (e.key === 'Enter') {
          // Ctrl/Cmd+Enter works everywhere, including a textarea, where a bare Enter has
          // to stay a newline. Without it a textarea dialog had no keyboard way out at all.
          if (e.ctrlKey || e.metaKey) { eat(e); return submit(); }
          if (e.target.tagName !== 'TEXTAREA') { eat(e); return submit(); }
          return;
        }

        // Keep focus inside the dialog. It is modal, so tabbing onto the page behind it
        // leaves the operator typing into a form they cannot see.
        if (e.key === 'Tab') {
          var focusable = [].slice.call(ov.querySelectorAll('input,textarea,button'));
          if (!focusable.length) return;
          var first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && (document.activeElement === first || !ov.contains(document.activeElement))) { eat(e); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { eat(e); first.focus(); }
          return;
        }

        if (!letterKeys || e.ctrlKey || e.metaKey || e.altKey) return;
        var k = (e.key || '').toLowerCase();
        if (k === 'y') { eat(e); submit(); }
        else if (k === 'n' && cancelBtn) { eat(e); done(null); }
      }
      document.addEventListener('keydown', onKey, true);

      requestAnimationFrame(function () {
        ov.classList.add('show');
        var first = inputs[0] || ov.querySelector('[data-act="ok"]');
        if (first) { first.focus(); if (first.select) { try { first.select(); } catch (e) {} } }
      });
    });
  }

  window.bizConfirm = async function (message, opts) {
    opts = opts || {};
    return await dialog({
      title: opts.title || 'Confirm', message: message,
      confirmLabel: opts.confirmLabel || 'Yes', cancelLabel: opts.cancelLabel || 'Cancel',
      danger: opts.danger,
    }) === true;
  };

  window.bizPrompt = async function (message, defaultValue, opts) {
    opts = opts || {};
    var r = await dialog({
      title: opts.title || 'Enter a value',
      message: opts.message || '',
      fields: [{ id: 'v', label: message || '', value: defaultValue == null ? '' : defaultValue,
                 placeholder: opts.placeholder || '', type: opts.type || 'text', required: opts.required }],
      confirmLabel: opts.confirmLabel || 'Save',
    });
    return r ? r.v : null;
  };

  window.bizAlert = async function (message, opts) {
    opts = opts || {};
    await dialog({ title: opts.title || 'Heads up', message: message,
                   confirmLabel: opts.confirmLabel || 'Got it', cancelLabel: null });
  };

  // Several inputs at once, so a flow like "add a material" asks once instead of
  // firing six dialogs back to back. Resolves to {fieldId:value} or null.
  window.bizForm = async function (opts) {
    var o = { confirmLabel: 'Save' };
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    return await dialog(o);
  };
})();
