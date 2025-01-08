import {
	deleteUser,
	getMe,
	getUser,
	getUsersByName,
	registerUser,
	updateUser,
} from '@/controllers/user.controllers.js';
import tokenHandler from '@/middlewares/tokenHandler.middlewares.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import {
	fileFilter,
	fileStorage,
	imageFieldNames,
	maxFileSize,
} from '@/utils/general.utils.js';
import { registerUserSchema, updateUserSchema } from '@/zod-schemas/user.js';
import { Router } from 'express';
import multer from 'multer';

const router = Router();

const upload = multer({
	storage: fileStorage,
	fileFilter: fileFilter,
	limits: { fieldSize: maxFileSize },
});

router.get('/', tokenHandler, getUsersByName);
router.get('/me', tokenHandler, getMe);
router.get('/:id', tokenHandler, getUser);
router.post('/register', validateData(registerUserSchema), registerUser);
router.patch(
	'/:id',
	tokenHandler,
	upload.fields(
		imageFieldNames.map((fieldName) => ({ name: fieldName, maxCount: 1 }))
	),
	validateData(updateUserSchema),
	updateUser
);
router.delete('/:id', tokenHandler, deleteUser);

export default router;
