import supabase from '../db/supabaseClient.js';

export async function createInquiry(req, res, next) {
  try {
    const { contact_name, email, phone, product_interest, message, company_name } = req.body;

    if (!contact_name || !email || !message) {
      return res.status(400).json({ error: 'contact_name, email, and message are required' });
    }

    const { error } = await supabase.from('corporate_inquiries').insert({
      company_name: company_name || null,
      contact_name,
      email,
      phone: phone || null,
      product_interest: product_interest || null,
      message,
    });

    if (error) throw error;
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
