import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import { Router } from 'express';
import {
	createCollege,
	deleteCollege,
	updateCollege,
} from './college.controllers.js';
import { createCollegeSchema } from './college.zod.schemas.js';

const router = Router();

router.post(
	'/',
	[tokenHandler, validateData(createCollegeSchema)],
	createCollege
);

router.patch(
	'/:id',
	[tokenHandler, validateData(createCollegeSchema)],
	updateCollege
);

router.delete('/:id', tokenHandler, deleteCollege);

export default router;
