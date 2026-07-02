import { Router } from 'express';
import {
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
  upsertProduct,
} from '../controllers/productController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.get('/', getAllProducts);
router.get('/category/:category', getProductsByCategory);
router.post('/upsert', requireAuth, requireAdmin, upsertProduct);
router.get('/:slug', getProductBySlug);

export default router;
