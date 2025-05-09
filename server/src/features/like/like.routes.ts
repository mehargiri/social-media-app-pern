import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import { Router } from 'express';
import {
	getDetailedLikes,
	likeController,
	unlikeController,
} from './like.controllers.js';
import { createLikeSchema } from './like.zod.schemas.js';

const router = Router();

router.get('/', tokenHandler, getDetailedLikes);
router.post(
	'/',
	[tokenHandler, validateData(createLikeSchema)],
	likeController
);
router.delete('/', tokenHandler, unlikeController);

export default router;
