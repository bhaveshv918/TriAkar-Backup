import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.get('/',      getCategories);                              // public
router.post('/',     requireAuth, requireAdmin, createCategory);  // admin
router.put('/:id',   requireAuth, requireAdmin, updateCategory);  // admin
router.delete('/:id',requireAuth, requireAdmin, deleteCategory);  // admin

export default router;
