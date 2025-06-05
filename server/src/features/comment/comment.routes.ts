import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import { Router } from 'express';
import {
	createComment,
	deleteComment,
	getComments,
	updateComment,
} from './comment.controllers.js';
import {
	createCommentSchema,
	updateCommentSchema,
} from './comment.zod.schemas.js';

const router = Router();

router.get('/:postId', tokenHandler, getComments);
router.post(
	'/',
	[tokenHandler, validateData(createCommentSchema)],
	createComment
);
router.patch(
	'/:id',
	[tokenHandler, validateData(updateCommentSchema)],
	updateComment
);
router.delete('/:id', tokenHandler, deleteComment);

export default router;
