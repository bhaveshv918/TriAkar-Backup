import { Router } from 'express';
import { createInquiry } from '../controllers/inquiryController.js';

const router = Router();

// Public — no auth required for inquiry submissions
router.post('/', createInquiry);

export default router;
