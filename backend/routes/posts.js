import { Router } from 'express';
import { getPosts } from '../controllers/posts.js';

const router = Router();

// Send requests to the controller.
router.get('/', getPosts);

export default router;
