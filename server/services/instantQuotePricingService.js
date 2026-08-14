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
 * undercounts material for anything with real walls/top/bottom shells, so a flat
 * shell allowance is added on top of the selected infill%.
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
const SHELL_VOLUME_FRACTION    = 0.12; // walls/top/bottom add roughly this much beyond raw infill%
const CALIBRATION_CORRECTION   = 1.15; // small buffer for travel/retraction overhead pure volume math misses

// A larger nozzle lays down more plastic per pass (thicker lines/layers), so the same
// volume prints faster; a finer nozzle is slower and used for detail work. Weight is
// unaffected, same material either way, just deposited faster or slower.
const NOZZLE_TIME_MULTIPLIER = { 0.2: 1.7, 0.4: 1.0, 0.6: 0.75, 0.8: 0.55 };

// A thinner layer height means more layers stacked to reach the same model
// height, so more total passes and more time; a thicker layer height is
// faster but coarser. Independent of nozzle width (nozzle affects line
// width/flow rate, layer height affects the Z step).
const LAYER_HEIGHT_TIME_MULTIPLIER = { 0.08: 1.6, 0.12: 1.25, 0.2: 1.0, 0.28: 0.8 };

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
 */
export async function computeInstantQuotePrice({ volume_cm3, infill_percent, material, nozzle_mm = 0.4, layer_height_mm = 0.2 }) {
  if (!(volume_cm3 > 0)) throw Object.assign(new Error('Invalid model volume'), { status: 400 });
  if (!material) throw Object.assign(new Error('Material is required'), { status: 400 });

  const { hourly_machine_rate, markup_percent, min_charge, failure_buffer_percent } = await getPricingConstants();

  const infillFraction = Math.max(0.05, Math.min(1, infill_percent / 100));
  const effectiveFillFraction = Math.min(1, infillFraction + SHELL_VOLUME_FRACTION);
  const nozzleMultiplier = NOZZLE_TIME_MULTIPLIER[nozzle_mm] || 1.0;
  const layerHeightMultiplier = LAYER_HEIGHT_TIME_MULTIPLIER[layer_height_mm] || 1.0;

  const weight_g = round2(volume_cm3 * effectiveFillFraction * material.density_g_cm3);
  const print_time_hours = round2((volume_cm3 * effectiveFillFraction / PRINT_SPEED_CM3_PER_HOUR) * CALIBRATION_CORRECTION * nozzleMultiplier * layerHeightMultiplier);

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
