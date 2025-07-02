import {
	getUserDataForLogin,
	updateUserById,
	userExists,
	userTokenExists,
} from '@/features/user/user.services.js';
import {
	sampleEmail as email,
	samplePassword as password,
	sampleSUUID,
} from '@/utils/test.utils.js';
import { verify } from 'argon2';
import { SUUID } from 'short-uuid';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	DUMMY_HASH,
	handleLoginRefreshTokenReuse,
	handleRefreshTokenReuse,
	processOldRefreshTokenForNew,
	validateCredentials,
} from './auth.services.helpers.js';
import { createRefreshToken, generateTokens } from './auth.utils.js';

describe('Authentication Service Helper Functions', () => {
	vi.mock('@/features/user/user.services.js', async (importOriginal) => {
		const original = await importOriginal<
			typeof import('@/features/user/user.services.js')
		>();
		return {
			...original,
			getUserDataForLogin: vi.fn(),
			userTokenExists: vi.fn(),
			userExists: vi.fn(),
			updateUserById: vi.fn(),
		};
	});

	vi.mock('argon2', async (importOriginal) => {
		const original = await importOriginal<typeof import('argon2')>();

		return {
			...original,
			verify: vi.fn(),
		};
	});

	vi.mock('./auth.utils.js', async (importOriginal) => {
		const original = await importOriginal<typeof import('./auth.utils.js')>();

		return {
			...original,
			generateTokens: vi.fn(),
		};
	});

	const consoleMock = vi.spyOn(console, 'info');

	const oldRefreshToken = 'old-refresh-token';
	const accessToken = 'access-token';
	const newRefreshToken = 'new-refresh-token';
	const tokenArray = ['old-random-token', oldRefreshToken];

	const userData = {
		id: 'random-id' as SUUID,
		refreshToken: tokenArray,
	};

	const decodedPayload = { acc: userData.id };
	const tokenForVerification = createRefreshToken(userData.id);

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('validateCredentials function', () => {
		it('should throw Error with cause of 401 if user with email and password does not exist', async () => {
			(getUserDataForLogin as Mock).mockResolvedValue(undefined);

			await expect(validateCredentials(email, password)).rejects.toThrowError(
				Error('Invalid Credentials', { cause: 401 })
			);
		});

		it('should throw Error with cause of 401 if user password and provided password does not match', async () => {
			(getUserDataForLogin as Mock).mockResolvedValue({
				...userData,
				password: 'lol',
			});

			(verify as Mock).mockResolvedValue(false);

			await expect(validateCredentials(email, password)).rejects.toThrowError(
				Error('Invalid Credentials', { cause: 401 })
			);
		});

		it('should call verify with DUMMY_HASH when user is not found', async () => {
			(getUserDataForLogin as Mock).mockResolvedValue(undefined);

			(verify as Mock).mockResolvedValue(false);

			await expect(validateCredentials(email, password)).rejects.toThrowError(
				Error('Invalid Credentials', { cause: 401 })
			);

			expect(verify).toHaveBeenCalledWith(DUMMY_HASH, password);
		});

		it('should return the user data without password field on success', async () => {
			(getUserDataForLogin as Mock).mockResolvedValue({
				...userData,
				password: 'lol',
			});

			(verify as Mock).mockResolvedValue(true);

			const result = await validateCredentials(email, password);

			expect(result).not.toHaveProperty('password');
			expect(result).toEqual(userData);
		});
	});

	describe('handleLoginRefreshTokenReuse function', () => {
		it("should return user's refresh token array and shouldClearRefreshTokenCookie as false if old refresh token is not provided", async () => {
			const result = await handleLoginRefreshTokenReuse(userData);

			expect(result).toEqual({
				refreshTokenArray: tokenArray,
				shouldClearRefreshTokenCookie: false,
			});
		});

		it('should not call userTokenExists when oldRefreshToken is not provided', async () => {
			await handleLoginRefreshTokenReuse(userData);

			expect(userTokenExists).not.toBeCalled();
		});

		it('should call userTokenExists with oldRefreshToken when oldRefreshToken is provided', async () => {
			await handleLoginRefreshTokenReuse(userData, oldRefreshToken);

			expect(userTokenExists).toBeCalledWith({ refreshToken: oldRefreshToken });
		});

		it('should console log attempted refresh token reuse message when user with oldRefreshToken does not exist', async () => {
			(userTokenExists as Mock).mockResolvedValue(undefined);

			await handleLoginRefreshTokenReuse(userData, oldRefreshToken);

			expect(consoleMock).toHaveBeenCalledOnce();
			expect(consoleMock).toHaveBeenCalledWith(
				'Attempted refresh token reuse at login!'
			);
		});

		it('should return empty refresh token array and shouldClearRefreshTokenCookie as true when user with oldRefreshToken does not exist', async () => {
			(userTokenExists as Mock).mockResolvedValue(undefined);

			const result = await handleLoginRefreshTokenReuse(
				userData,
				oldRefreshToken
			);

			expect(result).toEqual({
				refreshTokenArray: [],
				shouldClearRefreshTokenCookie: true,
			});
		});

		it('should return filtered refresh token and shouldClearRefreshTokenCookie as true value when user with oldRefreshToken exists', async () => {
			(userTokenExists as Mock).mockResolvedValue(userData);

			const result = await handleLoginRefreshTokenReuse(
				userData,
				oldRefreshToken
			);

			expect(result).toEqual({
				refreshTokenArray: [tokenArray[0]],
				shouldClearRefreshTokenCookie: true,
			});
		});
	});

	describe('handleRefreshTokenReuse function', () => {
		it('should throw Error with cause of 403 when JWT verification of refreshToken fails', async () => {
			await expect(
				handleRefreshTokenReuse(oldRefreshToken)
			).rejects.toThrowError(Error('', { cause: 403 }));
		});

		it('should console log message saying attempted refresh token reuse on success', async () => {
			await expect(
				handleRefreshTokenReuse(tokenForVerification)
			).resolves.toBeUndefined();

			expect(consoleMock).toBeCalledWith('Attempted refresh token reuse!');
		});

		it('should call userExists with the decoded id from JWT payload on success', async () => {
			await handleRefreshTokenReuse(tokenForVerification);
			expect(userExists).toBeCalledWith({ id: decodedPayload.acc });
		});

		it("should empty the user's refresh token array if the user exists on success", async () => {
			(userExists as Mock).mockResolvedValue({ id: userData.id });

			await handleRefreshTokenReuse(tokenForVerification);

			expect(updateUserById).toBeCalledWith({
				id: userData.id,
				refreshToken: [],
			});
		});
	});

	describe('processOldRefreshTokenForNew function', () => {
		it('should throw Error with cause of 403 when JWT verification of refreshToken fails', async () => {
			await expect(
				processOldRefreshTokenForNew(userData, oldRefreshToken, tokenArray)
			).rejects.toThrowError(Error('', { cause: 403 }));
		});

		it('should console log message saying expired refresh token when JWT verification of refreshToken fails', async () => {
			await expect(
				processOldRefreshTokenForNew(userData, oldRefreshToken, tokenArray)
			).rejects.toThrowError(Error('', { cause: 403 }));

			expect(consoleMock).toBeCalledWith('Expired refresh token!');
		});

		it('should throw Error with cause of 403 if user ID does not match decoded JWT payload', async () => {
			await expect(
				processOldRefreshTokenForNew(
					{
						id: sampleSUUID,
						refreshToken: ['hello'],
					},
					tokenForVerification,
					tokenArray
				)
			).rejects.toThrowError(Error('', { cause: 403 }));
		});

		it('should call generateTokens with user id on success', async () => {
			(generateTokens as Mock).mockReturnValue({
				accessToken,
				refreshToken: newRefreshToken,
			});

			await processOldRefreshTokenForNew(
				userData,
				tokenForVerification,
				tokenArray
			);

			expect(generateTokens).toBeCalledWith(userData.id);
		});

		it("should update user's refresh token array with a new refresh token", async () => {
			(generateTokens as Mock).mockReturnValue({
				accessToken,
				refreshToken: newRefreshToken,
			});

			await processOldRefreshTokenForNew(
				userData,
				tokenForVerification,
				tokenArray
			);

			expect(updateUserById).toBeCalledWith({
				id: userData.id,
				refreshToken: [...tokenArray, newRefreshToken],
			});
		});

		it('should return accessToken and newRefreshToken', async () => {
			(generateTokens as Mock).mockReturnValue({
				accessToken,
				refreshToken: newRefreshToken,
			});

			const result = await processOldRefreshTokenForNew(
				userData,
				tokenForVerification,
				tokenArray
			);

			expect(result).toEqual({
				accessToken,
				newRefreshToken,
			});
		});
	});
});
