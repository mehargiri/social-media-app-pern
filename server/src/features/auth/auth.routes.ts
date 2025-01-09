import { loginUserSchema } from '@/features/auth/auth.zod.schemas.js';
import validateData from '@/middlewares/validateData.middlewares.js';
import { Router } from 'express';
import { loginUser, logoutUser, refreshToken } from './auth.controllers.js';

const router = Router();

router.post('/login', validateData(loginUserSchema), loginUser);
router.post('/logout', logoutUser);
router.post('/refresh', refreshToken);

export default router;
