// ─────────────────────────────────────────────────────────────────────────────
// Branch routing for incoming orders.
//
// Every order belongs to the branch that will fulfil it. The delivery pincode
// decides the default (Gurugram / Sohna belt goes to the Sohna branch, the rest
// to Greater Noida West), and the admin can always override it by hand afterwards
// in Business OS. This only picks the starting value.
//
// The rules live in the biz_branch_pincodes table rather than in code, so the
// owner can add a pincode range from the panel without a deploy. They are cached
// in-process for a few minutes because checkout is the hot path and this list
// changes about twice a year.
//
// Deliberately never throws: a lookup failure falls back to the Noida default
// rather than failing a real customer's payment.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db/supabaseClient.js';

export const DEFAULT_BRANCH = 'noida';

const CACHE_TTL_MS = 5 * 60 * 1000;
let _rules = null;
let _rulesAt = 0;
// False until a lookup has actually succeeded once. This is what tells the callers
// that the branches migration has not been run yet, so they can leave branch_id out
// of the insert entirely instead of sending a column the table does not have and
// failing a real customer's checkout.
let _available = false;

async function loadRules() {
  if (_rules && Date.now() - _rulesAt < CACHE_TTL_MS) return _rules;
  try {
    const { data, error } = await supabase
      .from('biz_branch_pincodes')
      .select('pincode_prefix, branch_id');
    if (error) throw error;
    // Longest prefix first, so a specific 122103 rule beats a broad 122 one.
    _rules = (data || []).sort((a, b) => b.pincode_prefix.length - a.pincode_prefix.length);
    _rulesAt = Date.now();
    _available = true;
  } catch (err) {
    console.warn('[branch] pincode rule lookup failed:', err.message);
    if (!_rules) _rules = [];   // keep any previously cached list rather than blanking it
  }
  return _rules;
}

/**
 * Six-digit pincode to branch id, defaulting to DEFAULT_BRANCH.
 * Returns undefined when branches are not set up at all, which JSON.stringify drops
 * from an insert payload, so callers can pass the result straight through.
 */
export async function branchForPincode(pincode) {
  const rules = await loadRules();
  if (!_available) return undefined;
  const pin = String(pincode || '').replace(/\D/g, '');
  if (pin.length !== 6) return DEFAULT_BRANCH;
  const hit = rules.find(r => pin.startsWith(r.pincode_prefix));
  return hit ? hit.branch_id : DEFAULT_BRANCH;
}

/** Convenience wrapper for the shipping_address JSON the order routes already build. */
export async function branchForAddress(address) {
  return branchForPincode(address?.pincode || address?.postal_code);
}

/** Called after the owner edits the pincode rules, so the next order sees them. */
export function clearBranchRuleCache() {
  _rules = null;
  _rulesAt = 0;
  _available = false;
}
