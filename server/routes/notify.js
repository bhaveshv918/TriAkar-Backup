import { Router } from 'express';
import {
  sendContactAlert,
  sendEnquiryConfirmation,
  sendAdminEnquiryAlert,
  sendCallbackAlert,
} from '../services/emailService.js';

const router = Router();

/* ── POST /api/notify ─────────────────────────────────────────
   Public endpoint the frontend calls after persisting a
   contact / enquiry / callback row to Supabase. Email failures
   are swallowed (200 with emailed:false) so UX is never broken. */
router.post('/', async (req, res, next) => {
  try {
    const { type, data } = req.body || {};

    const validTypes = ['contact', 'enquiry', 'callback'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Missing or invalid data' });
    }
    // Bound abuse of this public, unauthenticated endpoint
    if (JSON.stringify(data).length > 8000) {
      return res.status(400).json({ error: 'Payload too large' });
    }

    try {
      if (type === 'contact') {
        await sendContactAlert(data);
      } else if (type === 'enquiry') {
        // SECURITY: data.email is user-supplied and this endpoint is public —
        // only send the Resend confirmation to a syntactically valid address,
        // otherwise the endpoint becomes an open relay from our domain.
        const emailOk = typeof data.email === 'string'
          && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())
          && data.email.trim().length <= 254;
        if (emailOk) await sendEnquiryConfirmation(data);
        await sendAdminEnquiryAlert(data);
      } else if (type === 'callback') {
        await sendCallbackAlert(data);
      }
    } catch (e) {
      console.error('Notify email error:', e.message);
      return res.json({ ok: true, emailed: false });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
