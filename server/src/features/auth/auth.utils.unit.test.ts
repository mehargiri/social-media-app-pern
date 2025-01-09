/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Response } from 'express';
import { SUUID } from 'short-uuid';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
	clearRefreshTokenCookie,
	CONSTANT_NAMES,
	createAccessToken,
	createRefreshToken,
	generateTokens,
	setRefreshTokenCookie,
} from './auth.utils.js';

const userId = '8orMfY6H7xXNZA7V7Z5EFq' as SUUID;

describe('Authentication Utils Functions', () => {
	const res = {
		cookie: vi.fn(),
		clearCookie: vi.fn(),
	};

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('createAccessToken', () => {
		it('should create an access token with correct payload', () => {
			const accessToken = createAccessToken(userId);
			expect(accessToken).toBeDefined();
		});
	});

	describe('createRefreshToken', () => {
		it('should create a refresh token with correct payload', () => {
			const refreshToken = createRefreshToken(userId);
			expect(refreshToken).toBeDefined();
		});
	});

	describe('generateTokens', () => {
		it('should create access and refresh tokens with given payload', () => {
			const { accessToken, refreshToken } = generateTokens(userId);

			expect(accessToken).toBeDefined();
			expect(refreshToken).toBeDefined();
		});
	});

	describe('setRefreshTokenCookie', () => {
		const callTestFn = () => {
			setRefreshTokenCookie(res as unknown as Response, userId);
			expect(res.cookie).toHaveBeenCalledWith(
				CONSTANT_NAMES.cookieName,
				userId,
				{
					httpOnly: true,
					sameSite: 'strict',
					secure: process.env['NODE_ENV'] === 'production',
					maxAge: 24 * 60 * 60 * 1000, // 1 day
				}
			);
		};

		it('should set a httpOnly cookie with 1 day expiry in development', () => {
			callTestFn();
			expect(res.cookie.mock.calls[0]?.at(2).secure).toBe(false);
		});

		it('should set a secure httpOnly cookie with 1 day expiry in production', () => {
			vi.stubEnv('NODE_ENV', 'production');

			callTestFn();
			expect(res.cookie.mock.calls[1]?.at(2).secure).toBe(true);

			vi.unstubAllEnvs();
		});
	});

	describe('clearRefreshTokenCookie', () => {
		const callTestFn = () => {
			clearRefreshTokenCookie(res as unknown as Response);

			expect(res.clearCookie).toHaveBeenCalledWith(CONSTANT_NAMES.cookieName, {
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env['NODE_ENV'] === 'production',
			});
		};

		it('should clear a httpOnly cookie in development', () => {
			callTestFn();
			expect(res.clearCookie.mock.calls[0]?.at(1).secure).toBe(false);
		});

		it('should clear a secure httpOnly cookie in production', () => {
			vi.stubEnv('NODE_ENV', 'production');
			callTestFn();
			expect(res.clearCookie.mock.calls[1]?.at(1).secure).toBe(true);

			vi.unstubAllEnvs();
		});
	});
});
