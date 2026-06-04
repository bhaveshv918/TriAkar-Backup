// One-off script: resend order confirmation email for a given invoice/order ID.
// Usage: node --env-file=.env scripts/resend-confirmation.js TRK-20260603-6808
import { createClient } from '@supabase/supabase-js';
import { sendOrderConfirmation, sendAdminOrderAlert } from '../services/emailService.js';

const orderId = process.argv[2];
if (!orderId) { console.error('Usage: node scripts/resend-confirmation.js <order_id>'); process.exit(1); }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: ord, error } = await supabase
  .from('orders')
  .select('*, order_items(quantity, unit_price, products(name))')
  .or(`invoice_number.eq.${orderId},order_id.eq.${orderId}`)
  .single();

if (error || !ord) { console.error('Order not found:', error?.message); process.exit(1); }

console.log(`Found order: ${ord.invoice_number || ord.order_id} | ${ord.customer_email} | ₹${ord.total_amount}`);

const items = (ord.order_items || []).map(it => ({
  name: it.products?.name || 'Item',
  quantity: it.quantity,
  unit_price: it.unit_price,
}));

// Fall back to items JSONB if order_items join is empty (WhatsApp orders)
const emailItems = items.length ? items : (ord.items || []).map(it => ({
  name: it.name || 'Item',
  quantity: it.quantity,
  unit_price: it.price || it.unit_price || 0,
}));

const orderData = {
  order_id:        ord.invoice_number || ord.order_id || ord.id,
  customer_name:   ord.customer_name  || ord.shipping_address?.full_name || 'Customer',
  customer_email:  ord.customer_email,
  customer_phone:  ord.customer_phone || ord.shipping_address?.mobile || ord.shipping_address?.phone || '',
  total_amount:    ord.total_amount,
  subtotal:        ord.subtotal,
  shipping_charge: ord.shipping_charge,
  discount_amount: ord.discount_amount || 0,
  promo_code:      ord.promo_code     || null,
  payment_method:  ord.payment_method || 'online',
  is_gift:         ord.is_gift        || false,
  gift_message:    ord.gift_message   || null,
  items:           emailItems,
  shipping_address: ord.shipping_address || {},
};

if (orderData.customer_email) {
  await sendOrderConfirmation(orderData);
  console.log(`✓ Confirmation sent to ${orderData.customer_email}`);
} else {
  console.warn('No customer email on record — skipping customer email.');
}

await sendAdminOrderAlert(orderData);
console.log('✓ Admin alert sent.');
