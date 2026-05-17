import { Router } from 'express';
import { startCheckout, handleWebhook } from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Raw body required for Stripe signature verification — registered before express.json() in index.js
router.post('/webhook', handleWebhook);

router.use(requireAuth);
router.post('/checkout', startCheckout);

export default router;
