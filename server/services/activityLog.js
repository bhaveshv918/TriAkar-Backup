// ─────────────────────────────────────────────────────────────────────────────
// Admin activity log (Module 7). Best-effort: a logging failure must never break
// the action that triggered it, so every call is wrapped and swallowed.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db/supabaseClient.js';

export async function logActivity(actor, action, entityType, entityId, detail) {
  try {
    await supabase.from('admin_activity').insert({
      actor_email: actor || null,
      action,
      entity_type: entityType || null,
      entity_id:   entityId != null ? String(entityId) : null,
      detail:      detail || null,
    });
  } catch (e) {
    console.error('logActivity:', e.message);
  }
}
