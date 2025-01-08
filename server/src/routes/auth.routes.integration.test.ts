/* eslint-disable @typescript-eslint/no-misused-promises */
import app from '@/app.js';
import { db } from '@/db/index.js';
import { user } from '@/db/schema/index.js';
import { updateUserById } from '@/services/user.services.js';
import { createRefreshToken } from '@/utils/auth.utils.js';
import { getTestUserId, samplePassword, testUser } from '@/utils/test.utils.js';
import { eq } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import supertest, { Response } from 'supertest';
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

const api = supertest(app);

const getTestUserTokenArray = async (email: string) => {
	const result = await db
		.select({ refreshToken: user.refreshToken })
		.from(user)
		.where(eq(user.email, email));
	return result[0]?.refreshToken;
};

describe('Auth Routes Integration Tests', () => {
	type SuperTestResponse<T> = Omit<Response, 'body'> & { body: T };

	type ResponseWithError = SuperTestResponse<{ error: string }>;
	type ResponseWithSuccess = SuperTestResponse<{ accessToken: string }>;

	beforeAll(async () => {
		vi.stubEnv('NODE_ENV', 'test');
		await db.insert(user).values(testUser);
	});

	afterAll(async () => {
		await reset(db, { user });
		vi.unstubAllEnvs();
	});

	describe('Login', () => {
		const testUrl = '/api/auth/login';

		const callTestRoute = async (
			loginDetails: { email: string; password: string },
			status: number,
			cookie?: string
		) => {
			const data = cookie
				? await api
						.post(testUrl)
						.set('Cookie', cookie)
						.send(loginDetails)
						.expect(status)
				: await api.post(testUrl).send(loginDetails).expect(status);
			return data;
		};

		it('should return HTTP 400 and a error message when email is empty', async () => {
			const response: ResponseWithError = await callTestRoute(
				{ email: '', password: samplePassword },
				400
			);

			expect(response.body.error).toContain('email: Email is required');
		});

		it('should return HTTP 400 and a error message when password is empty', async () => {
			const response: ResponseWithError = await callTestRoute(
				{ email: testUser.email, password: '' },
				400
			);

			expect(response.body.error).toContain('password: Password is required');
		});
		it('should return HTTP 401 and a error message when email is correct but password is incorrect', async () => {
			const response: ResponseWithError = await callTestRoute(
				{ email: testUser.email, password: 'random-password' },
				401
			);

			expect(response.body.error).toEqual('Invalid Credentials');
		});
		it('should return HTTP 401 and a error message when password is correct but email is incorrect', async () => {
			const response: ResponseWithError = await callTestRoute(
				{ email: 'random@email.com', password: samplePassword },
				401
			);

			expect(response.body.error).toEqual('Invalid Credentials');
		});

		it('should return accessToken as json, set refreshToken as cookie, and put refreshToken in user record on success', async () => {
			const response: ResponseWithSuccess = await callTestRoute(
				{ email: testUser.email, password: samplePassword },
				200
			);

			const cookie = response.headers['set-cookie']?.at(0);
			const cookieValue = cookie?.split('=')[1]?.split(';')[0];
			const tokenArray = await getTestUserTokenArray(testUser.email);

			expect(response.body.accessToken).toBeTruthy();

			expect(cookieValue).toBeDefined();
			expect(tokenArray).toContain(cookieValue);
		});

		it('should clear the refresh token array in user record if a cookie already exists in the request and the cookie is present in the user refresh token array', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			const userId = await getTestUserId(testUser.email);
			const oldRefreshToken = createRefreshToken(userId);
			const oldCookie = `tk=${oldRefreshToken}`;
			await updateUserById({ id: userId, refreshToken: [oldRefreshToken] });

			vi.advanceTimersByTime(15 * 60 * 1000);

			const response = await callTestRoute(
				{ email: testUser.email, password: samplePassword },
				200,
				oldCookie
			);

			const cookie = response.headers['set-cookie']?.at(1);
			const cookieValue = cookie?.split('=')[1]?.split(';')[0];
			const tokenArray = await getTestUserTokenArray(testUser.email);

			expect(cookieValue).not.toEqual(oldRefreshToken);
			expect(tokenArray).not.toContain(oldRefreshToken);
			vi.useRealTimers();
		});
	});

	describe('Logout', () => {
		const testUrl = '/api/auth/logout';

		const callTestRoute = async (cookie?: string) => {
			const data = cookie
				? await api.post(testUrl).set('Cookie', cookie).expect(204)
				: await api.post(testUrl).expect(204);

			const cookies = data.headers['set-cookie'];
			const cookieValue = cookies?.at(0)?.split('=')[1]?.split(';')[0];

			return { cookies, cookieValue };
		};

		it('should return HTTP 204 when there is no cookie (refreshToken) present', async () => {
			await callTestRoute();
		});

		it('should clear cookie and return HTTP 204 when there is no refreshToken in user record', async () => {
			const userId = await getTestUserId(testUser.email);
			const oldRefreshToken = createRefreshToken(userId);
			const oldCookie = `tk=${oldRefreshToken}`;

			const { cookies, cookieValue } = await callTestRoute(oldCookie);

			expect(cookies).toHaveLength(1);
			expect(cookieValue).toEqual('');
		});

		it('should remove refreshToken from user record, clear the cookie and return HTTP 204 on success', async () => {
			const userId = await getTestUserId(testUser.email);
			const oldRefreshToken = createRefreshToken(userId);
			const oldCookie = `tk=${oldRefreshToken}`;
			await updateUserById({ id: userId, refreshToken: [oldRefreshToken] });

			const { cookies, cookieValue } = await callTestRoute(oldCookie);

			const tokenArray = await getTestUserTokenArray(testUser.email);

			expect(cookies).toHaveLength(1);
			expect(cookieValue).toEqual('');
			expect(tokenArray).not.toContain(oldRefreshToken);
		});
	});

	describe('Refresh Token', () => {
		const testUrl = '/api/auth/refresh';

		const callTestRoute = async (status: number, cookie?: string) => {
			const data = cookie
				? await api.post(testUrl).set('Cookie', cookie).expect(status)
				: await api.post(testUrl).expect(status);
			return data;
		};

		beforeEach(() => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should return HTTP 401 when there is no cookie (refreshToken)', async () => {
			await callTestRoute(401);
		});

		it('should return HTTP 403 when the cookie (refreshToken) exists in request but not present in user record and is expired', async () => {
			const userId = await getTestUserId(testUser.email);
			const oldRefreshToken = createRefreshToken(userId);
			const oldCookie = `tk=${oldRefreshToken}`;

			vi.advanceTimersByTime(25 * 60 * 60 * 1000);

			await callTestRoute(403, oldCookie);
		});

		it('should clear user refreshToken array completely and return HTTP 403 when the cookie (refreshToken) exists in request but not present in user record and is valid', async () => {
			const userId = await getTestUserId(testUser.email);
			const oldRefreshToken = createRefreshToken(userId);
			await updateUserById({ id: userId, refreshToken: [oldRefreshToken] });

			vi.advanceTimersByTime(10 * 60 * 60 * 1000);

			const oldRefreshToken2 = createRefreshToken(userId);
			const oldCookie = `tk=${oldRefreshToken2}`;

			await callTestRoute(403, oldCookie);

			const tokenArray = await getTestUserTokenArray(testUser.email);
			expect(tokenArray).toHaveLength(0);
		});

		it('should remove the refreshToken from user record and return HTTP 403 when the cookie (refreshToken) exists in request, is present in user record, and is expired', async () => {
			const userId = await getTestUserId(testUser.email);
			const oldRefreshToken = createRefreshToken(userId);
			await updateUserById({
				id: userId,
				refreshToken: [oldRefreshToken],
			});

			vi.advanceTimersByTime(25 * 60 * 60 * 1000);

			const oldCookie = `tk=${oldRefreshToken}`;

			await callTestRoute(403, oldCookie);

			const tokenArray = await getTestUserTokenArray(testUser.email);
			expect(tokenArray).toHaveLength(0);
		});

		it('should clear cookie from request, add new refresh token to user record, set new refresh token as cookie to response and return accessToken as json when the cookie (refreshToken) exists in request, is present in user record, and is valid', async () => {
			const userId = await getTestUserId(testUser.email);
			const oldRefreshToken = createRefreshToken(userId);
			await updateUserById({
				id: userId,
				refreshToken: [oldRefreshToken],
			});

			const oldCookie = `tk=${oldRefreshToken}`;

			const response: ResponseWithSuccess = await callTestRoute(200, oldCookie);

			const cookies = response.headers['set-cookie'];
			const clearedCookie = cookies?.at(0)?.split('=')[1]?.split(';')[0];
			const newRefreshToken = cookies?.at(1)?.split('=')[1]?.split(';')[0];
			const accessToken = response.body.accessToken;

			const tokenArray = await getTestUserTokenArray(testUser.email);
			expect(tokenArray).toContain(newRefreshToken);

			expect(clearedCookie).toEqual('');
			expect(accessToken).toBeDefined();
		});
	});
});
