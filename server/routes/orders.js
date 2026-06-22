import { Router } from 'express';
import { createOrder, getOrdersByUser, getOrderById, createWhatsAppOrder } from '../controllers/orderController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import supabase from '../db/supabaseClient.js';

const router = Router();

router.use(requireAuth);

router.post('/whatsapp', createWhatsAppOrder);  // save WA order — must be before /:id
router.post('/', createOrder);
router.get('/', getOrdersByUser);

/* Check if the authenticated user has purchased a given product slug */
router.get('/check-purchase', async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const { data: prod } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!prod) return res.json({ purchased: false });

    const { data: items } = await supabase
      .from('order_items')
      .select('id, orders!inner(user_id, status)')
      .eq('product_id', prod.id)
      .eq('orders.user_id', req.user.id);

    res.json({ purchased: !!(items && items.length > 0) });
  } catch (e) {
    console.error('check-purchase:', e);
    res.status(500).json({ error: 'Could not check purchase' });
  }
});

router.get('/:id', getOrderById);

export default router;
