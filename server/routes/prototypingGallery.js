import { Router } from 'express';
import { getPublicGallery, uploadReferenceImage } from '../controllers/prototypingGalleryController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();

/* GET /api/prototyping-gallery — public, active images only */
router.get('/', getPublicGallery);

/* POST /api/prototyping-gallery/upload-reference — public, rate-limited in index.js.
   Lets a shopper attach reference photos before adding a prototyping plan to cart. */
router.post('/upload-reference', upload.single('image'), uploadReferenceImage);

export default router;
