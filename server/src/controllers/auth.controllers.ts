import { updateUserById, userTokenExists } from '@/services/user.services.js';
import {
	clearRefreshTokenCookie,
	CONSTANT_NAMES,
	generateTokens,
	setRefreshTokenCookie,
} from '@/utils/auth.utils.js';
import { LoginUserType } from '@/zod-schemas/user.js';
import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { SUUID } from 'short-uuid';
import {
	handleLoginRefreshTokenReuse,
	handleRefreshTokenReuse,
	processOldRefreshTokenForNew,
	validateCredentials,
} from './auth.controllers.helpers.js';

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

	const userToVerify = await validateCredentials(email, password);

	const { accessToken, refreshToken: newRefreshToken } = generateTokens(
		userToVerify.id
	);

	const newRefreshTokenArray = await handleLoginRefreshTokenReuse(
		userToVerify,
		res,
		oldRefreshToken
	);

	await updateUserById({
		id: userToVerify.id,
		refreshToken: [...newRefreshTokenArray, newRefreshToken],
	});

	setRefreshTokenCookie(res, newRefreshToken);
	res.json({ accessToken });
};

// Logout
export const logoutUser = async (req: CustomCookieRequest, res: Response) => {
	const { tk: refreshToken } = req.cookies;
	if (!refreshToken) {
		res.sendStatus(204);
		return;
	}

	const foundUser = await userTokenExists({ refreshToken });

	if (!foundUser) {
		clearRefreshTokenCookie(res);
		res.sendStatus(204);
		return;
	}

	await updateUserById({
		id: foundUser.id,
		refreshToken: foundUser.refreshToken?.filter((rt) => rt !== refreshToken),
	});

	clearRefreshTokenCookie(res);
	res.sendStatus(204);
	return;
};

// Refresh Token
export const refreshToken = async (req: CustomCookieRequest, res: Response) => {
	const { tk: refreshToken } = req.cookies;

	if (!refreshToken) {
		res.sendStatus(401);
		return;
	}

	clearRefreshTokenCookie(res);

	const foundUser = await userTokenExists({ refreshToken });

	if (!foundUser) {
		handleRefreshTokenReuse(refreshToken, res);
		res.sendStatus(403);
		return;
	}

	const newRefreshTokenArray =
		foundUser.refreshToken?.filter((rt) => rt !== refreshToken) ?? [];

	processOldRefreshTokenForNew(
		foundUser,
		refreshToken,
		newRefreshTokenArray,
		res
	);
};
