/* reviews-data.js — Local review fallback for TriAkar
 * Add entries here keyed by product slug to show reviews when the
 * API has none yet. Admin panel (Reviews tab) is the primary source.
 * Format per entry:
 *   'your-slug': [
 *     { id:'r001', product_slug:'your-slug', rating:5, reviewer_name:'Name',
 *       city:'City', review:'Text', created_at:'2026-01-01T10:00:00Z',
 *       verified_purchase:true },
 *     ...
 *   ]
 */

const REVIEWS_DATA = {
  // Add real product slugs and their reviews here,
  // or manage reviews through the admin panel → Reviews tab.
};

/* ── Precomputed stats per product (score + count) for product cards ── */
var REVIEW_STATS = {};
(function() {
  var slugs = Object.keys(REVIEWS_DATA);
  for (var i = 0; i < slugs.length; i++) {
    var slug = slugs[i];
    var revs = REVIEWS_DATA[slug];
    if (!revs || !revs.length) continue;
    var sum = 0;
    for (var j = 0; j < revs.length; j++) sum += Number(revs[j].rating) || 0;
    var avg = sum / revs.length;
    REVIEW_STATS[slug] = { score: Math.round(avg * 10) / 10, count: revs.length };
  }
})();

if (typeof window !== 'undefined') {
  window.REVIEWS_DATA = REVIEWS_DATA;
  window.REVIEW_STATS = REVIEW_STATS;
}
