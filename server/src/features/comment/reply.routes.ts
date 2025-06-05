import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import { Router } from 'express';
import { getReplies } from './comment.controllers.js';

const router = Router();

router.get('/:parentCommentId', tokenHandler, getReplies);

export default router;
