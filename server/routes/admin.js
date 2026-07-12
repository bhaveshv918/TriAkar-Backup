import { Router } from 'express';
import {
  getAdminProducts, createProduct, updateProduct, deleteProduct, bulkUpdateProducts,
  getAdminOrders, updateOrderStatus, updateOrderPayment, updateOrderFields, sendOrderEmail, getActivity,
} from '../controllers/adminController.js';
import {
  listUsers, getUser, updateUser, setUserDisabled, setUserRole,
  softDeleteUser, exportUsersCsv,
} from '../controllers/adminUserController.js';
import {
  listRecycleBin, restoreItem, purgeItem,
} from '../controllers/adminRecycleController.js';
import { generateListing } from '../controllers/listingController.js';
import { getGa4Overview } from '../controllers/ga4Controller.js';
import {
  listCustomFields, createCustomField, updateCustomField, deleteCustomField,
  generateProductPrompts, getProductPromptHistory,
} from '../controllers/productStudioController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { upload, compressImage, uploadGstFiles } from '../middleware/uploadMiddleware.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import {
  calculateGst, saveGstCalc, getGstHistory, getGstPeriodDetail, exportGstCsv, markGstFiled,
  unmarkGstFiled, deleteGstPeriod,
} from '../controllers/gstController.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/products',          getAdminProducts);
router.post('/products',         createProduct);
router.post('/products/bulk',    bulkUpdateProducts);   // Module 8 — bulk ops
router.put('/products/:id',      updateProduct);
router.delete('/products/:id',   deleteProduct);

router.post('/generate-listing', generateListing);
router.get('/ga4',               getGa4Overview);   // A14 — GA4 traffic analytics

// ── Product Studio: dynamic custom fields + AI image-prompt generator ──
router.get('/custom-fields',              listCustomFields);
router.post('/custom-fields',             createCustomField);
router.put('/custom-fields/:id',          updateCustomField);
router.delete('/custom-fields/:id',       deleteCustomField);
router.post('/products/:id/generate-prompts',  generateProductPrompts);
router.get('/products/:id/prompt-history',     getProductPromptHistory);

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
router.put('/orders/:id',              updateOrderFields);   // tracking + admin notes
router.post('/orders/:id/send-email',  sendOrderEmail);

// ── Users (Module 2) — service-role, RLS-bypass. NOTE: export.csv before :id ──
router.get('/users/export.csv',     exportUsersCsv);
router.get('/users',                listUsers);
router.get('/users/:id',            getUser);
router.put('/users/:id',            updateUser);
router.put('/users/:id/role',       setUserRole);
router.post('/users/:id/disable',   setUserDisabled(true));
router.post('/users/:id/enable',    setUserDisabled(false));
router.delete('/users/:id',         softDeleteUser);

// ── Activity log (Module 7) ──
router.get('/activity',             getActivity);

// ── Recycle Bin (Module 1) — products / users / reviews ──
router.get('/recycle-bin',          listRecycleBin);
router.post('/recycle-bin/restore', restoreItem);
router.post('/recycle-bin/purge',   purgeItem);

// ── GST Filing Automation, GSTR-1 reconciliation engine ──
router.post('/gst/calculate', uploadGstFiles.fields([
  { name: 'amazonB2b', maxCount: 1 }, { name: 'amazonB2c', maxCount: 1 }, { name: 'flipkart', maxCount: 1 },
]), calculateGst);
router.post('/gst/save',                    saveGstCalc);
router.get('/gst/history',                  getGstHistory);
router.get('/gst/:periodId',                getGstPeriodDetail);
router.get('/gst/:periodId/export/:table',  exportGstCsv);
router.post('/gst/:periodId/mark-filed',    markGstFiled);
router.post('/gst/:periodId/unmark-filed',  unmarkGstFiled);
router.delete('/gst/:periodId',             deleteGstPeriod);

export default router;
