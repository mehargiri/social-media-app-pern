import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import { Router } from 'express';
import { getReplies } from './comment.controllers.js';

const router = Router();

router.get('/', tokenHandler, getReplies);

export default router;
