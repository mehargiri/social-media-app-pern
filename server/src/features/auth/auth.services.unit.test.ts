import {
	updateUserById,
	userTokenExists,
} from '@/features/user/user.services.js';
import {
	sampleEmail as email,
	samplePassword as password,
} from '@/utils/test.utils.js';
import { SUUID } from 'short-uuid';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	handleLoginRefreshTokenReuse,
	handleRefreshTokenReuse,
	processOldRefreshTokenForNew,
	validateCredentials,
} from './auth.services.helpers.js';
import {
	loginUserService,
	logoutUserService,
	refreshTokenService,
} from './auth.services.js';
import { generateTokens } from './auth.utils.js';

describe('Authentication Service Functions', () => {
	vi.mock('./auth.services.helpers.js', () => ({
		validateCredentials: vi.fn(),
		handleLoginRefreshTokenReuse: vi.fn(),
		handleRefreshTokenReuse: vi.fn(),
		processOldRefreshTokenForNew: vi.fn(),
	}));

	vi.mock('@/features/user/user.services.js', async (importOriginal) => {
		const original = await importOriginal<
			typeof import('@/features/user/user.services.js')
		>();
		return {
			...original,
			updateUserById: vi.fn(),
			userTokenExists: vi.fn(),
		};
	});

	vi.mock('./auth.utils.js', async (importOriginal) => {
		const original = await importOriginal<typeof import('./auth.utils.js')>();
		return {
			...original,
			generateTokens: vi.fn(),
		};
	});

	const oldRefreshToken = 'old-refresh-token';
	const newRefreshToken = 'new-refresh-token';
	const accessToken = 'access-token';
	const tokenArray = ['old-random-token', oldRefreshToken];
	const shouldClearRefreshTokenCookie = false;

	const userData = {
		id: 'random-id' as SUUID,
		refreshToken: tokenArray,
	};

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('loginUserService function', () => {
		beforeEach(() => {
			(validateCredentials as Mock).mockResolvedValue(userData);
			(handleLoginRefreshTokenReuse as Mock).mockResolvedValue({
				refreshTokenArray: tokenArray,
				shouldClearRefreshTokenCookie,
			});
			(generateTokens as Mock).mockReturnValue({
				accessToken,
				refreshToken: newRefreshToken,
			});
		});

		it('should call validateCredentials with email and password', async () => {
			await loginUserService({ email, password, oldRefreshToken });

			expect(validateCredentials(email, password));
		});

		it('should call generateTokens with user id from validated user', async () => {
			await loginUserService({ email, password, oldRefreshToken });

			expect(generateTokens).toHaveBeenCalledWith(userData.id);
		});

		it('should call handleLoginRefreshTokenReuse with validated user and old refresh token', async () => {
			await loginUserService({ email, password, oldRefreshToken });

			expect(handleLoginRefreshTokenReuse).toHaveBeenCalledWith(
				userData,
				oldRefreshToken
			);
		});

		it('should update user with new refresh token added to existing refresh token array', async () => {
			await loginUserService({ email, password, oldRefreshToken });

			expect(updateUserById).toHaveBeenCalledWith({
				id: userData.id,
				refreshToken: [...tokenArray, newRefreshToken],
			});
		});

		it('should return accessToken, refreshToken, and shouldClearRefreshTokenCookie', async () => {
			const result = await loginUserService({
				email,
				password,
				oldRefreshToken,
			});

			expect(result).toEqual({
				accessToken,
				refreshToken: newRefreshToken,
				shouldClearRefreshTokenCookie,
			});
		});
	});

	describe('logoutUserService function', () => {
		it('should call userTokenExists with the provided refreshToken', async () => {
			(userTokenExists as Mock).mockResolvedValue(userData);

			await logoutUserService({ refreshToken: oldRefreshToken });

			expect(userTokenExists).toHaveBeenCalledWith({
				refreshToken: oldRefreshToken,
			});
		});

		it('should not update user data if user with refreshToken does not exist', async () => {
			(userTokenExists as Mock).mockResolvedValue(undefined);

			await logoutUserService({ refreshToken: oldRefreshToken });

			expect(updateUserById).not.toHaveBeenCalled();
		});

		it("should remove the matching refreshToken from the user's refreshToken array if user with refreshToken exists", async () => {
			(userTokenExists as Mock).mockResolvedValue(userData);

			await logoutUserService({ refreshToken: oldRefreshToken });

			expect(updateUserById).toHaveBeenCalledWith({
				id: userData.id,
				refreshToken: ['old-random-token'],
			});
		});
	});

	describe('refreshTokenService function', () => {
		it('should throw Error with cause of 401 if refreshToken is not provided', async () => {
			await expect(
				refreshTokenService({ refreshToken: undefined })
			).rejects.toThrowError(Error('', { cause: 401 }));
		});

		it('should call userTokenExists with the provided refreshToken', async () => {
			(userTokenExists as Mock).mockResolvedValue(userData);
			(processOldRefreshTokenForNew as Mock).mockResolvedValue({
				accessToken,
				newRefreshToken,
			});
			await refreshTokenService({ refreshToken: oldRefreshToken });

			expect(userTokenExists).toHaveBeenCalledWith({
				refreshToken: oldRefreshToken,
			});
		});

		it('should call handleRefreshTokenReuse and throw Error with cause of 403 if user with refreshToken does not exist', async () => {
			(userTokenExists as Mock).mockResolvedValue(undefined);
			(processOldRefreshTokenForNew as Mock).mockResolvedValue({
				accessToken,
				newRefreshToken,
			});

			await expect(
				refreshTokenService({ refreshToken: oldRefreshToken })
			).rejects.toThrowError(Error('', { cause: 403 }));

			expect(handleRefreshTokenReuse).toHaveBeenCalledOnce();
			expect(handleRefreshTokenReuse).toHaveBeenCalledWith(oldRefreshToken);
		});

		it('should not call handleRefreshTokenReuse and resolve without error if user with refreshToken exists', async () => {
			(userTokenExists as Mock).mockResolvedValue(userData);
			(processOldRefreshTokenForNew as Mock).mockResolvedValue({
				accessToken,
				newRefreshToken,
			});

			await expect(
				refreshTokenService({ refreshToken: oldRefreshToken })
			).resolves.toBeDefined();

			expect(handleRefreshTokenReuse).not.toHaveBeenCalledOnce();
		});

		it('should call processOldRefreshTokenForNew with the correct arguments when user is found: the user object, the old refreshToken, and the filtered refreshToken array on success', async () => {
			(userTokenExists as Mock).mockResolvedValue(userData);
			(processOldRefreshTokenForNew as Mock).mockResolvedValue({
				accessToken,
				newRefreshToken,
			});

			await expect(
				refreshTokenService({ refreshToken: oldRefreshToken })
			).resolves.toEqual({ accessToken, newRefreshToken });

			expect(processOldRefreshTokenForNew).toBeCalledTimes(1);
			expect(processOldRefreshTokenForNew).toHaveBeenCalledWith(
				userData,
				oldRefreshToken,
				[tokenArray[0]]
			);
		});
	});
});
