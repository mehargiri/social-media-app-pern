/* eslint-disable @typescript-eslint/no-misused-promises */
import {
	clearRefreshTokenCookie,
	generateTokens,
	setRefreshTokenCookie,
	TOKEN_CONFIG,
} from '@/features/auth/auth.utils.js';
import {
	getUserDataForLogin,
	updateUserById,
	userExists,
	userTokenExists,
} from '@/features/user/user.services.js';
import { verify } from 'argon2';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { CustomPayload } from './auth.controllers.js';

// Login Helper functions
export const validateCredentials = async (email: string, password: string) => {
	const user = await getUserDataForLogin({ email });
	if (!user || !(await verify(user.password, password))) {
		throw Error('Invalid Credentials', { cause: 401 });
	}
	return user;
};

export const handleLoginRefreshTokenReuse = async (
	user: NonNullable<Awaited<ReturnType<typeof getUserDataForLogin>>>,
	res: Response,
	oldRefreshToken?: string
) => {
	let refreshTokenArray = !oldRefreshToken
		? user.refreshToken ?? []
		: user.refreshToken?.filter((rt) => rt !== oldRefreshToken) ?? [];

	if (oldRefreshToken) {
		const foundToken = await userTokenExists({ refreshToken: oldRefreshToken });

		if (!foundToken) {
			console.info('Attempted refresh token reuse at login!');
			refreshTokenArray = [];
		}
		clearRefreshTokenCookie(res);
	}
	return refreshTokenArray;
};

// Refresh Token Helper functions
export const handleRefreshTokenReuse = (
	refreshToken: string,
	res: Response
) => {
	jwt.verify(
		refreshToken,
		TOKEN_CONFIG.REFRESH_TOKEN_SECRET,
		async (err, decoded) => {
			if (err) {
				return void res.sendStatus(403);
			}

			console.info('Attempted refresh token reuse!');

			const hackedUser = await userExists({
				id: (decoded as CustomPayload).acc,
			});

			if (hackedUser) {
				await updateUserById({
					id: hackedUser.id,
					refreshToken: [],
				});
			}
		}
	);
};

export const processOldRefreshTokenForNew = (
	user: NonNullable<Awaited<ReturnType<typeof userTokenExists>>>,
	refreshToken: string,
	refreshTokenArray: string[],
	res: Response
) => {
	jwt.verify(
		refreshToken,
		TOKEN_CONFIG.REFRESH_TOKEN_SECRET,
		async (err, decoded) => {
			if (err) {
				console.info('Expired refresh token!');
				await updateUserById({
					id: user.id,
					refreshToken: [...refreshTokenArray],
				});
			}

			if (err || user.id !== (decoded as CustomPayload).acc) {
				return void res.sendStatus(403);
			}

			const { accessToken, refreshToken: newRefreshToken } = generateTokens(
				user.id
			);

			await updateUserById({
				id: user.id,
				refreshToken: [...refreshTokenArray, newRefreshToken],
			});

			setRefreshTokenCookie(res, newRefreshToken);

			return void res.json({ accessToken });
		}
	);
};
