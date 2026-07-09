import { Router } from 'express';
import { requireAuth }  from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getPublicStories,
  getAllStories,
  createStory,
  updateStory,
  deleteStory,
} from '../controllers/storyController.js';

const router = Router();

/* ── PUBLIC ─────────────────────────────────────────────── */
/* GET /api/stories/public/all — every published story (storefront stories.html) */
router.get('/public/all', getPublicStories);

/* ── ADMIN ──────────────────────────────────────────────── */
/* GET    /api/stories/     — every story, published or not */
router.get('/', requireAuth, requireAdmin, getAllStories);
/* POST   /api/stories/     — create */
router.post('/', requireAuth, requireAdmin, createStory);
/* PUT    /api/stories/:id  — full edit */
router.put('/:id', requireAuth, requireAdmin, updateStory);
/* DELETE /api/stories/:id  — delete */
router.delete('/:id', requireAuth, requireAdmin, deleteStory);

export default router;
