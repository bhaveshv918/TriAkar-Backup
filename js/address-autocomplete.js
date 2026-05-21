/*!
 * TriAkar Address Autocomplete v1.0
 * Powered by OpenStreetMap Nominatim (free, no API key required)
 *
 * Usage:
 *   AddressAC.init({
 *     container: document.getElementById('myForm'),  // or CSS selector string
 *     fields: {
 *       line1:    'addrLine1',   // element id OR name attribute
 *       line2:    'addrLine2',
 *       city:     'addrCity',
 *       district: 'addrDistrict',  // optional
 *       state:    'addrState',
 *       pincode:  'addrPincode',
 *     }
 *   });
 */
(function (global) {
  'use strict';

  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

  /* ── Indian states for normalisation ─────────────────────── */
  const STATE_MAP = {
    'andhra pradesh':'Andhra Pradesh','arunachal pradesh':'Arunachal Pradesh',
    'assam':'Assam','bihar':'Bihar','chhattisgarh':'Chhattisgarh','goa':'Goa',
    'gujarat':'Gujarat','haryana':'Haryana','himachal pradesh':'Himachal Pradesh',
    'jharkhand':'Jharkhand','karnataka':'Karnataka','kerala':'Kerala',
    'madhya pradesh':'Madhya Pradesh','maharashtra':'Maharashtra','manipur':'Manipur',
    'meghalaya':'Meghalaya','mizoram':'Mizoram','nagaland':'Nagaland','odisha':'Odisha',
    'punjab':'Punjab','rajasthan':'Rajasthan','sikkim':'Sikkim','tamil nadu':'Tamil Nadu',
    'telangana':'Telangana','tripura':'Tripura','uttar pradesh':'Uttar Pradesh',
    'uttarakhand':'Uttarakhand','west bengal':'West Bengal',
    'andaman & nicobar':'Andaman & Nicobar','andaman and nicobar islands':'Andaman & Nicobar',
    'chandigarh':'Chandigarh','dadra & nagar haveli':'Dadra & Nagar Haveli',
    'daman & diu':'Daman & Diu','delhi':'Delhi',
    'national capital territory of delhi':'Delhi',
    'jammu & kashmir':'Jammu & Kashmir','jammu and kashmir':'Jammu & Kashmir',
    'ladakh':'Ladakh','lakshadweep':'Lakshadweep','puducherry':'Puducherry',
    'pondicherry':'Puducherry',
  };

  function normaliseState(raw) {
    if (!raw) return '';
    return STATE_MAP[raw.toLowerCase()] || raw;
  }

  /* ── CSS ──────────────────────────────────────────────────── */
  const CSS = `
.tac-wrap{margin-bottom:20px;position:relative}
.tac-label{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--stone,#888);margin-bottom:7px}
.tac-input-row{position:relative}
.tac-input{width:100%;padding:11px 40px 11px 38px;border:1.5px solid var(--accent,#C4622A);border-radius:6px;font-size:13.5px;font-family:inherit;background:var(--ivory,#fafaf8);color:var(--charcoal,#1a1a18);box-sizing:border-box;outline:none;transition:box-shadow .15s,border-color .15s}
.tac-input::placeholder{color:var(--stone,#aaa);font-size:13px}
.tac-input:focus{box-shadow:0 0 0 3px rgba(196,98,42,.13)}
.tac-icon-search{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--accent,#C4622A);pointer-events:none}
.tac-spin{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;border:2px solid rgba(196,98,42,.25);border-top-color:var(--accent,#C4622A);border-radius:50%;animation:tac-spin .7s linear infinite;display:none}
@keyframes tac-spin{to{transform:translateY(-50%) rotate(360deg)}}
.tac-dropdown{position:absolute;z-index:9999;background:#fff;border:1.5px solid var(--stone-p,#e8e4dc);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.15);max-height:300px;overflow-y:auto;width:100%;left:0;top:calc(100% + 5px);display:none}
.tac-opt{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--stone-p,#f4f2ee);transition:background .1s}
.tac-opt:last-child{border-bottom:none}
.tac-opt:hover,.tac-opt:focus{background:rgba(196,98,42,.07);outline:none}
.tac-opt-pin{flex-shrink:0;margin-top:2px;color:var(--accent,#C4622A)}
.tac-opt-main{font-size:13px;font-weight:600;color:var(--charcoal,#1a1a18);line-height:1.4}
.tac-opt-sub{font-size:11px;color:var(--stone,#888);margin-top:2px;line-height:1.3}
.tac-empty{padding:14px 16px;font-size:13px;color:var(--stone,#888);text-align:center;line-height:1.6}
.tac-hint{font-size:11px;color:var(--stone,#bbb);margin-top:5px;line-height:1.5}
.tac-badge{display:none;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:4px 9px;margin-top:6px}
.tac-badge.show{display:inline-flex}
.tac-divider{height:1px;background:var(--stone-p,#e8e4dc);margin:0 0 18px;position:relative}
.tac-divider::after{content:"OR FILL MANUALLY BELOW";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--ivory,#fafaf8);padding:0 10px;font-size:9px;letter-spacing:.12em;color:var(--stone,#ccc);white-space:nowrap}
  `;

  let _cssInj = false;
  function injectCSS() {
    if (_cssInj) return;
    _cssInj = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── Public API ───────────────────────────────────────────── */
  function init(cfg) {
    injectCSS();

    const container = typeof cfg.container === 'string'
      ? (document.querySelector(cfg.container) || document.getElementById(cfg.container))
      : cfg.container;
    if (!container) return;

    const uid = 'tac_' + Math.random().toString(36).slice(2, 7);
    const fields = cfg.fields || {};

    /* Build widget HTML */
    const wrap = document.createElement('div');
    wrap.className = 'tac-wrap';
    wrap.innerHTML = `
      <div class="tac-label">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="6" cy="6" r="4.5"/><path d="M10 10l3 3" stroke-linecap="round"/>
        </svg>
        Search Address on Map
      </div>
      <div class="tac-input-row">
        <svg class="tac-icon-search" width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M6 1C3.2 1 1 3.2 1 6c0 3.3 5 7.5 5 7.5S11 9.3 11 6c0-2.8-2.2-5-5-5z"/><circle cx="6" cy="6" r="1.8"/>
        </svg>
        <input type="text" id="${uid}_inp" class="tac-input"
          placeholder="e.g. Greenarch Greater Noida, Sector 62 Noida…"
          autocomplete="off" autocorrect="off" spellcheck="false"
          aria-label="Search address" aria-haspopup="listbox">
        <div class="tac-spin" id="${uid}_spin"></div>
        <div class="tac-dropdown" id="${uid}_drop" role="listbox"></div>
      </div>
      <div class="tac-badge" id="${uid}_badge">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#15803d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Address filled — review the fields below
      </div>
      <div class="tac-hint">Type 3+ characters to see real address suggestions from the map</div>
    `;

    /* Insert at start of container, then add divider */
    container.insertBefore(wrap, container.firstChild);

    const divider = document.createElement('div');
    divider.className = 'tac-divider';
    wrap.insertAdjacentElement('afterend', divider);

    const inp  = document.getElementById(uid + '_inp');
    const drop = document.getElementById(uid + '_drop');
    const spin = document.getElementById(uid + '_spin');
    const badge = document.getElementById(uid + '_badge');

    let timer = null;
    let lastQ = '';

    inp.addEventListener('input', function () {
      const q = this.value.trim();
      clearTimeout(timer);
      drop.style.display = 'none';
      badge.classList.remove('show');
      if (q.length < 3) { spin.style.display = 'none'; return; }
      if (q === lastQ) return;
      spin.style.display = 'block';
      timer = setTimeout(() => { lastQ = q; fetchSugs(q, fields, inp, drop, spin, badge); }, 500);
    });

    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { drop.style.display = 'none'; }
      if (e.key === 'ArrowDown') {
        const opts = drop.querySelectorAll('.tac-opt');
        if (opts.length) { e.preventDefault(); opts[0].focus(); }
      }
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) drop.style.display = 'none';
    });
  }

  /* ── Fetch from Nominatim ─────────────────────────────────── */
  async function fetchSugs(query, fields, inp, drop, spin, badge) {
    try {
      const url = NOMINATIM
        + '?q=' + encodeURIComponent(query)
        + '&format=json&countrycodes=in&limit=8&addressdetails=1&accept-language=en';

      const res = await fetch(url);
      spin.style.display = 'none';
      if (!res.ok) { showEmpty(drop, 'Could not reach map service. Fill manually below.'); return; }

      const results = await res.json();
      if (!results || !results.length) {
        showEmpty(drop, 'No results for "' + query + '". Try: Society name, Sector, or PIN code.');
        return;
      }
      renderSugs(results, fields, inp, drop, badge);
    } catch (_) {
      spin.style.display = 'none';
      /* silently allow manual fill */
    }
  }

  /* ── Render dropdown options ──────────────────────────────── */
  function renderSugs(results, fields, inp, drop, badge) {
    drop.innerHTML = results.map((r, i) => {
      const main = getMainLine(r);
      const sub  = getSubLine(r);
      return `<div class="tac-opt" tabindex="0" data-idx="${i}" role="option">
        <svg class="tac-opt-pin" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z"/><circle cx="7" cy="5" r="1.5"/>
        </svg>
        <div class="tac-opt-body">
          <div class="tac-opt-main">${esc(main)}</div>
          ${sub ? '<div class="tac-opt-sub">' + esc(sub) + '</div>' : ''}
        </div>
      </div>`;
    }).join('');
    drop.style.display = 'block';

    drop.querySelectorAll('.tac-opt').forEach((opt, i) => {
      opt.addEventListener('click', () => selectResult(results[i], fields, inp, drop, badge));
      opt.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); selectResult(results[i], fields, inp, drop, badge); }
        if (e.key === 'ArrowDown' && opt.nextElementSibling) { e.preventDefault(); opt.nextElementSibling.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (opt.previousElementSibling || inp).focus(); }
        if (e.key === 'Escape') { drop.style.display = 'none'; inp.focus(); }
      });
    });
  }

  /* ── Extract human-readable lines from Nominatim result ───── */
  function getMainLine(r) {
    const a = r.address || {};
    const parts = [
      a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure,
      a.house_number,
      a.road || a.pedestrian || a.footway || a.path,
      a.neighbourhood || a.suburb || a.quarter,
    ].filter(Boolean);
    if (parts.length) return parts.join(', ');
    return r.display_name.split(', ').slice(0, 2).join(', ');
  }

  function getSubLine(r) {
    const a = r.address || {};
    const city    = a.city || a.town || a.village || a.municipality || '';
    const state   = normaliseState(a.state);
    const pincode = (a.postcode || '').replace(/\s/g,'').slice(0,6);
    return [city, state, pincode].filter(Boolean).join(', ');
  }

  /* ── Fill form on selection ───────────────────────────────── */
  function selectResult(result, fields, inp, drop, badge) {
    const a = result.address || {};

    /* Line 1 */
    const l1parts = [
      a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure,
      a.house_number,
      a.road || a.pedestrian || a.footway || a.path,
      a.neighbourhood || a.suburb || a.quarter,
    ].filter(Boolean);
    const line1 = l1parts.join(', ') || result.display_name.split(', ')[0] || '';

    /* Line 2 — area/district not already in line1 */
    const areaCandidate = a.city_district || a.county || '';
    const line2 = (areaCandidate && !line1.includes(areaCandidate)) ? areaCandidate : '';

    /* City */
    const city = a.city || a.town || a.village || a.municipality || a.county || '';

    /* District */
    const district = a.county || a.city_district || '';

    /* State — normalise to canonical name */
    const state = normaliseState(a.state || '');

    /* Pincode — must be 6 Indian digits */
    const rawPin = (a.postcode || '').replace(/\s/g,'');
    const pincode = /^\d{6}$/.test(rawPin) ? rawPin : '';

    /* ── Fill each mapped field ──────────────────────────────── */
    function fill(key, val) {
      if (!key || !val) return;
      const el = document.getElementById(key) || document.querySelector('[name="' + key + '"]');
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      /* If state field is inside a .sd-wrap searchable dropdown, sync it */
      const sdWrap = el.closest('.sd-wrap');
      if (sdWrap) {
        el.dataset.value = val;
        sdWrap.querySelectorAll('.sd-option').forEach(o => {
          o.classList.toggle('selected',
            o.dataset.value === val || o.textContent.trim() === val);
        });
      }
    }

    if (fields.line1)    fill(fields.line1,    line1);
    if (fields.line2)    fill(fields.line2,    line2);
    if (fields.city)     fill(fields.city,     city);
    if (fields.district) fill(fields.district, district);
    if (fields.state)    fill(fields.state,    state);
    if (fields.pincode)  fill(fields.pincode,  pincode);

    /* Update search box text */
    inp.value = getMainLine(result) + (getSubLine(result) ? ', ' + getSubLine(result) : '');
    drop.style.display = 'none';
    badge.classList.add('show');

    /* Trigger pincode lookup for city/state double-check */
    if (fields.pincode && pincode) {
      const pinEl = document.getElementById(fields.pincode)
                 || document.querySelector('[name="' + fields.pincode + '"]');
      if (pinEl) {
        /* Emit a synthetic input so existing pincode→city/state listener fires */
        pinEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  function showEmpty(drop, msg) {
    drop.innerHTML = '<div class="tac-empty">' + esc(msg) + '</div>';
    drop.style.display = 'block';
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Export ─────────────────────────────────────────────── */
  global.AddressAC = { init: init };

})(window);
