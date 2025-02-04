import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import { Router } from 'express';
import { createWork, deleteWork, updateWork } from './work.controllers.js';
import { createWorkSchema } from './work.zod.schemas.js';

const router = Router();

router.post('/', [tokenHandler, validateData(createWorkSchema)], createWork);
router.patch(
	'/:id',
	[tokenHandler, validateData(createWorkSchema)],
	updateWork
);
router.delete('/:id', tokenHandler, deleteWork);

export default router;
