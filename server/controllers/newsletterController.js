import supabase from '../db/supabaseClient.js';

export async function subscribeNewsletter(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRe.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });

    if (error) throw error;

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
