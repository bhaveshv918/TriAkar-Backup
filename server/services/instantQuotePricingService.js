/**
 * Instant Quote, calibrated heuristic pricing engine.
 *
 * Deliberately NOT a real slicer (CuraEngine etc.), that research path was weighed
 * and rejected for v1: extra hosting cost/complexity on Render, and real slicers are
 * themselves commonly 15-50%+ off actual print time per slicer-vendor forum reports.
 * Instead this produces a fast, transparent estimate and the product explicitly
 * discloses a 15-60% variance band (see instant-quote.html + terms.html 3C), with
 * production never starting until a human confirms the order (business rule 10).
 *
 * Formula follows the structure used by real-world print-on-demand pricing tools:
 *   material_cost = weight_g × cost_per_gram
 *   machine_cost  = print_time_hours × hourly_machine_rate
 *   base_cost     = material_cost + machine_cost + failure_rate_buffer
 *   final_price   = max(base_cost × (1 + markup%), minimum_charge)
 *
 * Weight/time both derive from an "effective fill fraction", infill% alone
 * undercounts material for anything with real walls/top/bottom shells, so a
 * shell allowance is added on top of the selected infill%.
 *
 * That allowance used to be a single flat constant (SHELL_VOLUME_FRACTION),
 * which badly underestimates thin-walled/relief geometry (frames, lithophanes,
 * logos, anything closer to a shell than a block): a real slicer forces the
 * *entire* cross-section solid wherever it's thinner than 2 wall passes, so a
 * thin part can end up almost 100% solid regardless of the infill% picked,
 * while a chunky part with a real hollow core stays close to its infill%.
 * Verified 2026-08-16 against a "frame" model (250x170x9mm, mesh volume
 * 74.316 cm3, 15% infill, PLA) that Bambu Studio sliced to 72.23g, weight
 * = volume x effective_fill x density means the ACTUAL effective fill was
 * ~0.78, not the ~0.27 the flat 0.12 constant produced, a 2.8x price-side
 * miss. Surface area (already measured by meshAnalysisService and already
 * stored per-quote, just never fed into pricing before this fix) is the
 * signal that lets the shell allowance scale with how "thin" the geometry
 * actually is: shell_volume ~= surface_area x skin_thickness, so
 * shell_volume / total_volume grows automatically for thin/high-surface-area
 * shapes and stays small for chunky ones. Still only one real reference point
 * for the "thin" regime, keep validating against real orders and adjust
 * SHELL_SKIN_THICKNESS_CM as more data comes in.
 */
import supabase from '../db/supabaseClient.js';

const DEFAULTS = {
  instant_quote_hourly_machine_rate:   60,   // ₹/hr, covers depreciation + electricity
  instant_quote_markup_percent:        35,   // % on top of base cost
  instant_quote_min_charge:            249,  // ₹ floor price per quote
  instant_quote_failure_buffer_percent: 5,   // % buffer for failed/reprinted attempts
};

// Heuristic constants, not admin-tunable via site_settings (structural, not pricing
// policy), but isolated here as named constants so they're easy to recalibrate as
// real order data accumulates.
// Calibrated 2026-08-15 against one real reference part: a 53.96x96x230.95mm
// bracket, true solid mesh volume 224.12 cm3, sliced in Bambu Studio at 15%
// infill/2 walls/5-3 top-bottom = 72.24g actual, 3h2m actual. Back-solving from
// that data point gave a real effective-fill-fraction of ~0.26 (vs the raw 15%
// infill selected) and a real throughput of ~19 cm3/hr, the original guesses
// (0.20 flat shell allowance, 12 cm3/hr, then a 1.35x correction on top of that)
// compounded into a 3x overshoot on time. These are single-data-point estimates,
// not a statistically fitted model, recalibrate further as real orders land.
const PRINT_SPEED_CM3_PER_HOUR = 18;   // throughput at 100% effective fill, at the 0.4mm baseline nozzle
const SHELL_VOLUME_FRACTION    = 0.12; // floor, used when surface_area isn't available, and as the minimum for chunky/low-surface-area shapes
const SHELL_SKIN_THICKNESS_CM  = 0.1;  // ~1mm forced-solid skin per unit of surface area (top/bottom shell layers dominate for thin/relief shapes, wall loops for chunkier ones)
const CALIBRATION_CORRECTION   = 1.15; // small buffer for travel/retraction overhead pure volume math misses

// Wall loops are part of the forced-solid skin SHELL_SKIN_THICKNESS_CM stands for, and that
// constant was back-solved from a 2-wall slice (see the header block), so 2 walls is the
// baseline this whole model is calibrated at. Rather than bolt on a separate, uncalibrated
// wall model, each wall above or below the baseline adds or removes one nozzle-width of
// skin, which is physically what one more perimeter is. The point of expressing it this way
// is that it is exactly neutral at WALLS_BASELINE: every quote priced before walls became
// selectable keeps the price it already had, and only a customer who deliberately moves the
// slider sees a difference.
const WALLS_BASELINE = 2;
const WALLS_MIN = 1, WALLS_MAX = 8;

// A larger nozzle lays down more plastic per pass (thicker lines/layers), so the same
// volume prints faster; a finer nozzle is slower and used for detail work. Weight is
// unaffected, same material either way, just deposited faster or slower.
const NOZZLE_TIME_MULTIPLIER = { 0.2: 1.7, 0.4: 1.0, 0.6: 0.75, 0.8: 0.55 };

// A thinner layer height means more layers stacked to reach the same model
// height, so more total passes and more time; a thicker layer height is
// faster but coarser. Independent of nozzle width (nozzle affects line
// width/flow rate, layer height affects the Z step).
// Covers every layer height reachable across all four nozzle sizes (each
// nozzle only offers a subset, see LAYER_HEIGHT_TIERS_BY_NOZZLE in
// instant-quote.html), 0.2mm/1.0x stays the baseline throughout.
const LAYER_HEIGHT_TIME_MULTIPLIER = {
  0.05: 2.4, 0.08: 1.9, 0.1: 1.6, 0.12: 1.25,
  0.14: 1.1, 0.2: 1.0, 0.28: 0.8, 0.3: 0.78,
  0.4: 0.65, 0.6: 0.5,
};

async function getSetting(key) {
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  const v = data?.value;
  return v != null && v !== '' ? Number(v) : DEFAULTS[key];
}

async function getPricingConstants() {
  const [hourly_machine_rate, markup_percent, min_charge, failure_buffer_percent] = await Promise.all([
    getSetting('instant_quote_hourly_machine_rate'),
    getSetting('instant_quote_markup_percent'),
    getSetting('instant_quote_min_charge'),
    getSetting('instant_quote_failure_buffer_percent'),
  ]);
  return { hourly_machine_rate, markup_percent, min_charge, failure_buffer_percent };
}

const round2 = n => Math.round(n * 100) / 100;

/**
 * @param {number} volume_cm3
 * @param {number} infill_percent  5-100
 * @param {{density_g_cm3:number, cost_per_gram_public:number}} material
 * @param {number} [surface_area_cm2]  from meshAnalysisService; drives the geometry-aware
 *   shell term below. Falls back to the flat SHELL_VOLUME_FRACTION floor if omitted.
 */
export async function computeInstantQuotePrice({ volume_cm3, infill_percent, material, nozzle_mm = 0.4, layer_height_mm = 0.2, surface_area_cm2 = null, wall_count = WALLS_BASELINE }) {
  if (!(volume_cm3 > 0)) throw Object.assign(new Error('Invalid model volume'), { status: 400 });
  if (!material) throw Object.assign(new Error('Material is required'), { status: 400 });

  const { hourly_machine_rate, markup_percent, min_charge, failure_buffer_percent } = await getPricingConstants();

  const infillFraction = Math.max(0.05, Math.min(1, infill_percent / 100));
  // shell_volume ≈ surface_area × forced-solid skin thickness, so this grows on its own
  // for thin/high-surface-area geometry (frames, lithophanes, reliefs) instead of using
  // the same flat allowance for every shape — see the comment block at the top of this
  // file. Never goes below the old flat constant, so chunky/low-surface-area parts keep
  // the original (already order-validated) behavior.
  // See WALLS_BASELINE: one extra perimeter is one more nozzle-width of solid skin. Clamped
  // rather than rejected because this is a price estimate, not a slicer, and a nonsense wall
  // count should degrade to the nearest sane one instead of failing someone's quote.
  const walls = Math.min(WALLS_MAX, Math.max(WALLS_MIN, Math.round(Number(wall_count) || WALLS_BASELINE)));
  const nozzleWidthCm = (Number(nozzle_mm) || 0.4) / 10;
  const skinThicknessCm = Math.max(0.02, SHELL_SKIN_THICKNESS_CM + (walls - WALLS_BASELINE) * nozzleWidthCm);
  const skinShellFraction = (surface_area_cm2 > 0)
    ? Math.min(1, (surface_area_cm2 * skinThicknessCm) / volume_cm3)
    : SHELL_VOLUME_FRACTION;
  const weightFillFraction = Math.min(1, infillFraction + Math.max(SHELL_VOLUME_FRACTION, skinShellFraction));
  // Print time deliberately keeps the flat SHELL_VOLUME_FRACTION model rather than
  // weightFillFraction above: mass scales with true solid volume regardless of shape, but
  // time doesn't scale the same way for wide/thin parts (few Z layers, most of the "extra
  // solid" is fast wide top/bottom passes, not slow deep infill) — on the one thin-geometry
  // reference point we have (2026-08-16, see file header), the flat model's time estimate
  // was already close to the real slice (1.28h vs ~1.43h actual), reusing weightFillFraction
  // here instead would have overshot to ~3.7h. Revisit if real order data says otherwise.
  // Wall count is deliberately left out of this one for the same reason: it feeds the
  // weight side (more perimeters is straightforwardly more plastic) but putting it into the
  // time side too would be a second uncalibrated guess stacked on a model that is already
  // flat by design. Revisit together with the note above once real order data exists.
  const timeFillFraction = Math.min(1, infillFraction + SHELL_VOLUME_FRACTION);
  const nozzleMultiplier = NOZZLE_TIME_MULTIPLIER[nozzle_mm] || 1.0;
  const layerHeightMultiplier = LAYER_HEIGHT_TIME_MULTIPLIER[layer_height_mm] || 1.0;

  const weight_g = round2(volume_cm3 * weightFillFraction * material.density_g_cm3);
  const print_time_hours = round2((volume_cm3 * timeFillFraction / PRINT_SPEED_CM3_PER_HOUR) * CALIBRATION_CORRECTION * nozzleMultiplier * layerHeightMultiplier);

  const material_cost = round2(weight_g * material.cost_per_gram_public);
  const machine_cost = round2(print_time_hours * hourly_machine_rate);
  const failure_buffer = round2((material_cost + machine_cost) * (failure_buffer_percent / 100));
  const base_cost = round2(material_cost + machine_cost + failure_buffer);
  const markup_amount = round2(base_cost * (markup_percent / 100));
  const raw_price = round2(base_cost + markup_amount);
  const minimum_applied = raw_price < min_charge;
  const final_price = Math.round(Math.max(raw_price, min_charge));

  return {
    weight_g,
    print_time_hours,
    final_price,
    price_breakdown: {
      material_cost, machine_cost, failure_buffer, base_cost,
      markup_percent, markup_amount, raw_price, minimum_applied,
      minimum_charge: min_charge, hourly_machine_rate,
      variance_note: 'Automated estimate, actual price may vary 15-60% after human review.',
    },
  };
}
