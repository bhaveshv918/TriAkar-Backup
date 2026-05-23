import { Router } from 'express';
import {
  validatePromo,
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from '../controllers/promoController.js';
import { requireAuth }  from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// Validate a code at checkout — no auth needed (read-only, no user data exposed)
router.post('/validate', validatePromo);

// Admin-only CRUD
router.get('/',       requireAuth, requireAdmin, getPromoCodes);
router.post('/',      requireAuth, requireAdmin, createPromoCode);
router.put('/:id',    requireAuth, requireAdmin, updatePromoCode);
router.delete('/:id', requireAuth, requireAdmin, deletePromoCode);

export default router;
