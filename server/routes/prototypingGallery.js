import { Router } from 'express';
import { getPublicGallery } from '../controllers/prototypingGalleryController.js';

const router = Router();

/* GET /api/prototyping-gallery — public, active images only */
router.get('/', getPublicGallery);

export default router;
