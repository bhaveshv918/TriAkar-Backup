import { Router } from 'express';
import express from 'express';
import { razorpayWebhook } from '../controllers/webhookController.js';

const router = Router();

/* Raw body parser is applied at the route level so HMAC signature
   verification can hash the exact bytes Razorpay signed. This router
   MUST be mounted before the global express.json() in index.js. */
router.post('/razorpay', express.raw({ type: 'application/json' }), razorpayWebhook);

export default router;
