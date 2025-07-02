/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	getUserDataForLogin,
	updateUserById,
	userExists,
	userTokenExists,
} from '@/features/user/user.services.js';
import { hash, verify } from 'argon2';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { promisify } from 'util';
import { CustomPayload } from './auth.controllers.js';
import { generateTokens, TOKEN_CONFIG } from './auth.utils.js';

export const DUMMY_HASH = await hash('fake_password');

export const validateCredentials = async (email: string, password: string) => {
	const user = await getUserDataForLogin({ email });

	const hashToCheck = user?.password ?? DUMMY_HASH;
	const isValid = await verify(hashToCheck, password);

	if (!user || !isValid) {
		throw Error('Invalid Credentials', { cause: 401 });
	}

	const { password: userPassword, ...goodUserData } = user;
	return goodUserData;
};

export const handleLoginRefreshTokenReuse = async (
	user: Omit<
		NonNullable<Awaited<ReturnType<typeof getUserDataForLogin>>>,
		'password'
	>,
	oldRefreshToken?: string
) => {
	let refreshTokenArray: string[];
	let shouldClearRefreshTokenCookie = false;

	if (!oldRefreshToken) {
		return {
			refreshTokenArray: user.refreshToken ?? [],
			shouldClearRefreshTokenCookie,
		};
	}

	shouldClearRefreshTokenCookie = true;

	const foundToken = await userTokenExists({ refreshToken: oldRefreshToken });

	if (!foundToken) {
		console.info('Attempted refresh token reuse at login!');
		refreshTokenArray = [];
	} else {
		refreshTokenArray =
			user.refreshToken?.filter((rt) => rt !== oldRefreshToken) ?? [];
	}

	return { refreshTokenArray, shouldClearRefreshTokenCookie };
};

export const verifyJWT = promisify(jwt.verify) as (
	...args: Parameters<typeof jwt.verify>
) => Promise<JwtPayload>;

export const handleRefreshTokenReuse = async (refreshToken: string) => {
	try {
		const decoded = (await verifyJWT(
			refreshToken,
			TOKEN_CONFIG.REFRESH_TOKEN_SECRET
		)) as CustomPayload;

		console.info('Attempted refresh token reuse!');

		const hackedUser = await userExists({
			id: decoded.acc,
		});

		if (hackedUser) {
			await updateUserById({
				id: hackedUser.id,
				refreshToken: [],
			});
		}
	} catch (err) {
		throw Error('', { cause: 403 });
	}
};

export const processOldRefreshTokenForNew = async (
	user: NonNullable<Awaited<ReturnType<typeof userTokenExists>>>,
	refreshToken: string,
	refreshTokenArray: string[]
) => {
	let decoded: CustomPayload | undefined;
	try {
		decoded = (await verifyJWT(
			refreshToken,
			TOKEN_CONFIG.REFRESH_TOKEN_SECRET
		)) as CustomPayload;
	} catch (err) {
		console.info('Expired refresh token!');
		await updateUserById({
			id: user.id,
			refreshToken: [...refreshTokenArray],
		});
		throw Error('', { cause: 403 });
	}

	if (decoded.acc !== user.id) {
		throw Error('', { cause: 403 });
	}

	const { accessToken, refreshToken: newRefreshToken } = generateTokens(
		user.id
	);

	await updateUserById({
		id: user.id,
		refreshToken: [...refreshTokenArray, newRefreshToken],
	});

	return { accessToken, newRefreshToken };
};
