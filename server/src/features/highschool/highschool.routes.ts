import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import { Router } from 'express';
import {
	createHighschool,
	deleteHighschool,
	updateHighschool,
} from './highschool.controllers.js';
import { createHighschoolSchema } from './highschool.zod.schemas.js';

const router = Router();

router.post(
	'/',
	[tokenHandler, validateData(createHighschoolSchema)],
	createHighschool
);

router.patch(
	'/:id',
	[tokenHandler, validateData(createHighschoolSchema)],
	updateHighschool
);

router.delete('/:id', tokenHandler, deleteHighschool);

export default router;
