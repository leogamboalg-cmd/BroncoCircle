import { Router } from 'express';
import { getProfiles } from '../controllers/profiles.js';

const router = Router();

// Send requests to the controller.
router.get('/', getProfiles);

export default router;
