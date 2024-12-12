/* eslint-disable @typescript-eslint/no-misused-promises */
import {
	getUserDataForLogin,
	updateUserById,
	userExists,
	userTokenExists,
} from '@/services/user.services.js';
import {
	clearRefreshTokenCookie,
	generateTokens,
	setRefreshTokenCookie,
	TOKEN_CONFIG,
} from '@/utils/auth.utils.js';
import { verify } from 'argon2';
import { Response } from 'express';
import { verify as jwtVerify } from 'jsonwebtoken';
import { CustomPayload } from './auth.controllers.js';

// Login Helper functions
export const validateCredentials = async (email: string, password: string) => {
	const user = await getUserDataForLogin({ email });
	if (!user || !(await verify(user.password, password))) {
		throw Error('Invalid credentials', { cause: 401 });
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
	jwtVerify(
		refreshToken,
		TOKEN_CONFIG.REFRESH_TOKEN_SECRET,
		async (err, decoded) => {
			if (err) {
				res.sendStatus(401);
				return;
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
	jwtVerify(
		refreshToken,
		TOKEN_CONFIG.REFRESH_TOKEN_SECRET,
		async (err, decoded) => {
			if (err) {
				console.info('Expired refresh token');
				await updateUserById({
					id: user.id,
					refreshToken: [...refreshTokenArray],
				});
			}

			if (err || user.id !== (decoded as CustomPayload).acc) {
				res.sendStatus(403);
				return;
			}

			const { accessToken, refreshToken: newRefreshToken } = generateTokens(
				user.id
			);

			await updateUserById({
				id: user.id,
				refreshToken: [...refreshTokenArray, newRefreshToken],
			});

			setRefreshTokenCookie(res, newRefreshToken);

			res.json({ accessToken });
			return;
		}
	);
};
