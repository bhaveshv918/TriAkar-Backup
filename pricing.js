/* ═══════════════════════════════════════════════════════════════════
 * TriAkar — Pricing Engine (single source of truth)
 *
 * One cost-up model used everywhere:
 *   • server/scripts/import-products.js  (bulk pricing at import)
 *   • admin.html                         ("Auto-calculate price" button)
 *
 * The flow (matches the brief):
 *   1. Find the product's COST  = setup + material + machine + size handling,
 *                                 then add a waste/failure buffer.
 *   2. ADD SHIPPING             (per-size estimate baked into the price).
 *   3. ADD MARGIN               (profit multiplier on cost+shipping).
 *      → that rounded number is the LISTED / SELLING price.
 *   4. MRP = listed price × 2–3 (shown crossed-out).  Default 2.5×.
 *
 * Every number below is a CONFIG default — tune in PRICING_CONFIG, the math
 * never changes. `quote()` returns a full breakdown so pricing is transparent.
 *
 * UMD: exposes `window.TriakarPricing` in the browser and module.exports in Node.
 * ═══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node (CJS) / ESM default import
  if (typeof window !== 'undefined') window.TriakarPricing = api;            // browser global
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PRICING_CONFIG = {
    currency: 'INR',

    // ── 1. COST inputs ────────────────────────────────────────────────
    SETUP: 40,                      // ₹ fixed labour/handling per item (slicing, plate prep, QC)
    MATERIAL_RATE: {                // ₹ per gram of filament (buy-price ÷ usable yield)
      PLA: 2.0, 'PLA+': 2.0, PETG: 2.5, ABS: 2.3, TPU: 4.0, ASA: 3.0, RESIN: 6.0,
    },
    MACHINE_RATE: 25,               // ₹ per print-hour (electricity + printer depreciation + maintenance)
    SIZE_HANDLING: { S: 20, M: 40, L: 80, XL: 150 }, // ₹ post-processing/packing by size
    WASTE_BUFFER_PCT: 0.10,         // +10% on cost to cover failed prints / supports / waste

    // ── 2. SHIPPING (baked into the listed price) ─────────────────────
    SHIPPING: { S: 50, M: 70, L: 110, XL: 180 }, // ₹ per-size shipping estimate

    // ── 3. MARGIN (profit) ────────────────────────────────────────────
    MARGIN_MULTIPLIER: 1.8,         // listed = (cost + shipping) × this  (1.8 = 80% margin)
    PRICE_FLOOR: 149,               // ₹ never list below this
    ROUND_TO: 10,                   // round listed price UP to nearest ₹10 (set 1 for exact)

    // ── 4. MRP (crossed-out "was" price) ──────────────────────────────
    MRP_MULTIPLIER: 2.5,            // MRP = listed × this  (keep in the 2–3 range)
  };

  function _roundUp(n, step) { step = step || 1; return Math.ceil(n / step) * step; }
  function _num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }

  /**
   * Quote a product's price from its physical inputs.
   * @param {object} input  { grams, hours, material, size }  (size: S|M|L|XL)
   * @param {object} [cfg]   optional overrides merged over PRICING_CONFIG
   * @returns {object} full breakdown incl. price (listed) and mrp
   */
  function quote(input, cfg) {
    var C = Object.assign({}, PRICING_CONFIG, cfg || {});
    var grams = _num(input && input.grams);
    var hours = _num(input && input.hours);
    var material = (input && input.material) || 'PLA+';
    var size = ((input && input.size) || 'M').toString().toUpperCase();

    var matRate = C.MATERIAL_RATE[material] != null ? C.MATERIAL_RATE[material] : C.MATERIAL_RATE['PLA+'];
    var sizeHandling = C.SIZE_HANDLING[size] != null ? C.SIZE_HANDLING[size] : C.SIZE_HANDLING.M;
    var shipping = C.SHIPPING[size] != null ? C.SHIPPING[size] : C.SHIPPING.M;

    // 1. cost
    var materialCost = grams * matRate;
    var machineCost = hours * C.MACHINE_RATE;
    var baseCost = C.SETUP + materialCost + machineCost + sizeHandling;
    var waste = baseCost * C.WASTE_BUFFER_PCT;
    var cost = baseCost + waste;

    // 2. + shipping   3. + margin  → listed price
    var withShipping = cost + shipping;
    var marginAmount = withShipping * (C.MARGIN_MULTIPLIER - 1);
    var rawPrice = withShipping * C.MARGIN_MULTIPLIER;
    var price = Math.max(_roundUp(rawPrice, C.ROUND_TO), C.PRICE_FLOOR);

    // 4. MRP
    var mrp = _roundUp(price * C.MRP_MULTIPLIER, C.ROUND_TO);
    var discountPct = mrp > price ? Math.round((1 - price / mrp) * 100) : 0;

    return {
      currency: C.currency,
      inputs: { grams: grams, hours: hours, material: material, size: size, matRate: matRate },
      materialCost: Math.round(materialCost),
      machineCost: Math.round(machineCost),
      sizeHandling: sizeHandling,
      setup: C.SETUP,
      waste: Math.round(waste),
      cost: Math.round(cost),          // total cost to make
      shipping: shipping,
      marginAmount: Math.round(marginAmount),
      price: price,                    // ← LISTED / selling price
      compare_at_price: mrp,           // ← MRP (crossed out)
      mrp: mrp,
      discountPct: discountPct,
    };
  }

  return { PRICING_CONFIG: PRICING_CONFIG, quote: quote };
});
