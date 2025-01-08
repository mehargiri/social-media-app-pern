import env from '@/env.js';
import { createSecretKey } from 'crypto';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { SUUID } from 'short-uuid';

export const TOKEN_CONFIG = {
	ACCESS_TOKEN_EXPIRY: '1m',
	REFRESH_TOKEN_EXPIRY: '1d',
	ACCESS_TOKEN_SECRET: createSecretKey(Buffer.from(env.ACCESS_TOKEN_SECRET)),
	REFRESH_TOKEN_SECRET: createSecretKey(Buffer.from(env.REFRESH_TOKEN_SECRET)),
} as const;

export const CONSTANT_NAMES = {
	cookieName: 'tk',
	payloadName: 'acc',
} as const;

// Helper functions
export const createAccessToken = (userId: SUUID) => {
	const token = jwt.sign(
		{ [CONSTANT_NAMES.payloadName]: userId },
		TOKEN_CONFIG.ACCESS_TOKEN_SECRET,
		{
			expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
		}
	);
	return token;
};

export const createRefreshToken = (userId: SUUID) => {
	const token = jwt.sign(
		{ [CONSTANT_NAMES.payloadName]: userId },
		TOKEN_CONFIG.REFRESH_TOKEN_SECRET,
		{
			expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
		}
	);

	return token;
};

export const generateTokens = (userId: SUUID) => {
	const accessToken = createAccessToken(userId);
	const refreshToken = createRefreshToken(userId);
	return { accessToken, refreshToken };
};

export const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
	res.cookie(CONSTANT_NAMES.cookieName, refreshToken, {
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env['NODE_ENV'] === 'production',
		maxAge: 24 * 60 * 60 * 1000, // 1 day
	});
};

export const clearRefreshTokenCookie = (res: Response) => {
	res.clearCookie(CONSTANT_NAMES.cookieName, {
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env['NODE_ENV'] === 'production',
	});
};
