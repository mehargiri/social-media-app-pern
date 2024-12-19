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
} from '@/utils/auth.utils.js';
import { verify } from 'argon2';
import { Response } from 'express';
import {
	JsonWebTokenError,
	verify as jwtVerify,
	VerifyCallback,
} from 'jsonwebtoken';
import { SUUID } from 'short-uuid';
import { afterAll, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	handleLoginRefreshTokenReuse,
	handleRefreshTokenReuse,
	processOldRefreshTokenForNew,
	validateCredentials,
} from './auth.controllers.helpers.js';

const flushPromises = async () => {
	await new Promise((resolve) => {
		process.nextTick(resolve);
	});
};

describe('Auth Controller Helper Functions', () => {
	vi.mock('@/services/user.services.js', () => ({
		getUserDataForLogin: vi.fn(),
		userTokenExists: vi.fn(),
		userExists: vi.fn(),
		updateUserById: vi.fn(),
	}));

	vi.mock('argon2', () => ({
		verify: vi.fn(),
	}));

	vi.mock('jsonwebtoken', () => ({
		verify: vi.fn(),
	}));

	vi.mock(import('@/utils/auth.utils.js'), async (importOriginal) => {
		const actualModule = await importOriginal();
		return {
			...actualModule,
			setRefreshTokenCookie: vi.fn(),
			generateTokens: vi.fn(),
			clearRefreshTokenCookie: vi.fn(),
		};
	});

	vi.spyOn(console, 'info');

	const req = {
		body: {
			email: 'random-email',
			password: 'random-password',
		},
		cookies: {
			tk: 'random-token',
		},
	};

	const res = {
		json: vi.fn(),
		sendStatus: vi.fn(),
	};

	const oldRefreshToken = 'old-token';
	const accessToken = 'access-token';
	const newRefreshToken = 'refresh-token';
	const tokenArray = ['token-1', 'token-2'];

	const userData = {
		id: 'user-id-SUUID' as SUUID,
		password: req.body.password,
		refreshToken: [] as string[],
	};

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('Login', () => {
		describe('validateCredentials Function', () => {
			beforeEach(() => {
				(getUserDataForLogin as Mock).mockResolvedValue(userData);
			});
			it('should throw Error when user email cannot be found', async () => {
				(getUserDataForLogin as Mock).mockResolvedValue(undefined);

				await expect(
					validateCredentials(req.body.email, req.body.password)
				).rejects.toThrow(Error('Invalid credentials', { cause: 401 }));
			});

			it('should throw Error when user password does not match', async () => {
				(verify as Mock).mockResolvedValue(false);

				await expect(
					validateCredentials(req.body.email, req.body.password)
				).rejects.toThrow(Error('Invalid credentials', { cause: 401 }));
			});

			it('should return user data: id, password, refreshToken on success', async () => {
				(verify as Mock).mockResolvedValue(true);

				const user = await validateCredentials(
					req.body.email,
					req.body.password
				);

				expect(user).toStrictEqual(userData);
			});
		});

		describe('handleLoginRefreshTokenReuse Function', () => {
			it('should clear refresh token cookie when old refresh token exists', async () => {
				(userTokenExists as Mock).mockResolvedValue(userData);

				await handleLoginRefreshTokenReuse(
					userData,
					res as unknown as Response,
					oldRefreshToken
				);

				expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
			});

			it('should return empty refresh token array when old refresh token does not exist in user table', async () => {
				(userTokenExists as Mock).mockResolvedValue(undefined);

				const tokenArray = await handleLoginRefreshTokenReuse(
					userData,
					res as unknown as Response,
					oldRefreshToken
				);

				expect(tokenArray).toStrictEqual([]);
			});

			it('should log a message when old refresh token does not exist in user table', async () => {
				(userTokenExists as Mock).mockResolvedValue(undefined);

				await handleLoginRefreshTokenReuse(
					userData,
					res as unknown as Response,
					oldRefreshToken
				);

				expect(console.info).toHaveBeenCalledWith(
					'Attempted refresh token reuse at login!'
				);
			});

			it('should return refreshTokenArray on success', async () => {
				(userTokenExists as Mock).mockResolvedValue(userData);

				const tokenArray = await handleLoginRefreshTokenReuse(
					userData,
					res as unknown as Response,
					oldRefreshToken
				);

				expect(tokenArray).toStrictEqual(userData.refreshToken);
			});
		});
	});
	describe('Refresh Token', () => {
		const decodedPayload = { acc: userData.id };

		describe('handleRefreshTokenReuse Function', () => {
			it('should call res.sendStatus when error is encountered while verifying refresh token', () => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(Error('Invalid token') as JsonWebTokenError, undefined);
					}
				);

				handleRefreshTokenReuse(oldRefreshToken, res as unknown as Response);

				expect(res.sendStatus).toHaveBeenCalledWith(401);
			});

			it('should log a message when refresh token verification works', () => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(null, decodedPayload);
					}
				);

				(userExists as Mock).mockResolvedValue(undefined);

				handleRefreshTokenReuse(oldRefreshToken, res as unknown as Response);

				expect(console.info).toHaveBeenCalledWith(
					'Attempted refresh token reuse!'
				);
			});

			it('should clear the refreshTokenArray of a user associated with the refresh token', async () => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(null, decodedPayload);
					}
				);

				(userExists as Mock).mockResolvedValue({ id: userData.id });

				handleRefreshTokenReuse(oldRefreshToken, res as unknown as Response);

				await flushPromises();

				expect(updateUserById).toHaveBeenCalledWith({
					id: userData.id,
					refreshToken: [],
				});
			});
		});

		describe('processOldRefreshTokenForNew Function', () => {
			beforeEach(() => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(Error('Invalid token') as JsonWebTokenError, undefined);
					}
				);
				(generateTokens as Mock).mockReturnValue({
					accessToken,
					refreshToken: newRefreshToken,
				});
			});

			it('should log a message when error is encountered while verifying refresh token', () => {
				processOldRefreshTokenForNew(
					userData,
					oldRefreshToken,
					tokenArray,
					res as unknown as Response
				);

				expect(console.info).toHaveBeenCalledWith('Expired refresh token');
			});

			it('should update user record with new refresh token array when error is encountered while verifying refresh token', async () => {
				processOldRefreshTokenForNew(
					userData,
					oldRefreshToken,
					tokenArray,
					res as unknown as Response
				);

				await flushPromises();

				expect(updateUserById).toHaveBeenCalledWith({
					id: userData.id,
					refreshToken: [...tokenArray],
				});
			});

			it('should call res.sendStatus with HTTP 403 when error is encountered while verifying refresh token', async () => {
				processOldRefreshTokenForNew(
					userData,
					oldRefreshToken,
					[...tokenArray],
					res as unknown as Response
				);

				await flushPromises();

				expect(res.sendStatus).toHaveBeenCalledWith(403);
			});

			it('should call res.sendStatus with HTTP 403 if user id does not match with decoded value', () => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(null, { acc: 'random-id' });
					}
				);

				processOldRefreshTokenForNew(
					userData,
					oldRefreshToken,
					[...tokenArray],
					res as unknown as Response
				);

				expect(res.sendStatus).toHaveBeenCalledWith(403);
			});

			it('should call generateTokens with user id', () => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(null, decodedPayload);
					}
				);

				processOldRefreshTokenForNew(
					userData,
					oldRefreshToken,
					[...tokenArray],
					res as unknown as Response
				);

				expect(generateTokens).toHaveBeenCalledWith(userData.id);
			});

			it('should update user record with new refresh token', async () => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(null, decodedPayload);
					}
				);

				processOldRefreshTokenForNew(
					userData,
					oldRefreshToken,
					[...tokenArray],
					res as unknown as Response
				);

				await flushPromises();

				expect(updateUserById).toHaveBeenCalledWith({
					id: userData.id,
					refreshToken: [...tokenArray, newRefreshToken],
				});
			});

			it('should set new refresh token as cookie and call res.json with access token', async () => {
				(jwtVerify as Mock).mockImplementation(
					(_token, _secret, callback: VerifyCallback) => {
						callback(null, decodedPayload);
					}
				);

				processOldRefreshTokenForNew(
					userData,
					oldRefreshToken,
					[...tokenArray],
					res as unknown as Response
				);

				await flushPromises();

				expect(setRefreshTokenCookie).toHaveBeenCalledWith(
					res,
					newRefreshToken
				);
				expect(res.json).toHaveBeenCalledWith({ accessToken });
			});
		});
	});
});
