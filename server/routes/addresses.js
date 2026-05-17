import { Router } from 'express';
import supabase from '../db/supabaseClient.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);

router.get('/default', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_default', true)
      .maybeSingle();
    if (error) throw error;
    res.json({ address: data });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { full_name, phone, address_line1, address_line2, city, state, pincode, country = 'India' } = req.body;
    if (!full_name || !phone || !address_line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'full_name, phone, address_line1, city, state, pincode are required' });
    }
    await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', req.user.id);
    const { data, error } = await supabase
      .from('user_addresses')
      .insert({ user_id: req.user.id, full_name, phone, address_line1, address_line2: address_line2 || null, city, state, pincode, country, is_default: true })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ address: data });
  } catch (err) {
    next(err);
  }
});

export default router;
