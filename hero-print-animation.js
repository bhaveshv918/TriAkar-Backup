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
 *     .tpa-shade-glow     ← trapezoid glow matching the shade's own silhouette
 *     .tpa-pull-thread    ← pull-chain, appears once printed, tugged to switch on
 *     .tpa-bed            ← print bed            (static, bottom)
 *   .tpa-speed-bar         ← 1x/2x/5x/10x pace control, below the cabinet
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
 * Once printed, a pull-chain appears, gets tugged, and the whole shade
 * (not a small dot) lights up warmly. The scene then holds on the lit
 * lamp for a fixed 20s (not affected by the speed control, since that's
 * about giving the finished piece a moment, not print pacing) before
 * fading out and printing again.
 */

(function () {
  'use strict';

  /* ── Configuration ─────────────────────────────────────── */
  let SPEED = 2;   /* default pace; buttons below can change this live */

  const BASE = {
    PASS_DURATION_MS: 750,   /* smooth, continuous nozzle sweep, at 1x */
    LAYER_INTERVAL_MS: 107,  /* brief reversal pause, keeps motion flowing */
    RESET_MS:          500,
    BOOT_DELAY_MS:     250,
    RESTART_DELAY_MS:  214,
    DEPOSIT_FLASH_MS:  271,
    LIFT_MS:           210,
  };
  function dur(ms) { return ms / SPEED; }

  /* Fixed, independent of SPEED: the pull-chain flourish and the hold
     on the finished, lit lamp are about showing it off, not print pace. */
  const THREAD_REVEAL_DELAY_MS = 300;
  const LIGHT_ON_DELAY_MS      = 340;   /* fires mid-pull, at the "click" */
  const FINISHED_HOLD_MS       = 20000;

  const CFG = {
    LAYER_HEIGHT_PX: 3,   /* must match .tpa-layer { height } in CSS */
    FILL_RATIO:      0.8, /* the lamp fills 80% of the scene's build volume */
    SHADE_START_T:   0.52, /* fraction of the print where the shade begins */

    /* Table-lamp silhouette as a 0..1 width ratio: wide base, thin neck,
       a shade spanning nearly half the object's height. */
    widthRatio(i, total) {
      const t = i / total;
      const shadeStart = CFG.SHADE_START_T;
      if (t < 0.07) return 1.000 - t / 0.07 * 0.076;
      if (t < 0.16) return 0.924 - (t - 0.07) / 0.09 * 0.667;
      if (t < 0.45) return 0.258 + Math.sin((t - 0.16) / 0.29 * Math.PI) * 0.03;
      if (t < shadeStart) return 0.258 + (t - 0.45) / (shadeStart - 0.45) * 0.470;
      return 0.727 - (t - shadeStart) / (1 - shadeStart) * 0.288;
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

          <!-- Glow shaped like the shade itself, siblings of the stack
               so a reset (which wipes .tpa-object-wrap) never removes
               them -->
          <div class="tpa-shade-glow" id="tpaShadeGlow"></div>
          <div class="tpa-pull-thread" id="tpaPullThread">
            <span class="tpa-pull-string"></span>
            <span class="tpa-pull-bead"></span>
          </div>

          <!-- Static bed -->
          <div class="tpa-bed"></div>

        </div><!-- /.tpa-scene -->

      </div><!-- /.tpa-cabinet -->

      <!-- Pace control, below the cabinet -->
      <div class="tpa-speed-bar" id="tpaSpeedBar">
        <button class="tpa-speed-btn" type="button" data-speed="1">1x</button>
        <button class="tpa-speed-btn active" type="button" data-speed="2">2x</button>
        <button class="tpa-speed-btn" type="button" data-speed="5">5x</button>
        <button class="tpa-speed-btn" type="button" data-speed="10">10x</button>
      </div>

    </div>`;

  /* ── Refs ───────────────────────────────────────────────── */
  const scene        = document.getElementById('tpaScene');
  const gantry       = document.getElementById('tpaGantry');
  const head         = document.getElementById('tpaHead');
  const objWrap      = document.getElementById('tpaObject');
  const drip         = document.getElementById('tapDrip');
  const glow         = document.getElementById('tpaGlow');
  const shadeGlow    = document.getElementById('tpaShadeGlow');
  const pullThread   = document.getElementById('tpaPullThread');
  const speedBar     = document.getElementById('tpaSpeedBar');
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
  }

  /* Once the print is finished, size and position the shade glow and
     the pull-chain to match the ACTUAL printed shade, so the light
     looks like it's coming from inside that specific shade. */
  function positionShade() {
    const shadeStartIdx = Math.round(CFG.SHADE_START_T * totalLayers);
    const shadeHeightPx = (totalLayers - shadeStartIdx) * CFG.LAYER_HEIGHT_PX;
    const shadeBottomW  = CFG.widthRatio(shadeStartIdx, totalLayers) * maxObjectWidth;
    const shadeTopW     = CFG.widthRatio(totalLayers - 1, totalLayers) * maxObjectWidth;
    const shadeBottomY  = BED_HEIGHT + shadeStartIdx * CFG.LAYER_HEIGHT_PX;

    shadeGlow.style.width  = Math.round(shadeBottomW) + 'px';
    shadeGlow.style.height = Math.round(shadeHeightPx) + 'px';
    shadeGlow.style.bottom = Math.round(shadeBottomY) + 'px';
    const topHalfPct = Math.max(8, (shadeTopW / shadeBottomW) * 50);
    shadeGlow.style.clipPath = `polygon(${50 - topHalfPct}% 0%, ${50 + topHalfPct}% 0%, 100% 100%, 0% 100%)`;
    shadeGlow.style.webkitClipPath = shadeGlow.style.clipPath;

    pullThread.style.bottom = Math.round(shadeBottomY - 2) + 'px';
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

  /* ── Pull the chain, then the shade lights up ──────────────
     Runs once, when the print finishes. The light turns on mid-pull,
     at the moment the chain would "click", not after it settles. */
  function pullChainAndLightUp() {
    positionShade();
    pullThread.classList.add('visible');
    setTimeout(() => {
      pullThread.classList.add('pulling');
      setTimeout(() => {
        shadeGlow.classList.add('on');
      }, LIGHT_ON_DELAY_MS);
    }, THREAD_REVEAL_DELAY_MS);
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
          pullChainAndLightUp();
          setTimeout(reset, FINISHED_HOLD_MS);
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
    shadeGlow.classList.remove('on');
    pullThread.classList.remove('visible', 'pulling');
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

  /* ── Speed control ──────────────────────────────────────────
     Changing SPEED takes effect from the next scheduled step
     onward; nothing needs to be torn down or restarted. The
     pull-chain flourish and the finished-lamp hold stay fixed. */
  speedBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tpa-speed-btn');
    if (!btn) return;
    SPEED = Number(btn.dataset.speed);
    speedBar.querySelectorAll('.tpa-speed-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
  });

  /* ── Boot ───────────────────────────────────────────────── */
  document.readyState === 'complete' ? start() : window.addEventListener('load', start);

})();
