(function () {
  'use strict';
  if (document.getElementById('__ma_host__')) return;

  const host = document.createElement('div');
  host.id = '__ma_host__';

  // Center by default; restore saved right/top if present
  const savedPos = (() => { try { return JSON.parse(localStorage.getItem('__ma_pos__')); } catch { return null; } })();
  const initRight = savedPos?.right ?? Math.round(window.innerWidth  / 2 - 23);
  const initTop   = savedPos?.top   ?? Math.round(window.innerHeight / 2 - 23);
  host.style.cssText = `position:fixed;right:${initRight}px;top:${initTop}px;z-index:2147483647;user-select:none;`;
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .wrapper {
    display: flex;
    flex-direction: row;
    align-items: flex-start; /* top is fixed; cards grow downward */
    gap: 10px;
  }

  .cards-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
  }

  .card {
    width: 210px;
    min-height: 72px;
    background: #fff;
    border: 1.5px solid rgba(0,0,0,0.08);
    border-radius: 14px;
    box-shadow: 0 4px 18px rgba(0,0,0,0.1);
    padding: 11px 13px 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    flex-shrink: 0;
    position: relative;
    animation: pop 0.22s ease-out;
  }

  @keyframes pop {
    from { opacity: 0; transform: translateY(-6px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .card.current {
    border-color: rgba(22, 163, 74, 0.4);
    box-shadow: 0 4px 22px rgba(22, 163, 74, 0.13);
  }

  .card.old { opacity: 0.58; }

  .card-dismiss {
    position: absolute; top: 5px; right: 7px;
    background: none; border: none; cursor: pointer;
    color: #ddd; font-size: 10px; padding: 2px 4px;
    opacity: 0; transition: opacity 0.15s, color 0.15s; line-height: 1;
  }
  .card:hover .card-dismiss { opacity: 1; }
  .card-dismiss:hover { color: #888; }

  .card-q {
    font-size: 0.64rem; font-weight: 600; color: #aaa;
    line-height: 1.4; margin-bottom: 7px; padding-right: 14px;
  }
  .card-q:empty { display: none; }

  .card-a { font-size: 0.8rem; color: #1a3a20; line-height: 1.65; }
  .card-a.dim { color: #bbb; font-style: italic; font-size: 0.7rem; }
  .card-a.err { color: #dc2626; font-size: 0.72rem; }

  .vol-bar {
    width: 100%; height: 2px; background: #f0f0f0;
    border-radius: 2px; overflow: hidden; margin-top: 9px; display: none;
  }
  .vol-bar.on { display: block; }
  .vol-fill {
    height: 100%; width: 0%; background: #ef4444;
    border-radius: 2px; transition: width 0.08s linear;
  }

  .toggle-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }

  .toggle {
    width: 46px; height: 46px; border-radius: 50%;
    background: rgba(255,255,255,0.97);
    border: 1.5px solid rgba(0,0,0,0.1);
    display: flex; align-items: center; justify-content: center;
    cursor: grab; flex-shrink: 0;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  }
  .toggle:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.2); }
  .toggle.active {
    border-color: #ef4444; background: #fff5f5;
    animation: rpulse 1.8s ease-in-out infinite;
  }
  .toggle.warn { border-color: #f59e0b; background: #fffbeb; }
  .toggle svg { width: 21px; height: 21px; }

  @keyframes rpulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.25); }
    50%      { box-shadow: 0 0 0 12px rgba(220,38,38,0); }
  }

  .reset-btn {
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(255,255,255,0.9);
    border: 1px solid rgba(0,0,0,0.1);
    cursor: pointer; font-size: 11px; color: #aaa;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s, color 0.15s, background 0.15s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    line-height: 1;
  }
  .toggle-col:hover .reset-btn { opacity: 1; }
  .reset-btn:hover { background: #f0f0f0; color: #555; }
</style>

<div class="wrapper">
  <div class="cards-row" id="cardsRow"></div>
  <div class="toggle-col">
    <div class="toggle" id="toggle" title="Meeting Assistant — click to start/stop (Alt+M)">
      <svg id="toggleSvg" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 18v-6a9 9 0 0118 0v6"/>
        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/>
        <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
      </svg>
    </div>
    <button class="reset-btn" id="resetBtn" title="Reset to center">⌖</button>
  </div>
</div>`;

  const toggleEl  = shadow.getElementById('toggle');
  const toggleSvg = shadow.getElementById('toggleSvg');
  const cardsRow  = shadow.getElementById('cardsRow');
  const resetBtn  = shadow.getElementById('resetBtn');

  // ── Reset to center ───────────────────────────────────────────────────────
  resetBtn.addEventListener('click', e => {
    e.stopPropagation();
    host.style.right = Math.round(window.innerWidth  / 2 - 23) + 'px';
    host.style.top   = Math.round(window.innerHeight / 2 - 23) + 'px';
    localStorage.removeItem('__ma_pos__');
  });

  // ── Drag (right + top) ────────────────────────────────────────────────────
  let dragging = false, dragMoved = false;
  let dragStartX, dragStartY, startRight, startTop;

  toggleEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true; dragMoved = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    startRight = parseInt(host.style.right) || 0;
    startTop   = parseInt(host.style.top)   || 0;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
    if (!dragMoved) return;
    host.style.right = Math.max(0, Math.min(window.innerWidth  - 46, startRight - dx)) + 'px';
    host.style.top   = Math.max(0, Math.min(window.innerHeight - 46, startTop   + dy)) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (dragMoved) localStorage.setItem('__ma_pos__', JSON.stringify({
      right: parseInt(host.style.right), top: parseInt(host.style.top),
    }));
  });

  // ── Safe chrome.runtime wrapper ───────────────────────────────────────────
  function ctxOk() { try { return !!chrome.runtime?.id; } catch { return false; } }
  function safeSend(msg) {
    if (!ctxOk()) { enabled = false; return; }
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  // ── API key ───────────────────────────────────────────────────────────────
  let hasKey = false;
  try {
    chrome.storage.sync.get('ma_api_key', d => { hasKey = !!d.ma_api_key; });
    chrome.storage.onChanged.addListener(c => { if (c.ma_api_key) hasKey = !!c.ma_api_key.newValue; });
  } catch (_) {}

  // ── Card management ───────────────────────────────────────────────────────
  const MAX_CARDS = 5;
  let cardList    = [];
  let currentCard = null;
  let restartTimer = null;

  function makeCard() {
    const c = document.createElement('div');
    c.className = 'card current';
    c.innerHTML = `
      <div class="card-q"></div>
      <div class="card-a dim">Listening…</div>
      <div class="vol-bar"><div class="vol-fill"></div></div>
      <button class="card-dismiss">✕</button>`;
    c.querySelector('.card-dismiss').addEventListener('click', e => {
      e.stopPropagation(); dropCard(c);
    });
    cardsRow.appendChild(c);
    cardList.push(c);
    while (cardList.length > MAX_CARDS) dropCard(cardList[0]);
    currentCard = c;
    return c;
  }

  function dropCard(c) {
    const i = cardList.indexOf(c);
    if (i !== -1) cardList.splice(i, 1);
    c.remove();
    if (currentCard === c) currentCard = null;
  }

  function ageCard() {
    if (!currentCard) return;
    currentCard.classList.remove('current');
    currentCard.classList.add('old');
    currentCard.querySelector('.vol-bar')?.classList.remove('on');
    currentCard = null;
  }

  const cQ  = () => currentCard?.querySelector('.card-q');
  const cA  = () => currentCard?.querySelector('.card-a');
  const cVB = () => currentCard?.querySelector('.vol-bar');
  const cVF = () => currentCard?.querySelector('.vol-fill');

  // ── Enable / disable ──────────────────────────────────────────────────────
  let enabled = false;

  function setEnabled(on) {
    enabled = on;
    clearTimeout(restartTimer);
    if (on) {
      toggleEl.classList.add('active');
      toggleSvg.setAttribute('stroke', '#ef4444');
      makeCard();
      safeSend({ type: 'START_CAPTURE' });
    } else {
      toggleEl.classList.remove('active');
      toggleSvg.setAttribute('stroke', '#555');
      ageCard();
      safeSend({ type: 'STOP_CAPTURE' });
    }
  }

  function scheduleRestart(ms) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!enabled) return;
      makeCard();
      safeSend({ type: 'START_CAPTURE' });
    }, ms);
  }

  toggleEl.addEventListener('click', () => {
    if (dragMoved) return;
    if (!hasKey) {
      toggleEl.classList.add('warn');
      setTimeout(() => toggleEl.classList.remove('warn'), 1500);
      return;
    }
    setEnabled(!enabled);
  });

  document.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'm' || e.key === 'M') && hasKey) {
      e.preventDefault(); setEnabled(!enabled);
    }
  });

  // ── Messages from background ──────────────────────────────────────────────
  try { chrome.runtime.onMessage.addListener(msg => {
    switch (msg.type) {
      case 'MA_STARTED': {
        const a = cA(), vb = cVB();
        if (a) { a.className = 'card-a dim'; a.textContent = 'Listening…'; }
        if (vb) vb.classList.add('on');
        break;
      }
      case 'MA_VOLUME': {
        const vf = cVF();
        if (vf) vf.style.width = Math.min(100, (msg.vol / 35) * 100) + '%';
        break;
      }
      case 'MA_TRANSCRIBING': {
        const a = cA(), vb = cVB();
        if (a) { a.className = 'card-a dim'; a.textContent = 'Transcribing…'; }
        if (vb) vb.classList.remove('on');
        break;
      }
      case 'MA_TRANSCRIPT': {
        const q = cQ(), a = cA();
        if (q) q.textContent = msg.text;
        if (a) { a.className = 'card-a dim'; a.textContent = 'Answering…'; }
        break;
      }
      case 'MA_CHUNK': {
        const a = cA();
        if (a) {
          if (a.classList.contains('dim')) { a.className = 'card-a'; a.textContent = ''; }
          a.textContent += msg.text;
        }
        break;
      }
      case 'MA_DONE':
        ageCard();
        if (enabled) scheduleRestart(80);
        break;
      case 'MA_ERROR': {
        const noSpeech = msg.message?.includes('No clear speech');
        const vb = cVB(); if (vb) vb.classList.remove('on');
        if (noSpeech) {
          if (currentCard) dropCard(currentCard);
          if (enabled) scheduleRestart(80);
        } else {
          const a = cA();
          if (a) { a.className = 'card-a err'; a.textContent = msg.message; }
          ageCard();
          if (enabled) scheduleRestart(600);
        }
        break;
      }
    }
  }); } catch (_) {}

})();
