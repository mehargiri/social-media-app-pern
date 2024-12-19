/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	clearRefreshTokenCookie,
	createAccessToken,
	createRefreshToken,
	generateTokens,
	setRefreshTokenCookie,
} from '@/utils/auth.utils.js';
import { Response } from 'express';
import { SUUID } from 'short-uuid';
import { afterAll, describe, expect, it, vi } from 'vitest';

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
		it('should set a httpOnly cookie with 1 day expiry in development', () => {
			setRefreshTokenCookie(res as unknown as Response, userId);
			expect(res.cookie).toHaveBeenCalledWith('tk', userId, {
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env['NODE_ENV'] === 'production',
				maxAge: 24 * 60 * 60 * 1000, // 1 day
			});
			expect(res.cookie.mock.calls[0]?.at(2).secure).toBe(false);
		});

		it('should set a secure httpOnly cookie with 1 day expiry in production', () => {
			vi.stubEnv('NODE_ENV', 'production');

			setRefreshTokenCookie(res as unknown as Response, userId);
			expect(res.cookie).toHaveBeenCalledWith('tk', userId, {
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env['NODE_ENV'] === 'production',
				maxAge: 24 * 60 * 60 * 1000, // 1 day
			});
			expect(res.cookie.mock.calls[1]?.at(2).secure).toBe(true);

			vi.unstubAllEnvs();
		});
	});

	describe('clearRefreshTokenCookie', () => {
		it('should clear a httpOnly cookie in development', () => {
			clearRefreshTokenCookie(res as unknown as Response);

			expect(res.clearCookie).toHaveBeenCalledWith('tk', {
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env['NODE_ENV'] === 'production',
			});
			expect(res.clearCookie.mock.calls[0]?.at(1).secure).toBe(false);
		});

		it('should clear a secure httpOnly cookie in production', () => {
			vi.stubEnv('NODE_ENV', 'production');
			clearRefreshTokenCookie(res as unknown as Response);

			expect(res.clearCookie).toHaveBeenCalledWith('tk', {
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env['NODE_ENV'] === 'production',
			});
			expect(res.clearCookie.mock.calls[1]?.at(1).secure).toBe(true);

			vi.unstubAllEnvs();
		});
	});
});
