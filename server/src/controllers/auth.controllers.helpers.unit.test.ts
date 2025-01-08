import {
	getUserDataForLogin,
	updateUserById,
	userExists,
	userTokenExists,
} from '@/services/user.services.js';
import {
	clearRefreshTokenCookie,
	createAccessToken,
	createRefreshToken,
	generateTokens,
	setRefreshTokenCookie,
} from '@/utils/auth.utils.js';
import { sampleEmail, samplePassword } from '@/utils/test.utils.js';
import { verify } from 'argon2';
import { Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	Mock,
	vi,
} from 'vitest';
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
		hash: vi.fn(),
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
			email: sampleEmail,
			password: samplePassword,
		},
		cookies: {
			tk: 'random-refreshToken',
		},
	};

	const res = {
		json: vi.fn(),
		sendStatus: vi.fn(),
	};

	let refreshToken: string;
	const tokenArray = ['refreshToken-1', 'refreshToken-2'];

	const userData = {
		id: 'user-id-SUUID' as SUUID,
		password: req.body.password,
		refreshToken: tokenArray,
	};

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('Login', () => {
		const { email, password } = req.body;

		beforeAll(() => {
			refreshToken = createRefreshToken(userData.id);
		});

		describe('validateCredentials Function', () => {
			beforeEach(() => {
				(getUserDataForLogin as Mock).mockResolvedValue(userData);
			});

			it('should throw Error when user email cannot be found', async () => {
				(getUserDataForLogin as Mock).mockResolvedValue(undefined);
				await expect(validateCredentials(email, password)).rejects.toThrow(
					Error('Invalid Credentials', { cause: 401 })
				);
			});

			it('should throw Error when user password does not match', async () => {
				(verify as Mock).mockResolvedValue(false);

				await expect(validateCredentials(email, password)).rejects.toThrow(
					Error('Invalid Credentials', { cause: 401 })
				);
			});

			it('should return user data: id, password, refreshToken on success', async () => {
				(verify as Mock).mockResolvedValue(true);

				const user = await validateCredentials(email, password);

				expect(user).toStrictEqual(userData);
			});
		});

		describe('handleLoginRefreshTokenReuse Function', () => {
			const callTestFn = async () => {
				const response = await handleLoginRefreshTokenReuse(
					userData,
					res as unknown as Response,
					refreshToken
				);
				return response;
			};

			beforeEach(() => {
				(userTokenExists as Mock).mockResolvedValue(userData);
				vi.clearAllMocks();
			});

			it('should clear refresh refreshToken cookie when old refresh refreshToken exists', async () => {
				await callTestFn();

				expect(clearRefreshTokenCookie).toHaveBeenCalledWith(res);
			});

			it('should return empty refresh refreshToken array when old refresh refreshToken does not exist in user table', async () => {
				(userTokenExists as Mock).mockResolvedValue(undefined);

				const tokenArray = await callTestFn();

				expect(tokenArray).toStrictEqual([]);
			});

			it('should log a message when old refresh refreshToken does not exist in user table', async () => {
				(userTokenExists as Mock).mockResolvedValue(undefined);

				await callTestFn();

				expect(console.info).toHaveBeenCalledWith(
					'Attempted refresh token reuse at login!'
				);
			});

			it('should return refreshTokenArray on success', async () => {
				const tokenArray = await callTestFn();

				expect(tokenArray).toStrictEqual(userData.refreshToken);
			});
		});
	});

	describe('Refresh Token', () => {
		const accessToken = createAccessToken(userData.id);
		const newRefreshToken = createRefreshToken(userData.id);

		const callTestFn = () => {
			handleRefreshTokenReuse(refreshToken, res as unknown as Response);
		};

		describe('handleRefreshTokenReuse Function', () => {
			beforeEach(() => {
				refreshToken = createRefreshToken(userData.id);
			});

			it('should call res.sendStatus with 403 when error is encountered while verifying refresh refreshToken', () => {
				vi.useFakeTimers({ shouldAdvanceTime: true });

				refreshToken = createRefreshToken(userData.id);

				vi.advanceTimersByTime(25 * 60 * 60 * 1000);

				callTestFn();
				expect(res.sendStatus).toHaveBeenCalledWith(403);
				vi.useRealTimers();
			});

			it('should log a message when refreshToken verification works', () => {
				(userExists as Mock).mockResolvedValue(undefined);

				callTestFn();

				expect(console.info).toHaveBeenCalledWith(
					'Attempted refresh token reuse!'
				);
			});

			it('should clear the refreshTokenArray of a user associated with the refresh refreshToken and log a message', async () => {
				(userExists as Mock).mockResolvedValue({ id: userData.id });

				callTestFn();

				await flushPromises();

				expect(updateUserById).toHaveBeenCalledWith({
					id: userData.id,
					refreshToken: [],
				});
			});
		});

		describe('processOldRefreshTokenForNew Function', () => {
			const callTestFn = () => {
				processOldRefreshTokenForNew(
					userData,
					refreshToken,
					tokenArray,
					res as unknown as Response
				);
			};

			beforeEach(() => {
				refreshToken = createRefreshToken(userData.id);

				(generateTokens as Mock).mockReturnValue({
					accessToken,
					refreshToken: newRefreshToken,
				});
				vi.clearAllMocks();
			});

			it('should update user record with new refresh refreshToken array and log a message when error is encountered while verifying refresh refreshToken', async () => {
				vi.useFakeTimers({ shouldAdvanceTime: true });
				refreshToken = createRefreshToken(userData.id);
				vi.advanceTimersByTime(25 * 60 * 60 * 1000);

				callTestFn();

				await flushPromises();

				expect(updateUserById).toHaveBeenCalledWith({
					id: userData.id,
					refreshToken: [...tokenArray],
				});

				expect(console.info).toHaveBeenCalledWith('Expired refresh token!');
				vi.useRealTimers();
			});

			it('should call res.sendStatus with 403 when error is encountered while verifying refresh refreshToken', async () => {
				vi.useFakeTimers({ shouldAdvanceTime: true });
				refreshToken = createRefreshToken(userData.id);
				vi.advanceTimersByTime(25 * 60 * 60 * 1000);

				callTestFn();

				await flushPromises();

				expect(res.sendStatus).toHaveBeenCalledWith(403);
				vi.useRealTimers();
			});

			it('should call res.sendStatus with 403 when user id does not match with decoded value', () => {
				refreshToken = createRefreshToken('random-user-id' as SUUID);

				callTestFn();

				expect(res.sendStatus).toHaveBeenCalledWith(403);
			});

			it('should update user record with new refresh refreshToken', async () => {
				callTestFn();

				await flushPromises();

				expect(updateUserById).toHaveBeenCalledWith({
					id: userData.id,
					refreshToken: [...tokenArray, newRefreshToken],
				});
			});

			it('should set new refresh refreshToken as cookie and call res.json with access refreshToken', async () => {
				callTestFn();

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
