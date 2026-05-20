import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL  = 'TriAkar <hello@triakar.com>';
const ADMIN_EMAIL = 'hello@triakar.com';
const ADMIN_LINK  = 'https://triakar.com/admin.html';
const ACCENT      = '#C4622A';

/* ── helpers ──────────────────────────────────────────────── */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inr(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return esc(amount);
  return '₹' + n.toLocaleString('en-IN');
}

function formatAddress(addr = {}) {
  const parts = [
    addr.full_name,
    addr.address_line1,
    addr.address_line2,
    [addr.city, addr.state].filter(Boolean).join(', '),
    addr.pincode,
    addr.country,
  ].filter(Boolean);
  return parts.map(esc).join('<br>');
}

/* Branded shell — dark premium minimal */
function shell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0e;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="background:#0e0e0e;padding:28px 32px;border-bottom:3px solid ${ACCENT};">
            <span style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:3px;">TRI<span style="color:${ACCENT};">AKAR</span></span>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 20px;font-size:20px;color:#0e0e0e;font-weight:600;">${esc(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;color:#888;font-size:12px;line-height:1.6;border-top:1px solid #eee;">
            TriAkar &middot; <a href="https://triakar.com" style="color:${ACCENT};text-decoration:none;">triakar.com</a><br>
            This is an automated message from TriAkar.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label, href) {
  return `<a href="${esc(href)}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${esc(label)}</a>`;
}

function row(label, value) {
  if (value === null || value === undefined || value === '') return '';
  return `<tr>
    <td style="padding:8px 12px 8px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${esc(label)}</td>
    <td style="padding:8px 0;color:#1a1a1a;font-size:14px;">${esc(value)}</td>
  </tr>`;
}

function itemsTable(items = []) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#1a1a1a;">${esc(it.name || 'Item')}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#666;text-align:center;">${esc(it.quantity)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#1a1a1a;text-align:right;">${inr(it.unit_price)}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr>
      <td style="padding:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #0e0e0e;">Item</td>
      <td style="padding:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;text-align:center;border-bottom:2px solid #0e0e0e;">Qty</td>
      <td style="padding:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;text-align:right;border-bottom:2px solid #0e0e0e;">Price</td>
    </tr>
    ${rows}
  </table>`;
}

function itemsList(items = []) {
  return items.map(it =>
    `<li style="margin:4px 0;color:#1a1a1a;font-size:14px;">${esc(it.name || 'Item')} &times; ${esc(it.quantity)} — ${inr(it.unit_price)}</li>`
  ).join('');
}

async function send({ to, subject, html }) {
  const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  if (error) throw new Error(error.message || 'Resend send failed');
  return data;
}

/* ── ORDER CONFIRMATION (to customer) ─────────────────────── */
export async function sendOrderConfirmation(order) {
  const body = `
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px;">
      Thank you for your order. We have received your payment and your TriAkar pieces are now in our hands.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${row('Order ID', order.order_id)}
    </table>
    ${itemsTable(order.items)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr>
        <td style="font-size:15px;font-weight:600;color:#0e0e0e;">Total</td>
        <td style="font-size:18px;font-weight:700;color:${ACCENT};text-align:right;">${inr(order.total_amount)}</td>
      </tr>
    </table>
    <h2 style="font-size:14px;color:#0e0e0e;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Shipping To</h2>
    <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 24px;">${formatAddress(order.shipping_address)}</p>
    ${btn('View Your Account', 'https://triakar.com/account.html')}
  `;
  return send({
    to: order.customer_email,
    subject: `Order Confirmed: ${order.order_id} — TriAkar`,
    html: shell('Your order is confirmed', body),
  });
}

/* ── ADMIN ORDER ALERT ────────────────────────────────────── */
export async function sendAdminOrderAlert(order) {
  const body = `
    <p style="font-size:15px;color:#444;margin:0 0 20px;">A new order has been placed and paid.</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${row('Order ID', order.order_id)}
      ${row('Customer', order.customer_name)}
      ${row('Phone', order.customer_phone)}
      ${row('Email', order.customer_email)}
      ${row('Payment', order.payment_method)}
      ${row('Total', inr(order.total_amount))}
    </table>
    <h2 style="font-size:14px;color:#0e0e0e;margin:24px 0 8px;text-transform:uppercase;letter-spacing:1px;">Items</h2>
    <ul style="margin:0 0 20px;padding-left:18px;">${itemsList(order.items)}</ul>
    <h2 style="font-size:14px;color:#0e0e0e;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Ship To</h2>
    <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 24px;">${formatAddress(order.shipping_address)}</p>
    ${btn('Open Admin Panel', ADMIN_LINK)}
  `;
  return send({
    to: ADMIN_EMAIL,
    subject: `New Order: ${order.order_id} — ${inr(order.total_amount)}`,
    html: shell('New order received', body),
  });
}

/* ── ENQUIRY CONFIRMATION (to customer) ───────────────────── */
export async function sendEnquiryConfirmation(enquiry) {
  const body = `
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px;">
      Thank you for reaching out to TriAkar. We have received your custom enquiry and our team will get back to you shortly.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${row('Reference ID', enquiry.reference_id)}
      ${row('What you need', enquiry.what_needed)}
    </table>
    <p style="font-size:14px;color:#444;line-height:1.6;margin:24px 0 16px;">
      Need to speak with us sooner? Call our team and quote your reference ID.
    </p>
    ${btn('Call +91 92175 55833', 'tel:+919217555833')}
  `;
  return send({
    to: enquiry.email,
    subject: `Enquiry Received: ${enquiry.reference_id} — TriAkar`,
    html: shell('We received your enquiry', body),
  });
}

/* ── ADMIN ENQUIRY ALERT ──────────────────────────────────── */
export async function sendAdminEnquiryAlert(enquiry) {
  const body = `
    <p style="font-size:15px;color:#444;margin:0 0 20px;">A new custom enquiry has been submitted.</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${row('Reference ID', enquiry.reference_id)}
      ${row('Name', enquiry.name)}
      ${row('Phone', enquiry.phone)}
      ${row('Email', enquiry.email)}
      ${row('What needed', enquiry.what_needed)}
      ${row('Budget', enquiry.budget_range)}
      ${row('Material', enquiry.material_preference)}
    </table>
    <div style="margin-top:24px;">${btn('Open Admin Panel', ADMIN_LINK)}</div>
  `;
  return send({
    to: ADMIN_EMAIL,
    subject: `New Custom Enquiry: ${enquiry.reference_id}`,
    html: shell('New custom enquiry', body),
  });
}

/* ── CONTACT ALERT (to admin) ─────────────────────────────── */
export async function sendContactAlert(submission) {
  const body = `
    <p style="font-size:15px;color:#444;margin:0 0 20px;">A new message was submitted via the contact form.</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${row('Name', submission.name)}
      ${row('Email', submission.email)}
      ${row('Phone', submission.phone)}
      ${row('Subject', submission.subject)}
    </table>
    <h2 style="font-size:14px;color:#0e0e0e;margin:24px 0 8px;text-transform:uppercase;letter-spacing:1px;">Message</h2>
    <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 24px;white-space:pre-wrap;">${esc(submission.message)}</p>
    ${btn('Open Admin Panel', ADMIN_LINK)}
  `;
  return send({
    to: ADMIN_EMAIL,
    subject: `New Message: ${submission.subject} — ${submission.name}`,
    html: shell('New contact message', body),
  });
}

/* ── CALLBACK ALERT (to admin) ────────────────────────────── */
export async function sendCallbackAlert(cb) {
  const body = `
    <p style="font-size:15px;color:#444;margin:0 0 20px;">A new callback request has been submitted.</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${row('Reference ID', cb.reference_id)}
      ${row('Name', cb.name)}
      ${row('Phone', cb.phone)}
      ${row('Topic', cb.topic)}
      ${row('Preferred time', cb.preferred_time)}
    </table>
    <div style="margin-top:24px;">${btn('Open Admin Panel', ADMIN_LINK)}</div>
  `;
  return send({
    to: ADMIN_EMAIL,
    subject: `New Callback Request: ${cb.reference_id}`,
    html: shell('New callback request', body),
  });
}
