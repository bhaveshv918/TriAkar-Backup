/**
 * hero-print-animation.js  — TriAkar hero section
 * ─────────────────────────────────────────────────
 * DOM structure (injected):
 *
 *   .tpa-scene
 *     .tpa-label          ← "LIVE PRINT" badge  (static, top-left)
 *     .tpa-gantry         ← THE MOVING ASSEMBLY  (only top changes)
 *       .tpa-rail-track   ← horizontal rail      (full-width, static inside gantry)
 *       .tpa-head         ← carriage+hotend+nozzle (left changes inside gantry)
 *         .tpa-carriage
 *         .tpa-hotend
 *         .tpa-nozzle
 *         .tpa-drip
 *         .tpa-glow
 *     .tpa-object-wrap    ← layer stack          (bottom-anchored, centered)
 *     .tpa-bed            ← print bed            (static, bottom)
 *     .tpa-info           ← LAYERS / PLA+        (static, above bed)
 *
 * KEY INSIGHT:
 *   - .tpa-gantry is position:absolute, full scene width, height = head height.
 *   - Its `top` is driven by JS to track the current layer height.
 *   - .tpa-rail-track spans the full gantry width → always attached to gantry.
 *   - .tpa-head's `left` slides within the gantry for L/R passes.
 *   - Result: rail + head are ONE unit. No drift possible.
 *
 * Timing: ~7 s loop (28 layers × ~220 ms/layer + 1.2 s hold + 0.6 s reset).
 */

(function () {
  'use strict';

  /* ── Configuration ─────────────────────────────────────── */
  const CFG = {
    PASS_DURATION_MS: 1300,   /* slower, deliberate nozzle sweep (old-printer feel) */
    LAYER_INTERVAL_MS: 600,   /* slower pause between layers */
    HOLD_MS:          1800,
    RESET_MS:          700,
    LAYER_HEIGHT_PX:     5,   /* must match .tpa-layer { height } in CSS */

    /* Vase / artifact silhouette */
    objectWidth(i, total) {
      const t = i / total;
      if (t < 0.06) return 140 + t / 0.06 * 8;
      if (t < 0.18) return 148 - (t - 0.06) / 0.12 * 48;
      if (t < 0.45) return 100 + Math.sin((t - 0.18) / 0.27 * Math.PI) * 28;
      if (t < 0.65) return 128 - (t - 0.45) / 0.20 * 52;
      if (t < 0.78) return 76  - (t - 0.65) / 0.13 * 24;
      return 52 + (t - 0.78) / 0.22 * 18;
    },

    COLORS: [
      '#c8c4bc','#c4c0b8','#c0bcb2','#bcb8ac','#b8b2a4',
      '#c0ae9c','#c4a890','#caa086','#cc987c','#ca9070',
      '#c68866','#c2805c','#be7852','#ba7048','#b46840',
      '#ae6038','#a85830','#a05028','#984820','#904018',
      '#883812','#80320c','#782c08','#702604','#682002',
      '#601a00','#581400','#500e00',
    ],
  };

  /* ── Mount guard ────────────────────────────────────────── */
  const root = document.getElementById('triakar-print-animation');
  if (!root) return;
  if (root.dataset.tpaInit) return;
  root.dataset.tpaInit = '1';

  /* ── Inject DOM ─────────────────────────────────────────── */
  root.innerHTML = `
    <div class="tpa-wrap" id="tpaWrap">

      <!-- PRINTER CABINET — decorative frame around the scene -->
      <div class="tpa-cabinet">

        <!-- Static badge sits on top-left of cabinet -->
        <div class="tpa-label">
          <span class="tpa-label-dot"></span>
          LIVE PRINT
        </div>

        <!-- THE SCENE — sits inside the cabinet -->
        <div class="tpa-scene" id="tpaScene">

          <!-- THE GANTRY: rail + head move together as one unit -->
          <div class="tpa-gantry" id="tpaGantry">
            <div class="tpa-rail-track"></div>
            <div class="tpa-head" id="tpaHead">
              <div class="tpa-carriage"></div>
              <div class="tpa-hotend"></div>
              <div class="tpa-nozzle"></div>
              <div class="tpa-drip" id="tapDrip"></div>
              <div class="tpa-glow" id="tpaGlow"></div>
            </div>
          </div>

          <!-- Layer stack — grows upward from bed -->
          <div class="tpa-object-wrap" id="tpaObject"></div>

          <!-- Static bed -->
          <div class="tpa-bed"></div>

        </div><!-- /.tpa-scene -->

      </div><!-- /.tpa-cabinet -->

    </div>`;

  /* ── Refs ───────────────────────────────────────────────── */
  const scene        = document.getElementById('tpaScene');
  const gantry       = document.getElementById('tpaGantry');
  const head         = document.getElementById('tpaHead');
  const objWrap      = document.getElementById('tpaObject');
  const drip         = document.getElementById('tapDrip');
  const glow         = document.getElementById('tpaGlow');
  const layerCountEl = null;

  /* ── State ──────────────────────────────────────────────── */
  let layerIndex    = 0;
  const totalLayers = CFG.COLORS.length;
  let isRunning     = false;

  /* ── Layout math ────────────────────────────────────────── */
  /*
   * Scene height: 340px.  Bed height: 28px.
   * Bed surface (from scene top): 340 - 28 = 312px.
   *
   * Gantry height = carriage(14) + hotend(18) + nozzle(5) = 37px.
   * The gantry's BOTTOM edge = nozzle tip.
   *
   * We want nozzle tip to be flush with the TOP of the layer
   * about to be printed (= top of the stack so far).
   *
   *   stackTop = BED_SURFACE_Y - layerIndex * LAYER_HEIGHT_PX
   *   gantry.top = stackTop - GANTRY_HEIGHT
   *
   * (All values from scene top.)
   */
  /* Scene height: 280px (CSS .tpa-scene).
   * Info panel is now OUTSIDE the scene (below cabinet),
   * so bed surface = scene height - bed height.           */
  const SCENE_HEIGHT   = 280;
  const BED_HEIGHT     = 28;
  const BED_SURFACE_Y  = SCENE_HEIGHT - BED_HEIGHT;   // 252
  const GANTRY_HEIGHT  = 37;                           // carriage+hotend+nozzle

  function gantryTopForLayer(idx) {
    const stackTop = BED_SURFACE_Y - idx * CFG.LAYER_HEIGHT_PX;
    return stackTop - GANTRY_HEIGHT;
  }

  function sceneW() { return scene.offsetWidth || 260; }
  function xPx(pct) { return Math.round(sceneW() * pct / 100); }

  /* ── Move helpers ───────────────────────────────────────── */
  /* Slide head L/R within the gantry (only left changes) */
  function slideHead(xPercent, durationMs) {
    head.style.transition = durationMs
      ? `left ${durationMs}ms cubic-bezier(0.45,0,0.55,1)`
      : 'none';
    head.style.left = xPx(xPercent) + 'px';
  }

  /* Lift entire gantry to the correct Y for a given layer */
  function liftGantry(layerIdx, animate) {
    gantry.style.transition = animate ? 'top 0.3s ease-out' : 'none';
    gantry.style.top = gantryTopForLayer(layerIdx) + 'px';
  }

  /* ── Deposit effect ─────────────────────────────────────── */
  function depositEffect() {
    glow.classList.add('on');
    drip.classList.remove('active');
    void drip.offsetWidth;
    drip.classList.add('active');
    setTimeout(() => {
      glow.classList.remove('on');
      drip.classList.remove('active');
    }, 380);
  }

  /* ── Deposit one layer ──────────────────────────────────── */
  function depositLayer() {
    if (layerIndex >= totalLayers) return;

    const el = document.createElement('span');
    el.className        = 'tpa-layer';
    el.style.width      = CFG.objectWidth(layerIndex, totalLayers) + 'px';
    el.style.background = CFG.COLORS[layerIndex];
    el.style.boxShadow  = 'inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(0,0,0,.1)';
    objWrap.appendChild(el);

    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));

    depositEffect();
    layerIndex++;
    if (layerCountEl) layerCountEl.textContent = layerIndex;
  }

  /* ── Single pass ────────────────────────────────────────── */
  function runPass() {
    if (!isRunning) return;

    const goRight  = (layerIndex % 2 === 0);
    const startPct = goRight ? 8  : 92;
    const endPct   = goRight ? 92 : 8;

    /* 1. Snap gantry to current layer height (no anim) */
    liftGantry(layerIndex, false);

    /* 2. Snap head to start-of-pass X (no anim) */
    slideHead(startPct, 0);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      /* 3. Sweep head across */
      slideHead(endPct, CFG.PASS_DURATION_MS);

      /* 4. At midpoint: snap to center, deposit */
      setTimeout(() => {
        if (!isRunning) return;

        slideHead(50, 0);   /* center for deposit */
        depositLayer();     /* layerIndex++ happens here */

        /* 5. Lift gantry to next layer position */
        setTimeout(() => {
          if (!isRunning) return;
          liftGantry(layerIndex, true);   /* smooth lift */

          if (layerIndex < totalLayers) {
            setTimeout(runPass, CFG.LAYER_INTERVAL_MS);
          } else {
            /* Done — park head left, hold, then reset */
            glow.classList.remove('on');
            slideHead(8, 700);
            setTimeout(reset, CFG.HOLD_MS);
          }
        }, 80);

      }, CFG.PASS_DURATION_MS * 0.5);
    }));
  }

  /* ── Reset ──────────────────────────────────────────────── */
  function reset() {
    isRunning = false;
    glow.classList.remove('on');
    objWrap.classList.add('resetting');

    setTimeout(() => {
      objWrap.innerHTML = '';
      objWrap.classList.remove('resetting');
      layerIndex = 0;
      if (layerCountEl) layerCountEl.textContent = '0';
      setTimeout(start, 300);
    }, CFG.RESET_MS);
  }

  /* ── Start ──────────────────────────────────────────────── */
  function start() {
    isRunning = true;
    liftGantry(0, false);
    slideHead(8, 0);
    setTimeout(runPass, 350);
  }

  /* ── Tab visibility ─────────────────────────────────────── */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isRunning = false;
    } else {
      layerIndex > 0 && layerIndex < totalLayers ? reset() : start();
    }
  });

  /* ── Boot ───────────────────────────────────────────────── */
  document.readyState === 'complete' ? start() : window.addEventListener('load', start);

})();
