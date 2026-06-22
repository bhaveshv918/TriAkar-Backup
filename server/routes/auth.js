import { Router } from 'express';
import supabase, { createSignInClient } from '../db/supabaseClient.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sendEmailVerification, sendPasswordReset } from '../services/emailService.js';

/* Generate 12-digit UserID: DDMMYY + 6 random (e.g. 020626847391 = 2-Jun-2026) */
function generateUserCode(date = new Date()) {
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yy   = String(date.getFullYear()).slice(-2);
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return dd + mm + yy + rand;
}

const router = Router();

/* ── POST /api/auth/send-otp ─────────────────────────────── */
router.post('/send-otp', async (req, res, next) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    // Normalise: strip non-digits, ensure 10-digit Indian number
    const digits = phone.replace(/\D/g, '');
    const mobile = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    if (mobile.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number' });

    // Rate-limit: allow max 3 OTPs per phone per 10 minutes
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('phone_otps')
      .select('*', { count: 'exact', head: true })
      .eq('phone', mobile)
      .gte('created_at', windowStart);
    if (count >= 3) return res.status(429).json({ error: 'Too many OTP requests. Please wait 10 minutes.' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

    await supabase.from('phone_otps').insert({ phone: mobile, otp, expires_at });

    // Send via Fast2SMS
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      // FIX #19: only return dev_otp when explicitly in 'development' mode, never in staging/unset envs
      console.log(`[DEV] OTP for ${mobile}: ${otp}`);
      const isDev = process.env.NODE_ENV === 'development';
      return res.json({ sent: true, ...(isDev && { dev_otp: otp }) });
    }

    const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'otp', variables_values: otp, numbers: mobile }),
    });
    const smsData = await smsRes.json();
    if (!smsData.return) {
      console.error('Fast2SMS error:', smsData);
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }

    res.json({ sent: true });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/verify-otp ───────────────────────────── */
router.post('/verify-otp', async (req, res, next) => {
  try {
    let { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'phone and otp are required' });

    const digits = phone.replace(/\D/g, '');
    const mobile = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;

    // Fetch the most recent unverified code for this number, then compare in code
    // so we can enforce a per-code attempt cap (brute-force lockout).
    const { data: record } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', mobile)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!record) return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
    if ((record.attempts || 0) >= 5)
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    if (new Date(record.expires_at) <= new Date())
      return res.status(400).json({ error: 'Your code has expired. Please request a new one.' });

    if (record.otp !== String(otp).trim()) {
      await supabase.from('phone_otps').update({ attempts: (record.attempts || 0) + 1 }).eq('id', record.id);
      return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
    }

    // Mark as verified
    await supabase.from('phone_otps').update({ verified: true }).eq('id', record.id);

    res.json({ verified: true, phone: mobile });
  } catch (err) { next(err); }
});

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, full_name, phone, phone_verified } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'email, password, and full_name are required' });
    }

    // OTP check paused — re-enable after DLT registration
    // if (phone) { ... }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone || null },
    });
    if (error) return res.status(400).json({ error: error.message });

    // Ensure profile row exists with user_code
    const digits = phone ? phone.replace(/\D/g, '') : null;
    const mobile = digits && digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;

    // Generate a collision-safe UserID (retry up to 5 times)
    let user_code = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateUserCode();
      const { data: existing } = await supabase.from('profiles').select('id').eq('user_code', candidate).maybeSingle();
      if (!existing) { user_code = candidate; break; }
    }

    await supabase.from('profiles').upsert(
      { id: data.user.id, full_name, phone: phone || null, mobile: mobile ? `+91${mobile}` : null, phone_verified: !!phone, user_code },
      { onConflict: 'id' },
    );

    res.status(201).json({ message: 'Account created successfully.', user_id: data.user.id, user_code });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    // Use a dedicated client — signInWithPassword would otherwise poison the shared
    // service-role client's session, downgrading later data writes to RLS-enforced.
    const signInClient = createSignInClient();
    const { data, error } = await signInClient.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    // Fetch user_code from profiles (ensures it's always fresh)
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_code, full_name, mobile')
      .eq('id', data.user.id)
      .maybeSingle();

    // If somehow no user_code yet (pre-migration user), generate and save one now
    let user_code = profile?.user_code;
    if (!user_code) {
      for (let i = 0; i < 5; i++) {
        const candidate = generateUserCode();
        const { data: clash } = await supabase.from('profiles').select('id').eq('user_code', candidate).maybeSingle();
        if (!clash) { user_code = candidate; break; }
      }
      if (user_code) await supabase.from('profiles').update({ user_code }).eq('id', data.user.id);
    }

    res.json({
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in:    data.session.expires_in,
      user:          Object.assign({}, data.user, { user_code }),
      user_code,
    });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/send-verification-email ─────────────── */
router.post('/send-verification-email', requireAuth, async (req, res, next) => {
  try {
    const email = req.user.email;
    if (!email) return res.status(400).json({ error: 'No email on account' });
    console.log('[otp] request for:', email);

    const emailKey = email.toLowerCase();

    // Rate-limit: max 3 per 10 minutes (wrapped — if email column not yet added, skip silently)
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    try {
      const { count } = await supabase
        .from('phone_otps')
        .select('*', { count: 'exact', head: true })
        .eq('email', emailKey)
        .gte('created_at', windowStart);
      if (count >= 3) return res.status(429).json({ error: 'Too many requests. Please wait 10 minutes.' });
    } catch (_) {}

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Always log OTP — visible in Render logs so you can verify/debug without email
    console.log(`[otp] generated for ${emailKey}: ${otp}`);

    // Store the OTP. Try the email-column layout first; if that fails for ANY
    // reason, fall back to the original phone-based key (phone = 'email:<addr>')
    // which works with the legacy phone_otps schema. We never block OTP delivery
    // on a storage hiccup — the email is what the user actually needs.
    let storeError = null;
    const { error: insertErr } = await supabase.from('phone_otps').insert({
      phone: '0000000000',
      email: emailKey,
      otp,
      expires_at,
    });
    if (insertErr) {
      console.error('[otp] insert (email-column) failed:', insertErr.message);
      // Fallback: legacy phone-based key — no email column required
      const { error: fbErr } = await supabase.from('phone_otps').insert({
        phone: 'email:' + emailKey,
        otp,
        expires_at,
      });
      if (fbErr) {
        console.error('[otp] insert (phone-key fallback) failed:', fbErr.message);
        storeError = `primary: ${insertErr.message} | fallback: ${fbErr.message}`;
      } else {
        console.log('[otp] stored via phone-key fallback for:', emailKey);
      }
    }

    let emailDelivered = false;
    let emailError = null;
    if (!process.env.RESEND_API_KEY) {
      emailError = 'RESEND_API_KEY not configured on Render — add it in Environment Variables';
      console.error('[otp]', emailError);
    } else {
      try {
        await sendEmailVerification({ email, otp });
        emailDelivered = true;
        console.log('[otp] email delivered to:', emailKey);
      } catch (mailErr) {
        emailError = mailErr.message;
        console.error('[otp] Resend failed for', emailKey, '—', mailErr.message);
      }
    }

    // Surface the real reason ONLY in development — never leak internal store/email
    // error details (DB column names, provider messages) to production clients.
    const debug = [storeError && `store: ${storeError}`, emailError && `email: ${emailError}`]
      .filter(Boolean).join(' || ');
    const isDev = process.env.NODE_ENV === 'development';
    res.json({
      sent: true,
      emailDelivered,
      ...(isDev && debug ? { _debug: debug } : {}),
    });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/verify-email-otp ────────────────────── */
router.post('/verify-email-otp', requireAuth, async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'otp is required' });
    const emailKey = req.user.email.toLowerCase();

    // Fetch the most recent unverified OTP row — match either storage layout:
    // the email column OR the legacy phone-based key (phone = 'email:<addr>')
    const { data: rows } = await supabase
      .from('phone_otps')
      .select('*')
      .or(`email.eq.${emailKey},phone.eq.email:${emailKey}`)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);
    const record = rows && rows[0];

    if (!record) return res.status(400).json({ error: 'No pending code found. Please request a new one.' });

    if ((record.attempts || 0) >= 5)
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });

    if (new Date(record.expires_at) <= new Date()) {
      return res.status(400).json({ error: 'Your code has expired. Please request a new one.' });
    }

    if (record.otp !== String(otp).trim()) {
      await supabase.from('phone_otps').update({ attempts: (record.attempts || 0) + 1 }).eq('id', record.id);
      return res.status(400).json({ error: 'Incorrect code. Please check and try again.' });
    }

    await supabase.from('phone_otps').update({ verified: true }).eq('id', record.id);
    await supabase.from('profiles').update({ email_verified: true }).eq('id', req.user.id);

    res.json({ verified: true });
  } catch (err) { next(err); }
});

/* ── GET /api/auth/email-verified-status ─────────────────── */
router.get('/email-verified-status', requireAuth, async (req, res, next) => {
  try {
    // Check profiles.email_verified first (if column exists)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('id', req.user.id)
        .maybeSingle();
      if (profile && profile.email_verified === true) return res.json({ verified: true });
    } catch (_) {}

    // Fallback: check phone_otps for a verified email OTP row
    const { data } = await supabase
      .from('phone_otps')
      .select('id')
      .eq('email', req.user.email.toLowerCase())
      .eq('verified', true)
      .limit(1);

    res.json({ verified: !!(data && data.length) });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) await supabase.auth.admin.signOut(token);
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/forgot-password — send reset email via Resend ── */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    // Generate a Supabase magic-link/recovery link via admin API
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: (process.env.FRONTEND_URL || 'https://triakar.com') + '/account.html?reset=true',
      },
    });

    // Always respond successfully — do not leak whether the email exists
    if (!linkErr && linkData?.properties?.action_link) {
      try {
        await sendPasswordReset({ email, reset_link: linkData.properties.action_link });
      } catch (mailErr) {
        console.error('Password reset email failed:', mailErr.message);
      }
    }

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (err) { next(err); }
});

/* ── GET /api/profile — fetch logged-in user's profile ──── */
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, nickname, email, mobile, phone, gender, date_of_birth, phone_verified, user_code')
      .eq('id', req.user.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: data });
  } catch (err) { next(err); }
});

/* ── PUT /api/profile — update logged-in user's profile ──── */
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { full_name, nickname, gender, date_of_birth, phone, mobile } = req.body;
    const updates = {};
    if (full_name     !== undefined) updates.full_name     = full_name;
    if (nickname      !== undefined) updates.nickname      = nickname;
    if (gender        !== undefined) updates.gender        = gender;
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth;
    // FIX #25: allow phone/mobile update
    if (phone  !== undefined) {
      const digits = String(phone).replace(/\D/g, '');
      const mobile10 = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
      if (mobile10.length === 10) {
        updates.phone  = phone;
        updates.mobile = `+91${mobile10}`;
      }
    }
    if (mobile !== undefined && !phone) updates.mobile = mobile;

    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', req.user.id).select().single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (err) { next(err); }
});

export default router;
