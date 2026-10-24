import { Router } from 'express';
import { getProfiles, getProfile, getMyProfile, createProfile, updateMyProfile, setFriend, getSocial } from '../controllers/profiles.js';
import { requireAccount } from '../middleware/requireAccount.js';
import { apiHandler, requireId } from '../middleware/apiHandler.js';
import { requireProfile } from '../middleware/requireProfile.js';

const router = Router();

// Send requests to the controller.
router.use(requireAccount);
router.get('/', apiHandler(getProfiles));
router.get('/me', apiHandler(getMyProfile));
router.post('/', apiHandler(createProfile));
router.patch('/me', apiHandler(updateMyProfile));
router.get('/:id', requireId, apiHandler(getProfile));
router.get('/:id/social', requireProfile, requireId, apiHandler(getSocial));
router.put('/:id/follow', requireProfile, requireId, apiHandler(setFriend));
router.delete('/:id/follow', requireProfile, requireId, apiHandler(setFriend));
router.put('/:id/friend', requireProfile, requireId, apiHandler(setFriend));
router.delete('/:id/friend', requireProfile, requireId, apiHandler(setFriend));

export default router;
