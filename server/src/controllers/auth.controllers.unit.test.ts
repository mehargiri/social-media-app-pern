import { updateUserById, userTokenExists } from '@/services/user.services.js';
import {
	clearRefreshTokenCookie,
	generateTokens,
	setRefreshTokenCookie,
} from '@/utils/auth.utils.js';
import { sampleEmail, samplePassword } from '@/utils/test.utils.js';
import { Response } from 'express';
import { SUUID } from 'short-uuid';
import { afterAll, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	handleLoginRefreshTokenReuse,
	handleRefreshTokenReuse,
	processOldRefreshTokenForNew,
	validateCredentials,
} from './auth.controllers.helpers.js';
import {
	CookieType,
	CustomCookieRequest,
	CustomLoginRequest,
	loginUser,
	logoutUser,
	refreshToken,
} from './auth.controllers.js';

describe('Authentication Controller Functions', () => {
	vi.mock(import('@/utils/auth.utils.js'), async (importOriginal) => {
		const actualModule = await importOriginal();
		return {
			...actualModule,
			generateTokens: vi.fn(),
			clearRefreshTokenCookie: vi.fn(),
			setRefreshTokenCookie: vi.fn(),
		};
	});

	vi.mock('@/services/user.services.js', () => ({
		userTokenExists: vi.fn(),
		updateUserById: vi.fn(),
	}));

	vi.mock('./auth.controllers.helpers.js', () => ({
		validateCredentials: vi.fn(),
		handleLoginRefreshTokenReuse: vi.fn(),
		processOldRefreshTokenForNew: vi.fn(),
		handleRefreshTokenReuse: vi.fn(),
	}));

	const oldRefreshToken = 'refresh-token';
	const accessToken = 'access-token';
	const tokenArray = ['old-random-token', oldRefreshToken];

	const userData = {
		id: 'random-id' as SUUID,
		refreshToken: tokenArray,
	};

	const req = {
		body: {
			email: sampleEmail,
			password: samplePassword,
		},
		cookies: {
			tk: oldRefreshToken as string | undefined,
		} as CookieType,
	};

	const res = {
		sendStatus: vi.fn(),
		json: vi.fn(),
	};

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('loginUser function', () => {
		const callTestFn = async () => {
			await loginUser(
				req as unknown as CustomLoginRequest,
				res as unknown as Response
			);
		};

		beforeEach(() => {
			(validateCredentials as Mock).mockResolvedValue(userData);
			(handleLoginRefreshTokenReuse as Mock).mockResolvedValue(tokenArray);
			(generateTokens as Mock).mockReturnValue({
				accessToken,
				refreshToken: oldRefreshToken,
			});
			vi.clearAllMocks();
		});

		it('should call validateCredentials with user email and user password', async () => {
			await callTestFn();

			expect(validateCredentials).toHaveBeenCalledWith(
				req.body.email,
				req.body.password
			);
		});

		it('should call generateTokens function with user id', async () => {
			await callTestFn();

			expect(generateTokens).toHaveBeenCalledWith(userData.id);
		});

		it('should call handleLoginRefreshTokenReuse function with user, response, and refreshToken', async () => {
			await callTestFn();

			expect(handleLoginRefreshTokenReuse).toHaveBeenCalledWith(
				userData,
				res,
				req.cookies.tk
			);
		});

		it('should update user with new refreshToken Array', async () => {
			await callTestFn();

			expect(updateUserById).toHaveBeenCalledWith({
				id: userData.id,
				refreshToken: [...tokenArray, oldRefreshToken],
			});
		});

		it('should set new refreshToken as cookie and call res.json with accessToken', async () => {
			await callTestFn();

			expect(setRefreshTokenCookie).toHaveBeenCalledWith(res, oldRefreshToken);
			expect(res.json).toHaveBeenCalledWith({ accessToken });
		});
	});

	describe('logoutUser function', () => {
		const callTestFn = async () => {
			await logoutUser(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);
		};

		beforeEach(() => {
			req.cookies.tk = oldRefreshToken;
			(userTokenExists as Mock).mockResolvedValue(userData);
			(updateUserById as Mock).mockResolvedValue({ id: userData.id });
			vi.clearAllMocks();
		});

		it('should call res.sendStatus with HTTP 204 when there is not refreshToken', async () => {
			req.cookies.tk = undefined;

			await callTestFn();

			expect(res.sendStatus).toHaveBeenCalledWith(204);
		});

		it('should clear refresh token cookie when refresh token is not present in user record', async () => {
			await callTestFn();

			expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
		});

		it('should call res.sendStatus with HTTP 204 when refresh token is not present in user record', async () => {
			await callTestFn();

			expect(res.sendStatus).toHaveBeenCalledWith(204);
		});

		it('should clear refresh token from user record if the refresh token is present in the user record', async () => {
			await callTestFn();

			expect(updateUserById).toHaveBeenCalledWith({
				id: userData.id,
				refreshToken: ['old-random-token'],
			});
		});

		it('should clear refresh token cookie', async () => {
			await callTestFn();

			expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
		});

		it('should call res.sendStatus with HTTP 204', async () => {
			await callTestFn();

			expect(res.sendStatus).toHaveBeenCalledWith(204);
		});
	});

	describe('refreshToken function', () => {
		const callTestFn = async () => {
			await refreshToken(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);
		};

		beforeEach(() => {
			req.cookies.tk = oldRefreshToken;
			vi.resetAllMocks();
		});

		it('should throw Error with 401 as the cause when there is no refresh token', async () => {
			req.cookies.tk = undefined;

			try {
				await callTestFn();
			} catch (error) {
				expect(error).toStrictEqual(Error('', { cause: 401 }));
			}
		});

		it('should clear refresh token cookie if it exists', async () => {
			(userTokenExists as Mock).mockResolvedValue(true);

			await callTestFn();

			expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
		});

		it('should call handleRefreshTokenReuse function with the refresh token cookie when refresh token cannot be found in the user record', async () => {
			try {
				await callTestFn();
			} catch (error) {
				expect(error).toBeDefined();
			}

			expect(handleRefreshTokenReuse).toHaveBeenCalledWith(
				oldRefreshToken,
				res
			);
		});

		it('should throw Error with 403 as the cause when refresh token cannot be found in the user record', async () => {
			try {
				await callTestFn();
			} catch (error) {
				expect(error).toStrictEqual(Error('', { cause: 403 }));
			}
		});

		it('should call processOldRefreshTokenForNew function with user, refreshToken cookie, refreshToken array and response', async () => {
			(userTokenExists as Mock).mockResolvedValue(userData);

			await callTestFn();

			expect(processOldRefreshTokenForNew).toHaveBeenCalledWith(
				userData,
				oldRefreshToken,
				['old-random-token'],
				res
			);
		});
	});
});
