import { Router } from 'express';
import { getPosts, getPost, createPost, addComment, likePost, rsvp } from '../controllers/posts.js';
import { requireAccount } from '../middleware/requireAccount.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { apiHandler, requireId } from '../middleware/apiHandler.js';

const router = Router();

// Send requests to the controller.
router.use(requireAccount, requireProfile);
router.get('/', apiHandler(getPosts));
router.post('/', apiHandler(createPost));
router.get('/:id', requireId, apiHandler(getPost));
router.put('/:id/rsvp', requireId, apiHandler(rsvp));
router.delete('/:id/rsvp', requireId, apiHandler(rsvp));
router.post('/:id/comments', requireId, apiHandler(addComment));
router.put('/:id/likes', requireId, apiHandler(likePost));
router.delete('/:id/likes', requireId, apiHandler(likePost));

export default router;
