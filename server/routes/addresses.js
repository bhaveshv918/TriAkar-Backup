import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getAddresses, getDefaultAddress, createAddress,
  updateAddress, deleteAddress, setDefault,
} from '../controllers/addressController.js';

const router = Router();
router.use(requireAuth);

router.get('/',                getAddresses);
router.get('/default',         getDefaultAddress);
router.post('/',               createAddress);
router.put('/:id',             updateAddress);
router.delete('/:id',          deleteAddress);
router.put('/:id/default',     setDefault);

export default router;
