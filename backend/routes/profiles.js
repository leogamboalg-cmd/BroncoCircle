import { Router } from 'express';
import { getProfiles, getMyProfile, createProfile, updateMyProfile } from '../controllers/profiles.js';
import { requireAccount } from '../middleware/requireAccount.js';
import { apiHandler } from '../middleware/apiHandler.js';

const router = Router();

// Send requests to the controller.
router.use(requireAccount);
router.get('/', apiHandler(getProfiles));
router.get('/me', apiHandler(getMyProfile));
router.post('/', apiHandler(createProfile));
router.patch('/me', apiHandler(updateMyProfile));

export default router;
