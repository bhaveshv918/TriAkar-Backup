import { Router } from 'express';
import { subscribeNewsletter } from '../controllers/newsletterController.js';

const router = Router();

// Public — no auth required for newsletter signup
router.post('/', subscribeNewsletter);

export default router;
