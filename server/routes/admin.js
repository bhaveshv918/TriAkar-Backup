import { Router } from 'express';
import {
  getAdminProducts, createProduct, updateProduct, deleteProduct,
  getAdminOrders, updateOrderStatus,
} from '../controllers/adminController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/products',          getAdminProducts);
router.post('/products',         createProduct);
router.put('/products/:id',      updateProduct);
router.delete('/products/:id',   deleteProduct);

router.get('/orders',            getAdminOrders);
router.put('/orders/:id/status', updateOrderStatus);

export default router;
