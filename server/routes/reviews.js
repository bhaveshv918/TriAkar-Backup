import { Router } from 'express';
import multer  from 'multer';
import { requireAuth }  from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getReviews,
  getAllReviews,
  createReview,
  createReviewAdmin,
  updateReview,
  patchStatus,
  deleteReview,
} from '../controllers/reviewController.js';

const router = Router();

/* Multer — memory storage, max 5 MB per file, max 3 images */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/* ── PUBLIC ─────────────────────────────────────────────── */
// NOTE: GET / (admin) is defined AFTER GET /:slug to avoid catch-all conflict.
// Express matches exact '' path for GET / so there is no conflict.

/* GET /api/reviews/:slug — approved reviews for a product */
router.get('/:slug', getReviews);

/* ── AUTHENTICATED ──────────────────────────────────────── */
/* POST /api/reviews/ — submit a review (up to 3 images) */
router.post('/', requireAuth, upload.array('images', 3), createReview);

/* ── ADMIN ──────────────────────────────────────────────── */
/* POST   /api/reviews/admin     — create a review by hand (service-role, RLS-safe) */
router.post('/admin', requireAuth, requireAdmin, createReviewAdmin);
/* GET    /api/reviews/          — all reviews */
router.get('/', requireAuth, requireAdmin, getAllReviews);
/* PUT    /api/reviews/:id       — full edit */
router.put('/:id', requireAuth, requireAdmin, updateReview);
/* PATCH  /api/reviews/:id/status — quick status change */
router.patch('/:id/status', requireAuth, requireAdmin, patchStatus);
/* DELETE /api/reviews/:id       — delete */
router.delete('/:id', requireAuth, requireAdmin, deleteReview);

export default router;
