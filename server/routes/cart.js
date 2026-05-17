import { Router } from 'express';
import { getCart, saveCart } from '../controllers/cartController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', getCart);
router.put('/', saveCart);

export default router;
