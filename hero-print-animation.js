/**
 * hero-print-animation.js , TriAkar hero section
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
 *     .tpa-lamp-light     ← glow inside the shade (lights up when print finishes)
 *     .tpa-bed            ← print bed            (static, bottom)
 *
 * KEY INSIGHT:
 *   - .tpa-gantry is position:absolute, full scene width, height = head height.
 *   - Its `top` is driven by JS to track the current layer height.
 *   - .tpa-rail-track spans the full gantry width → always attached to gantry.
 *   - .tpa-head's `left` slides within the gantry for L/R passes.
 *   - Result: rail + head are ONE unit. No drift possible.
 *
 * The lamp always fills ~80% of the scene's build volume (both axes), so
 * layer count and per-layer width are computed from the live scene size
 * rather than being fixed pixel constants, otherwise the print looks lost
 * in empty space on larger cabinets or clipped on smaller ones.
 *
 * Timing runs at 2x the tuned "1x" pace baked into BASE below.
 */

(function () {
  'use strict';

  /* ── Configuration ─────────────────────────────────────── */
  const SPEED = 2;   /* fixed 2x pace for the live site (no UI here) */

  const BASE = {
    PASS_DURATION_MS: 750,   /* smooth, continuous nozzle sweep, at 1x */
    LAYER_INTERVAL_MS: 107,  /* brief reversal pause, keeps motion flowing */
    HOLD_MS:          1286,
    RESET_MS:          500,
    BOOT_DELAY_MS:     250,
    RESTART_DELAY_MS:  214,
    DEPOSIT_FLASH_MS:  271,
    LIFT_MS:           210,
  };
  function dur(ms) { return ms / SPEED; }

  const CFG = {
    LAYER_HEIGHT_PX: 3,   /* must match .tpa-layer { height } in CSS */
    FILL_RATIO:     0.8,  /* the lamp fills 80% of the scene's build volume */

    /* Table-lamp silhouette as a 0..1 width ratio: wide base, thin neck,
       a shade that now spans nearly half the object's height. */
    widthRatio(i, total) {
      const t = i / total;
      if (t < 0.07) return 1.000 - t / 0.07 * 0.076;
      if (t < 0.16) return 0.924 - (t - 0.07) / 0.09 * 0.667;
      if (t < 0.45) return 0.258 + Math.sin((t - 0.16) / 0.29 * Math.PI) * 0.03;
      if (t < 0.52) return 0.258 + (t - 0.45) / 0.07 * 0.470;
      return 0.727 - (t - 0.52) / 0.48 * 0.288;
    },

    /* Warm grey-to-terracotta gradient, sampled by fraction so it still
       looks right regardless of how many layers the current box fits. */
    COLOR_STOPS: [
      '#c8c4bc','#c4c0b8','#c0bcb2','#bcb8ac','#b8b2a4',
      '#c0ae9c','#c4a890','#caa086','#cc987c','#ca9070',
      '#c68866','#c2805c','#be7852','#ba7048','#b46840',
      '#ae6038','#a85830','#a05028','#984820','#904018',
      '#883812','#80320c','#782c08','#702604','#682002',
      '#601a00','#581400','#500e00',
    ],

    colorAt(t) {
      const stops = CFG.COLOR_STOPS;
      const pos   = t * (stops.length - 1);
      const i0    = Math.min(stops.length - 2, Math.floor(pos));
      const frac  = pos - i0;
      const c0    = hexToRgb(stops[i0]);
      const c1    = hexToRgb(stops[i0 + 1]);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
      return `rgb(${r},${g},${b})`;
    },
  };

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ── Mount guard ────────────────────────────────────────── */
  const root = document.getElementById('triakar-print-animation');
  if (!root) return;
  if (root.dataset.tpaInit) return;
  root.dataset.tpaInit = '1';

  /* ── Inject DOM ─────────────────────────────────────────── */
  root.innerHTML = `
    <div class="tpa-wrap" id="tpaWrap">

      <!-- PRINTER CABINET, decorative frame around the scene -->
      <div class="tpa-cabinet">

        <!-- Static badge sits on top-left of cabinet -->
        <div class="tpa-label">
          <span class="tpa-label-dot"></span>
          LIVE PRINT
        </div>

        <!-- THE SCENE, sits inside the cabinet -->
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

          <!-- Layer stack, grows upward from bed -->
          <div class="tpa-object-wrap" id="tpaObject"></div>

          <!-- Light inside the shade, sibling of the stack so a reset
               (which wipes .tpa-object-wrap) never removes it -->
          <div class="tpa-lamp-light" id="tpaLampLight"></div>

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
  const lampLight    = document.getElementById('tpaLampLight');
  const layerCountEl = null;

  /* ── State ──────────────────────────────────────────────── */
  let layerIndex      = 0;
  let totalLayers      = 28;   /* recomputed per print in start() */
  let maxObjectWidth   = 130;  /* recomputed per print in start() */
  let isRunning        = false;

  /* ── Layout math ────────────────────────────────────────── */
  /* Scene size changes at the 1100px / 600px CSS breakpoints, so it's
   * read live instead of hardcoded, otherwise the gantry math drifts
   * and the print doesn't actually fill 80% of the box on every
   * tablet/mobile viewport.
   * Bed surface = scene height - bed height.           */
  const BED_HEIGHT     = 28;
  const GANTRY_HEIGHT  = 37;                           // carriage+hotend+nozzle

  function sceneH() { return scene.offsetHeight || 280; }
  function sceneW() { return scene.offsetWidth || 260; }
  function xPx(pct) { return Math.round(sceneW() * pct / 100); }

  function gantryTopForLayer(idx) {
    const bedSurfaceY = sceneH() - BED_HEIGHT;
    const stackTop = bedSurfaceY - idx * CFG.LAYER_HEIGHT_PX;
    return stackTop - GANTRY_HEIGHT;
  }

  /* How many layers/how wide the lamp needs to be to fill 80% of the
     scene's build volume, given the current (responsive) scene size. */
  function sizeForBox() {
    const targetHeight = (sceneH() - BED_HEIGHT) * CFG.FILL_RATIO;
    totalLayers    = Math.max(20, Math.round(targetHeight / CFG.LAYER_HEIGHT_PX));
    maxObjectWidth = sceneW() * CFG.FILL_RATIO;
    lampLight.style.bottom = (BED_HEIGHT + totalLayers * CFG.LAYER_HEIGHT_PX * 0.8) + 'px';
  }

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
    gantry.style.transition = animate ? `top ${dur(BASE.LIFT_MS)}ms ease-out` : 'none';
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
    }, dur(BASE.DEPOSIT_FLASH_MS));
  }

  /* ── Deposit one layer ──────────────────────────────────── */
  function depositLayer() {
    if (layerIndex >= totalLayers) return;

    const t = layerIndex / totalLayers;
    const el = document.createElement('span');
    el.className        = 'tpa-layer';
    el.style.width      = Math.round(CFG.widthRatio(layerIndex, totalLayers) * maxObjectWidth) + 'px';
    el.style.background = CFG.colorAt(t);
    el.style.boxShadow  = 'inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(0,0,0,.1)';
    objWrap.appendChild(el);

    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));

    depositEffect();
    layerIndex++;
    if (layerCountEl) layerCountEl.textContent = layerIndex;
  }

  /* ── Single pass ──────────────────────────────────────────
     One uninterrupted sweep across the bed. The head is never
     snapped mid-pass: each pass starts exactly where the last
     one ended (alternating sides), so motion stays continuous.
     The layer is deposited at the midpoint, where the easing
     naturally places the head over the centre, no jump.       */
  function runPass() {
    if (!isRunning) return;

    const goRight = (layerIndex % 2 === 0);
    const endPct  = goRight ? 92 : 8;   /* sweeps to the opposite edge */
    const passMs  = dur(BASE.PASS_DURATION_MS);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      /* one smooth sweep all the way across */
      slideHead(endPct, passMs);

      /* deposit at the midpoint, head is centred there, no snap */
      setTimeout(() => {
        if (isRunning) depositLayer();   /* layerIndex++ happens here */
      }, passMs * 0.5);

      /* at the end of the sweep: lift to the new layer height and chain.
         The lift overlaps the start of the next sweep, so the
         head glides sideways while the gantry rises, fluid, no stutter. */
      setTimeout(() => {
        if (!isRunning) return;
        liftGantry(layerIndex, true);

        if (layerIndex < totalLayers) {
          setTimeout(runPass, dur(BASE.LAYER_INTERVAL_MS));
        } else {
          glow.classList.remove('on');
          lampLight.classList.add('on');   /* print done: the lamp lights up */
          setTimeout(reset, dur(BASE.HOLD_MS));
        }
      }, passMs);
    }));
  }

  /* ── Reset ──────────────────────────────────────────────── */
  let isResetting = false;
  function reset() {
    if (isResetting) return;
    isResetting = true;
    isRunning = false;
    glow.classList.remove('on');
    lampLight.classList.remove('on');
    objWrap.classList.add('resetting');

    setTimeout(() => {
      objWrap.innerHTML = '';
      objWrap.classList.remove('resetting');
      layerIndex = 0;
      if (layerCountEl) layerCountEl.textContent = '0';
      setTimeout(() => {
        isResetting = false;
        start();
      }, dur(BASE.RESTART_DELAY_MS));
    }, dur(BASE.RESET_MS));
  }

  /* ── Start ──────────────────────────────────────────────── */
  function start() {
    if (isRunning) return;
    isRunning = true;
    sizeForBox();
    liftGantry(0, false);
    slideHead(8, 0);
    setTimeout(runPass, dur(BASE.BOOT_DELAY_MS));
  }

  /* ── Tab visibility ─────────────────────────────────────── */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isRunning = false;
    } else if (!isResetting) {
      layerIndex > 0 && layerIndex < totalLayers ? reset() : start();
    }
  });

  /* ── Boot ───────────────────────────────────────────────── */
  document.readyState === 'complete' ? start() : window.addEventListener('load', start);

})();
