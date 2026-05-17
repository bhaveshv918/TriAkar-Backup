import { Router } from 'express';
import supabase from '../db/supabaseClient.js';

const router = Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'email, password, and full_name are required' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone || null },
    });
    if (error) return res.status(400).json({ error: error.message });

    // Ensure profile row exists (trigger should handle this, but belt-and-suspenders)
    await supabase.from('profiles').upsert(
      { id: data.user.id, full_name, phone: phone || null },
      { onConflict: 'id' },
    );

    res.status(201).json({ message: 'Account created successfully.', user_id: data.user.id });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    res.json({ access_token: data.session.access_token, user: data.user });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) await supabase.auth.admin.signOut(token);
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

export default router;
