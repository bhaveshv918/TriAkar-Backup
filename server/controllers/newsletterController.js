import supabase from '../db/supabaseClient.js';
import { sendNewsletterBroadcast } from '../services/emailService.js';

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

// Admin — list all subscribers, most recent first
export async function listNewsletterSubscribers(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ subscribers: data || [], count: (data || []).length });
  } catch (err) {
    next(err);
  }
}

// Admin — instantly broadcast a message to every subscriber. Sends sequentially
// with a short delay between each to stay under Resend's rate limit; one bad
// address does not stop the rest of the batch.
export async function broadcastToSubscribers(req, res, next) {
  try {
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('email');

    if (error) throw error;

    const emails = (data || []).map(r => r.email);
    let sent = 0;
    const failed = [];

    for (const email of emails) {
      try {
        await sendNewsletterBroadcast({ to: email, subject, message });
        sent++;
      } catch (err) {
        failed.push(email);
      }
      await new Promise(r => setTimeout(r, 350));
    }

    res.json({ ok: true, total: emails.length, sent, failed });
  } catch (err) {
    next(err);
  }
}
