import { Router } from 'express';
import {
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
} from '../controllers/productController.js';

const router = Router();

router.get('/', getAllProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:slug', getProductBySlug);

export default router;
