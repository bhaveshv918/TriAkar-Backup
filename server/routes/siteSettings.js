import { Router } from 'express';
import { getPublicSettings } from '../controllers/siteSettingsController.js';

const router = Router();

/* GET /api/site-settings — public, whitelisted presentation values */
router.get('/', getPublicSettings);

export default router;
