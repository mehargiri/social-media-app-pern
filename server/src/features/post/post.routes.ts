import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import { fileFilter, fileStorage, maxFileSize } from '@/utils/general.utils.js';
import { Router } from 'express';
import multer from 'multer';
import {
	createPost,
	deletePost,
	getPost,
	getPosts,
	updatePost,
} from './post.controllers.js';
import { createPostSchema } from './post.zod.schemas.js';

const router = Router();

const upload = multer({
	storage: fileStorage,
	fileFilter: fileFilter,
	limits: { fileSize: maxFileSize },
});

router.get('/', tokenHandler, getPosts);
router.get('/:id', tokenHandler, getPost);
router.post(
	'/',
	[tokenHandler, upload.array('assets', 3), validateData(createPostSchema)],
	createPost
);
router.patch(
	'/:id',
	[tokenHandler, upload.array('assets', 3), validateData(createPostSchema)],
	updatePost
);
router.delete('/:id', tokenHandler, deletePost);

export default router;
