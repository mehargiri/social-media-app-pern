import {
	loginUser,
	logoutUser,
	refreshToken,
} from '@/controllers/auth.controllers.js';
import validateData from '@/middlewares/validateData.js';
import { loginUserSchema } from '@/zod-schemas/user.js';
import { Router } from 'express';

const router = Router();

router.post('/login', validateData(loginUserSchema), loginUser);
router.post('/logout', logoutUser);
router.post('/refresh', refreshToken);

export default router;
