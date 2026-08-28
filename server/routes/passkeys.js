/* TriAkar : passkey routes, mounted at /api/auth/passkeys
 *
 * The two /login/* routes are public by necessity: signing in with a passkey is exactly
 * the case where there is no session yet. Everything else needs one. */

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  registerOptions,
  registerVerify,
  loginOptions,
  loginVerify,
  listPasskeys,
  renamePasskey,
  deletePasskey,
} from '../controllers/passkeyController.js';

const router = Router();

router.post('/login/options',    loginOptions);
router.post('/login/verify',     loginVerify);

router.post('/register/options', requireAuth, registerOptions);
router.post('/register/verify',  requireAuth, registerVerify);

router.get('/',                  requireAuth, listPasskeys);
router.patch('/:id',             requireAuth, renamePasskey);
router.delete('/:id',            requireAuth, deletePasskey);

export default router;
