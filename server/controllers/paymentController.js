import Stripe from 'stripe';
import supabase from '../db/supabaseClient.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/payments/checkout
// Resolves cart slugs → product UUIDs, creates order + Stripe Checkout Session in one call.
export async function startCheckout(req, res, next) {
  try {
    const { items, shipping_address = {} } = req.body;
    const user_id = req.user.id;

    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

    // Resolve product slugs to full product records
    const slugs = items.map(i => i.slug);
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, slug, price, stock_qty, images')
      .in('slug', slugs)
      .eq('is_active', true);

    if (productError) throw productError;

    // Validate stock and compute total
    let total_amount = 0;
    for (const item of items) {
      const product = products.find(p => p.slug === item.slug);
      if (!product) return res.status(400).json({ error: `Product "${item.slug}" not found` });
      if (product.stock_qty < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
      }
      total_amount += product.price * item.quantity;
    }

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ user_id, status: 'pending', total_amount, shipping_address })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = items.map(item => {
      const product = products.find(p => p.slug === item.slug);
      return {
        order_id: order.id,
        product_id: product.id,
        quantity: item.quantity,
        unit_price: product.price,
        customization_notes: item.customization_notes || null,
      };
    });

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    // Build Stripe line items
    const line_items = items.map(item => {
      const product = products.find(p => p.slug === item.slug);
      return {
        price_data: {
          currency: 'inr',
          product_data: {
            name: product.name,
            ...(product.images?.length ? { images: [product.images[0]] } : {}),
          },
          unit_amount: Math.round(product.price * 100), // paise
        },
        quantity: item.quantity,
      };
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      metadata: { order_id: order.id },
      success_url: `${process.env.FRONTEND_URL}/order-confirmation.html?order_id=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/products.html`,
      billing_address_collection: 'auto',
    });

    // Store session ID against order for reconciliation
    await supabase.from('orders')
      .update({ stripe_payment_intent_id: session.id })
      .eq('id', order.id);

    res.json({ url: session.url, order_id: order.id });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/webhook
// Handles Stripe Checkout Session completion and payment failure events.
export async function handleWebhook(req, res, next) {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const { order_id } = event.data.object.metadata;

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', order_id);

      await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order_id);

      for (const item of orderItems ?? []) {
        await supabase.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        });
      }
    }

    if (event.type === 'checkout.session.expired') {
      const { order_id } = event.data.object.metadata ?? {};
      if (order_id) {
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order_id);
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}
