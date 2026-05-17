import Razorpay from 'razorpay';
import crypto from 'crypto';
import supabase from '../db/supabaseClient.js';

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payments/create-order
// Resolves cart slugs → product UUIDs, creates DB order + Razorpay order in one call.
export async function createOrder(req, res, next) {
  try {
    const { items, shipping_address = {} } = req.body;
    const user_id = req.user.id;

    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

    const slugs = items.map(i => i.slug);
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, slug, price, stock_qty, images')
      .in('slug', slugs)
      .eq('is_active', true);

    if (productError) throw productError;

    let total_amount = 0;
    for (const item of items) {
      const product = products.find(p => p.slug === item.slug);
      if (!product) return res.status(400).json({ error: `Product "${item.slug}" not found` });
      if (product.stock_qty < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
      }
      total_amount += product.price * item.quantity;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ user_id, status: 'pending', total_amount, shipping_address })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map(item => {
      const product = products.find(p => p.slug === item.slug);
      return {
        order_id:             order.id,
        product_id:           product.id,
        quantity:             item.quantity,
        unit_price:           product.price,
        customization_notes:  item.customization_notes || null,
      };
    });

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    // Create Razorpay order — amount must be in paise (₹1 = 100 paise)
    const rzpOrder = await razorpay.orders.create({
      amount:   Math.round(total_amount * 100),
      currency: 'INR',
      receipt:  order.id,
      notes:    { order_id: order.id },
    });

    await supabase.from('orders')
      .update({ stripe_payment_intent_id: rzpOrder.id })
      .eq('id', order.id);

    res.json({
      razorpay_order_id: rzpOrder.id,
      amount:            rzpOrder.amount,
      currency:          rzpOrder.currency,
      order_id:          order.id,
      key_id:            process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/verify
// Verifies Razorpay HMAC signature, confirms order, decrements stock.
export async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed — signature mismatch' });
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order_id);

    await supabase.from('orders')
      .update({ status: 'confirmed', stripe_payment_intent_id: razorpay_payment_id })
      .eq('id', order_id);

    for (const item of orderItems ?? []) {
      await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_qty:        item.quantity,
      });
    }

    res.json({ ok: true, order_id });
  } catch (err) {
    next(err);
  }
}
