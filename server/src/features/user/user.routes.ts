import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import {
	fileFilter,
	fileStorage,
	imageFieldNames,
	maxFileSize,
} from '@/utils/general.utils.js';
import { Router } from 'express';
import multer from 'multer';
import {
	deleteUser,
	getMe,
	getUser,
	getUsersByName,
	registerUser,
	updateUser,
} from './user.controllers.js';
import { insertUserSchema } from './user.zod.schemas.js';

const router = Router();

const upload = multer({
	storage: fileStorage,
	fileFilter: fileFilter,
	limits: { fileSize: maxFileSize },
});

router.get('/', tokenHandler, getUsersByName);
router.get('/me', tokenHandler, getMe);
router.get('/:id', tokenHandler, getUser);
router.post('/register', validateData(insertUserSchema), registerUser);
router.patch(
	'/:id',
	tokenHandler,
	upload.fields(
		imageFieldNames.map((fieldName) => ({ name: fieldName, maxCount: 1 }))
	),
	validateData(insertUserSchema),
	updateUser
);
router.delete('/:id', tokenHandler, deleteUser);

export default router;
