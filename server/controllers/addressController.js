import supabase from '../db/supabaseClient.js';

/* GET /api/addresses */
export async function getAddresses(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ addresses: data });
  } catch (err) { next(err); }
}

/* GET /api/addresses/default */
export async function getDefaultAddress(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_default', true)
      .maybeSingle();
    if (error) throw error;
    res.json({ address: data });
  } catch (err) { next(err); }
}

/* POST /api/addresses */
export async function createAddress(req, res, next) {
  try {
    // FIX #16: default is_default to false — caller must explicitly opt in to avoid silently overwriting existing default
  const { full_name, phone, address_line1, address_line2, city, state, pincode, country = 'India', is_default = false } = req.body;
    if (!full_name || !phone || !address_line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'full_name, phone, address_line1, city, state, pincode are required' });
    }
    if (is_default) {
      await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', req.user.id);
    }
    const { data, error } = await supabase
      .from('user_addresses')
      .insert({ user_id: req.user.id, full_name, phone, address_line1, address_line2: address_line2 || null, city, state, pincode, country, is_default })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ address: data });
  } catch (err) { next(err); }
}

/* PUT /api/addresses/:id */
export async function updateAddress(req, res, next) {
  try {
    const { full_name, phone, address_line1, address_line2, city, state, pincode, country } = req.body;
    const { data, error } = await supabase
      .from('user_addresses')
      .update({ full_name, phone, address_line1, address_line2, city, state, pincode, country })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)  // ownership check
      .select()
      .single();
    // FIX #15: .single() throws PGRST116 when no row found — catch it as 404, not 500
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Address not found' });
      throw error;
    }
    res.json({ address: data });
  } catch (err) { next(err); }
}

/* DELETE /api/addresses/:id */
export async function deleteAddress(req, res, next) {
  try {
    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/* PUT /api/addresses/:id/default */
export async function setDefault(req, res, next) {
  try {
    await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', req.user.id);
    const { data, error } = await supabase
      .from('user_addresses')
      .update({ is_default: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ address: data });
  } catch (err) { next(err); }
}
