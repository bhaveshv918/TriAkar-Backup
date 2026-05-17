import { Router } from 'express';
import { createOrder, getOrdersByUser, getOrderById } from '../controllers/orderController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.post('/', createOrder);
router.get('/', getOrdersByUser);
router.get('/:id', getOrderById);

export default router;
