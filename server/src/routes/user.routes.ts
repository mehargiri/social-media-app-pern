import {
	deleteUser,
	getUser,
	getUsersByName,
	registerUser,
	updateUser,
} from '@/controllers/user.controllers.js';
import validateData from '@/middlewares/validateData.js';
import verifyJWT from '@/middlewares/verifyJWT.js';
import { fileFilter, fileStorage, maxFileSize } from '@/utils/general.utils.js';
import { registerUserSchema, updateUserSchema } from '@/zod-schemas/user.js';
import multer from 'multer';
import router from './auth.routes.js';

const upload = multer({
	storage: fileStorage,
	fileFilter: fileFilter,
	limits: { fieldSize: maxFileSize },
});

router.get('/:id', verifyJWT, getUser);
router.get('/name/:name', verifyJWT, getUsersByName);
router.post('/register', validateData(registerUserSchema), registerUser);
router.patch(
	'/:id',
	verifyJWT,
	upload.fields([
		{ name: 'profileImage', maxCount: 1 },
		{ name: 'coverImage', maxCount: 1 },
	]),
	validateData(updateUserSchema),
	updateUser
);
router.delete('/:id', verifyJWT, deleteUser);

export default router;
