import { Router } from 'express';
import { createOrder, verifyPayment } from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);

router.post('/create-order', createOrder);
router.post('/verify',       verifyPayment);

/* Return public Razorpay key — needed for retry-payment on account page */
router.get('/key', (req, res) => {
  res.json({ key_id: process.env.RAZORPAY_KEY_ID || '' });
});

export default router;
