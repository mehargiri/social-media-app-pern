import { LoginUserType } from '@/features/auth/auth.zod.schemas.js';
import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { SUUID } from 'short-uuid';
import {
	loginUserService,
	logoutUserService,
	refreshTokenService,
} from './auth.services.js';
import {
	clearRefreshTokenCookie,
	CONSTANT_NAMES,
	setRefreshTokenCookie,
} from './auth.utils.js';

export interface CookieType {
	[CONSTANT_NAMES.cookieName]?: string;
}

export interface CustomLoginRequest extends Request {
	body: LoginUserType;
	cookies: CookieType;
}

export interface CustomCookieRequest extends Request {
	cookies: CookieType;
}

export interface CustomPayload extends JwtPayload {
	[CONSTANT_NAMES.payloadName]: SUUID;
}

// Login
export const loginUser = async (req: CustomLoginRequest, res: Response) => {
	const { email, password } = req.body;
	const { tk: oldRefreshToken } = req.cookies;

	const { accessToken, refreshToken, shouldClearRefreshTokenCookie } =
		await loginUserService({ email, password, oldRefreshToken });

	if (shouldClearRefreshTokenCookie) {
		clearRefreshTokenCookie(res);
	}

	setRefreshTokenCookie(res, refreshToken);

	return void res.json({ accessToken });
};

// Logout
export const logoutUser = async (req: CustomCookieRequest, res: Response) => {
	const { tk: refreshToken } = req.cookies;

	if (!refreshToken) {
		return void res.sendStatus(204);
	}

	await logoutUserService({ refreshToken });

	clearRefreshTokenCookie(res);
	return void res.sendStatus(204);
};

// Refresh Token
export const refreshToken = async (req: CustomCookieRequest, res: Response) => {
	const { tk: refreshToken } = req.cookies;

	const { accessToken, newRefreshToken } = await refreshTokenService({
		refreshToken,
	});

	clearRefreshTokenCookie(res);

	setRefreshTokenCookie(res, newRefreshToken);

	return void res.json({ accessToken });
};
