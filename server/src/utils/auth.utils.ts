import env from '@/env.js';
import { createSecretKey } from 'crypto';
import { Response } from 'express';
import { sign } from 'jsonwebtoken';
import { SUUID } from 'short-uuid';

export const TOKEN_CONFIG = {
	ACCESS_TOKEN_EXPIRY: '1m',
	REFRESH_TOKEN_EXPIRY: '1d',
	ACCESS_TOKEN_SECRET: createSecretKey(Buffer.from(env.ACCESS_TOKEN_SECRET)),
	REFRESH_TOKEN_SECRET: createSecretKey(Buffer.from(env.REFRESH_TOKEN_SECRET)),
} as const;

// Helper functions
export const createAccessToken = (userId: SUUID) => {
	const token = sign({ acc: userId }, TOKEN_CONFIG.ACCESS_TOKEN_SECRET, {
		expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
	});
	return token;
};

export const createRefreshToken = (userId: SUUID) => {
	const token = sign({ acc: userId }, TOKEN_CONFIG.REFRESH_TOKEN_SECRET, {
		expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
	});

	return token;
};

export const generateTokens = (userId: SUUID) => {
	const accessToken = createAccessToken(userId);
	const refreshToken = createRefreshToken(userId);
	return { accessToken, refreshToken };
};

export const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
	res.cookie('tk', refreshToken, {
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env['NODE_ENV'] === 'production',
		maxAge: 24 * 60 * 60 * 1000, // 1 day
	});
};

export const clearRefreshTokenCookie = (res: Response) => {
	res.clearCookie('tk', {
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env['NODE_ENV'] === 'production',
	});
};
