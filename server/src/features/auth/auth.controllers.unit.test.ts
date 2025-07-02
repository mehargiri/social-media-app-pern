import { sampleEmail, samplePassword } from '@/utils/test.utils.js';
import { Response } from 'express';
import { afterAll, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	CookieType,
	CustomCookieRequest,
	CustomLoginRequest,
	loginUser,
	logoutUser,
	refreshToken,
} from './auth.controllers.js';
import {
	loginUserService,
	logoutUserService,
	refreshTokenService,
} from './auth.services.js';
import {
	clearRefreshTokenCookie,
	setRefreshTokenCookie,
} from './auth.utils.js';

describe('Authentication Controller Functions', () => {
	vi.mock('./auth.services.js', () => ({
		loginUserService: vi.fn(),
		logoutUserService: vi.fn(),
		refreshTokenService: vi.fn(),
	}));

	vi.mock('./auth.utils.js', async (importOriginal) => {
		const original = await importOriginal<typeof import('./auth.utils.js')>();
		return {
			...original,
			setRefreshTokenCookie: vi.fn(),
			clearRefreshTokenCookie: vi.fn(),
		};
	});

	const oldRefreshToken = 'old-refresh-token';
	const newRefreshToken = 'new-refresh-token';
	const accessToken = 'access-token';

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
		const mockResolveLoginUserService = (clearRefreshTokenCookie: boolean) => {
			(loginUserService as Mock).mockResolvedValue({
				accessToken,
				refreshToken: newRefreshToken,
				shouldClearRefreshTokenCookie: clearRefreshTokenCookie,
			});
		};

		beforeEach(() => {
			vi.clearAllMocks();
			mockResolveLoginUserService(false);
		});

		it('should call loginUserService with user email, password and refreshToken from req.cookies', async () => {
			await loginUser(
				req as unknown as CustomLoginRequest,
				res as unknown as Response
			);

			expect(loginUserService).toHaveBeenCalledWith({
				email: req.body.email,
				password: req.body.password,
				oldRefreshToken: req.cookies.tk,
			});
		});

		it('should call clearRefreshTokenCookie when shouldClearRefreshTokenCookie is true', async () => {
			mockResolveLoginUserService(true);

			await loginUser(
				req as unknown as CustomLoginRequest,
				res as unknown as Response
			);

			expect(clearRefreshTokenCookie).toHaveBeenCalledOnce();
			expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
		});

		it('should not call clearRefreshTokenCookie when shouldClearRefreshTokenCookie is false', async () => {
			await loginUser(
				req as unknown as CustomLoginRequest,
				res as unknown as Response
			);

			expect(clearRefreshTokenCookie).not.toHaveBeenCalled();
		});

		it('should call setRefreshTokenCookie with new refresh token cookie on successful login', async () => {
			await loginUser(
				req as unknown as CustomLoginRequest,
				res as unknown as Response
			);

			expect(setRefreshTokenCookie).toHaveBeenCalledOnce();
			expect(setRefreshTokenCookie).toHaveBeenCalledWith(res, newRefreshToken);
		});

		it('should call res.json with accessToken on successful login', async () => {
			await loginUser(
				req as unknown as CustomLoginRequest,
				res as unknown as Response
			);

			expect(res.json).toHaveBeenCalledWith({ accessToken });
		});
	});

	describe('logoutUser function', () => {
		it('should call res.sendStatus with HTTP 204 if refreshToken is missing from cookies', async () => {
			req.cookies.tk = undefined;

			await logoutUser(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenCalledWith(204);

			req.cookies.tk = oldRefreshToken;
		});

		it('should call logoutUserService with the refreshToken from cookies', async () => {
			await logoutUser(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(logoutUserService).toHaveBeenCalledWith({
				refreshToken: oldRefreshToken,
			});
		});

		it('should clear refresh token cookie', async () => {
			await logoutUser(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
		});

		it('should call res.sendStatus with HTTP 204 on successful logout', async () => {
			await logoutUser(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenCalledWith(204);
		});
	});

	describe('refreshToken function', () => {
		beforeEach(() => {
			(refreshTokenService as Mock).mockResolvedValue({
				accessToken,
				newRefreshToken,
			});
		});

		it('should clear the existing refresh token cookie', async () => {
			await refreshToken(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
		});

		it('should call refreshTokenService with the current refresh token from cookies', async () => {
			await refreshToken(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(refreshTokenService).toHaveBeenCalledWith({
				refreshToken: oldRefreshToken,
			});
		});

		it('should set a new refresh token cookie with newRefreshToken from refreshTokenService', async () => {
			await refreshToken(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(setRefreshTokenCookie).toHaveBeenCalledWith(res, newRefreshToken);
		});

		it('should call res.json with accessToken from refreshTokenService', async () => {
			await refreshToken(
				req as unknown as CustomCookieRequest,
				res as unknown as Response
			);

			expect(res.json).toHaveBeenCalledWith({ accessToken });
		});
	});
});
