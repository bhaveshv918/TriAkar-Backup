// ─────────────────────────────────────────────────────────────────────────────
// Public site settings (Module 3/4) — non-sensitive, admin-tunable presentation
// values read by the storefront (e.g. Google-review stats). Admin WRITES go
// directly through site_settings' own admin-write RLS policy from the panel.
// Only whitelisted keys are ever returned here.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db/supabaseClient.js';

const PUBLIC_KEYS = [
  'mobile_menu_style',
  'google_rating', 'google_review_count', 'google_profile_url', 'google_snippets',
  // Content Center (Module 4)
  'social_instagram', 'whatsapp_number', 'contact_email',
  'announcement_1', 'announcement_2', 'announcement_3',
];

export async function getPublicSettings(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('site_settings').select('key,value').in('key', PUBLIC_KEYS);
    if (error) throw error;

    const settings = {};
    (data || []).forEach(r => { settings[r.key] = r.value; });

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ settings });
  } catch (err) { next(err); }
}
