import {
	updateUserById,
	userTokenExists,
} from '@/features/user/user.services.js';
import {
	handleLoginRefreshTokenReuse,
	handleRefreshTokenReuse,
	processOldRefreshTokenForNew,
	validateCredentials,
} from './auth.services.helpers.js';
import { generateTokens } from './auth.utils.js';

// Login
export const loginUserService = async (data: {
	email: string;
	password: string;
	oldRefreshToken?: string;
}) => {
	const { email, password, oldRefreshToken } = data;

	const userToVerify = await validateCredentials(email, password);

	const { accessToken, refreshToken: newRefreshToken } = generateTokens(
		userToVerify.id
	);

	const {
		refreshTokenArray: newRefreshTokenArray,
		shouldClearRefreshTokenCookie,
	} = await handleLoginRefreshTokenReuse(userToVerify, oldRefreshToken);

	await updateUserById({
		id: userToVerify.id,
		refreshToken: [...newRefreshTokenArray, newRefreshToken],
	});

	return {
		accessToken,
		refreshToken: newRefreshToken,
		shouldClearRefreshTokenCookie,
	};
};

// Logout
export const logoutUserService = async (data: { refreshToken: string }) => {
	const { refreshToken } = data;

	const foundUser = await userTokenExists({ refreshToken });

	if (!foundUser) {
		return;
	}

	await updateUserById({
		id: foundUser.id,
		refreshToken: foundUser.refreshToken?.filter((rt) => rt !== refreshToken),
	});
};

// Refresh Token
export const refreshTokenService = async (data: { refreshToken?: string }) => {
	const { refreshToken } = data;

	if (!refreshToken) {
		throw Error('', { cause: 401 });
	}

	const foundUser = await userTokenExists({ refreshToken });

	if (!foundUser) {
		await handleRefreshTokenReuse(refreshToken);
		throw Error('', { cause: 403 });
	}

	const newRefreshTokenArray =
		foundUser.refreshToken?.filter((rt) => rt !== refreshToken) ?? [];

	const { accessToken, newRefreshToken } = await processOldRefreshTokenForNew(
		foundUser,
		refreshToken,
		newRefreshTokenArray
	);

	return { accessToken, newRefreshToken };
};
