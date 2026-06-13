import { Router } from 'express';
import {
  getAdminProducts, createProduct, updateProduct, deleteProduct,
  getAdminOrders, updateOrderStatus, updateOrderPayment, sendOrderEmail,
} from '../controllers/adminController.js';
import { generateListing } from '../controllers/listingController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { upload, compressImage } from '../middleware/uploadMiddleware.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/products',          getAdminProducts);
router.post('/products',         createProduct);
router.put('/products/:id',      updateProduct);
router.delete('/products/:id',   deleteProduct);

router.post('/generate-listing', generateListing);

// Image upload — receives file, compresses it, stores in Cloudinary, returns URL.
// Replaces direct Supabase Storage uploads from the admin panel.
router.post('/upload-image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const compressed = await compressImage(req.file.buffer);
    const result = await uploadBufferToCloudinary(compressed, {
      folder:       'triakar/products',
      fetch_format: 'auto',
      quality:      'auto',
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    next(err);
  }
});

router.get('/orders',                  getAdminOrders);
router.put('/orders/:id/status',       updateOrderStatus);
router.put('/orders/:id/payment',      updateOrderPayment);
router.post('/orders/:id/send-email',  sendOrderEmail);

export default router;
