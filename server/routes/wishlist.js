import { Router } from 'express';
import { getWishlist, addWishlist, removeWishlist } from '../controllers/wishlistController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', getWishlist);
router.post('/', addWishlist);
router.delete('/:slug', removeWishlist);

export default router;
