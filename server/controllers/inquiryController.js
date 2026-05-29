import supabase from '../db/supabaseClient.js';
import {
  sendCorporateInquiryAlert,
  sendCorporateInquiryConfirmation,
} from '../services/emailService.js';

export async function createInquiry(req, res, next) {
  try {
    const { contact_name, email, phone, product_interest, message, company_name } = req.body;

    if (!contact_name || !email || !message) {
      return res.status(400).json({ error: 'contact_name, email, and message are required' });
    }

    const inquiry = {
      company_name: company_name || null,
      contact_name,
      email,
      phone: phone || null,
      product_interest: product_interest || null,
      message,
    };

    const { error } = await supabase.from('corporate_inquiries').insert(inquiry);

    if (error) throw error;

    // Email notifications — best-effort, must never break the response
    try {
      await sendCorporateInquiryAlert(inquiry);
      if (inquiry.email) await sendCorporateInquiryConfirmation(inquiry);
    } catch (mailErr) {
      console.error('Corporate inquiry email error:', mailErr.message);
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
