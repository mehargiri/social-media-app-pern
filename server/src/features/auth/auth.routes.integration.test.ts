import app from '@/app.js';
import { db } from '@/db/index.js';
import { user } from '@/db/schema/user.js';
import {
	sampleEmail as email,
	getTestUserId,
	LoginResponseWithSuccess,
	samplePassword as password,
	ResponseWithError,
	SuperTestResponse,
	testUser,
} from '@/utils/test.utils.js';
import { eq } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import supertest from 'supertest';
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import { createRefreshToken } from './auth.utils.js';

const api = supertest(app);

const getTestUserTokenArray = async (email: string) => {
	const [result] = await db
		.select({ refreshToken: user.refreshToken })
		.from(user)
		.where(eq(user.email, email));

	return result?.refreshToken;
};

const cleanupTokens = async () => {
	// Clear all refresh tokens for the test user
	await db.update(user).set({ refreshToken: [] }).where(eq(user.email, email));
};

const consoleSpy = vi.spyOn(console, 'info');

describe('Auth Integration Tests', () => {
	beforeAll(async () => {
		vi.stubEnv('NODE_ENV', 'test');
		await db.insert(user).values(testUser);
	});

	afterAll(async () => {
		vi.unstubAllEnvs();
		await reset(db, { user });
	});

	beforeEach(async () => {
		await cleanupTokens();
	});

	describe('Login', () => {
		const testUrl = '/api/auth/login';

		it('should return HTTP 400 and a custom message for missing email', async () => {
			const response: ResponseWithError = await api
				.post(testUrl)
				.send({ email: '', password })
				.expect(400);

			expect(response.body.error).toEqual([
				'email: Email must be valid',
				'email: Email is required',
			]);
		});

		it('should return HTTP 400 and a custom message for missing password', async () => {
			const response: ResponseWithError = await api
				.post(testUrl)
				.send({ email, password: '' })
				.expect(400);

			expect(response.body.error).toEqual(['password: Password is required']);
		});

		it('should return HTTP 400 and a custom message for invalid email format', async () => {
			const response: ResponseWithError = await api
				.post(testUrl)
				.send({ email: 'myemail', password })
				.expect(400);

			expect(response.body.error).toEqual(['email: Email must be valid']);
		});

		it('should return HTTP 401 and a custom message for invalid email but valid password', async () => {
			const response: ResponseWithError = await api
				.post(testUrl)
				.send({ email: 'random@email.com', password })
				.expect(401);

			expect(response.body.error).toEqual('Invalid Credentials');
		});

		it('should return HTTP 401 and a custom message for invalid password but valid email', async () => {
			const response: ResponseWithError = await api
				.post(testUrl)
				.send({ email, password: 'random-password' })
				.expect(401);

			expect(response.body.error).toEqual('Invalid Credentials');
		});

		it('should login successfully with valid credentials', async () => {
			const response: LoginResponseWithSuccess = await api
				.post(testUrl)
				.send({ email, password })
				.expect(200);

			const cookie = response.headers['set-cookie']?.at(0);
			const cookieValue = cookie?.split('=').at(1)?.split(';').at(0);
			const userTokens = await getTestUserTokenArray(email);

			expect(response.body.accessToken).toBeDefined();

			expect(cookieValue).toBeDefined();
			expect(userTokens).toEqual([cookieValue]);
		});

		it('should handle normal login with valid refresh token', async () => {
			await cleanupTokens();

			const deviceALogin: LoginResponseWithSuccess = await api
				.post(testUrl)
				.send({ email, password })
				.expect(200);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const deviceACookie = deviceALogin.headers['set-cookie']?.at(0);
			const deviceARefreshToken = deviceACookie
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			const deviceBLogin: LoginResponseWithSuccess = await api
				.post(testUrl)
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				.set('Cookie', deviceACookie!)
				.send({ email, password })
				.expect(200);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const deviceBCookie = deviceBLogin.headers['set-cookie']?.at(1);
			const deviceBRefreshToken = deviceBCookie
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			expect(consoleSpy).not.toHaveBeenCalled();

			const userTokens = await getTestUserTokenArray(email);

			expect(userTokens).toContain(deviceBRefreshToken);
			expect(userTokens).not.toContain(deviceARefreshToken);
			expect(userTokens).toHaveLength(1);
		});

		it('should detect token reuse in multi-device theft scenario', async () => {
			await cleanupTokens();

			const deviceALogin: LoginResponseWithSuccess = await api
				.post(testUrl)
				.send({ email, password })
				.expect(200);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const deviceACookie = deviceALogin.headers['set-cookie']?.at(0);
			const deviceARefreshToken = deviceACookie
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			const deviceBLogin: LoginResponseWithSuccess = await api
				.post(testUrl)
				.send({ email, password })
				.expect(200);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const deviceBCookie = deviceBLogin.headers['set-cookie']?.at(0);
			const deviceBRefreshToken = deviceBCookie
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			const userTokens = await getTestUserTokenArray(email);
			expect(userTokens).toContain(deviceARefreshToken);
			expect(userTokens).toContain(deviceBRefreshToken);
			expect(userTokens).toHaveLength(2);

			// Simulate deviceAToken being stolen and used
			// by deleting the token from user's database
			await db
				.update(user)
				.set({
					refreshToken: userTokens?.filter((rt) => rt !== deviceARefreshToken),
				})
				.where(eq(user.email, email));

			const deviceCLogin: LoginResponseWithSuccess = await api
				.post(testUrl)
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				.set('Cookie', deviceACookie!)
				.send({ email, password })
				.expect(200);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const deviceCRefreshToken = deviceCLogin.headers['set-cookie']
				?.at(1)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			expect(consoleSpy).toHaveBeenCalledWith(
				'Attempted refresh token reuse at login!'
			);

			const finalTokens = await getTestUserTokenArray(email);

			expect(finalTokens).toEqual([deviceCRefreshToken]);
			expect(finalTokens).not.toContain(deviceARefreshToken);
			expect(finalTokens).not.toContain(deviceBRefreshToken);
			expect(finalTokens).toHaveLength(1);
		});
	});

	describe('Logout', () => {
		const testUrl = '/api/auth/logout';

		it('should return HTTP 204 when refresh token is not provided', async () => {
			const response = await api.post(testUrl).expect(204);
			expect(response.body).toEqual({});
		});

		it('should clear cookies and return HTTP 204 when refresh token does not exist in database', async () => {
			const userId = await getTestUserId(email);
			const oldRefreshToken = createRefreshToken(userId);
			const oldCookie = `tk=${oldRefreshToken}`;

			const response = await api
				.post(testUrl)
				.set('Cookie', oldCookie)
				.expect(204);

			const cookies = response.headers['set-cookie'];
			const cookieValue = cookies?.at(0)?.split('=').at(1)?.split(';').at(0);

			expect(cookies).toHaveLength(1);
			expect(cookieValue).toEqual('');
		});

		it('should successfully logout and invalidate refresh token', async () => {
			// Login first
			await cleanupTokens();
			const loginResponse: LoginResponseWithSuccess = await api
				.post('/api/auth/login')
				.send({ email, password })
				.expect(200);

			// await new Promise((resolve) => setTimeout(resolve, 1000));

			const refreshToken = loginResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			// Logout now
			const logoutResponse = await api
				.post(testUrl)
				.set('Cookie', `tk=${refreshToken}`)
				.expect(204);

			// await new Promise((resolve) => setTimeout(resolve, 1000));

			const logoutResponseRefreshToken = logoutResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			const userTokens = await getTestUserTokenArray(email);
			expect(userTokens).toHaveLength(0);
			expect(logoutResponseRefreshToken).toEqual('');
		});
	});

	describe('Refresh Token', () => {
		const testUrl = '/api/auth/refresh';
		const loginUrl = '/api/auth/login';

		beforeEach(() => {
			consoleSpy.mockClear();
		});

		it('should return HTTP 401 when refresh token is not provided', async () => {
			await api.post(testUrl).expect(401);
		});

		it('should return HTTP 403 when refresh token does not exist in database', async () => {
			const loginResponse: LoginResponseWithSuccess = await api
				.post(loginUrl)
				.send({ email, password })
				.expect(200);

			const refreshToken = loginResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			await db
				.update(user)
				.set({ refreshToken: [] })
				.where(eq(user.email, email));

			await api.post(testUrl).set('Cookie', `tk=${refreshToken}`).expect(403);
		});

		it('should handle refresh token reuse detection', async () => {
			// First Login
			const loginResponse: LoginResponseWithSuccess = await api
				.post(loginUrl)
				.send({ email, password })
				.expect(200);

			const refreshToken = loginResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			// Second Login
			await api.post(loginUrl).send({ email, password });

			const userTokens = await getTestUserTokenArray(email);

			await db
				.update(user)
				.set({ refreshToken: userTokens?.filter((rt) => rt !== refreshToken) })
				.where(eq(user.email, email));

			// Refresh Token
			await api.post(testUrl).set('Cookie', `tk=${refreshToken}`).expect(403);

			expect(consoleSpy).toHaveBeenCalledWith('Attempted refresh token reuse!');

			const finalTokens = await getTestUserTokenArray(email);
			expect(finalTokens).toHaveLength(0);
		});

		it('should return HTTP 403 for invalid refresh token during refresh token reuse detection', async () => {
			// First Login
			await api.post(loginUrl).send({ email, password }).expect(200);

			// Refresh Token
			await api.post(testUrl).set('Cookie', 'tk=refreshToken').expect(403);

			expect(consoleSpy).not.toHaveBeenCalled();
		});

		it('should return HTTP 403 when decoded user ID does not match database user ID', async () => {
			// Create new user
			await db.insert(user).values({
				firstName: 'Jane',
				lastName: 'Doe',
				email: 'random@email.com',
				password: testUser.password,
			});

			// Login new user
			const userALoginResponse: LoginResponseWithSuccess = await api
				.post(loginUrl)
				.send({ email: 'random@email.com', password });

			const userARefreshToken = userALoginResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			// Login as userB (the testUser)
			await api.post(loginUrl).send({ email, password });

			// Get userBTokens
			const userBTokens = await getTestUserTokenArray(email);

			// Simulate userA refresh token is used and remove from the database
			await db
				.update(user)
				.set({ refreshToken: [] })
				.where(eq(user.email, 'random@email.com'));

			// Add userARefreshToken to userB
			await db
				.update(user)
				.set({ refreshToken: [...(userBTokens ?? []), userARefreshToken] })
				.where(eq(user.email, email));

			// Refresh Token with userA's refresh token
			await api
				.post(testUrl)
				.set('Cookie', `tk=${userARefreshToken}`)
				.expect(403);
		});

		it('should return HTTP 403 for expired refresh token present in user database', async () => {
			await cleanupTokens();
			vi.useFakeTimers({ shouldAdvanceTime: true });

			const loginResponse: LoginResponseWithSuccess = await api
				.post(loginUrl)
				.send({ email, password })
				.expect(200);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const refreshToken = loginResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			vi.advanceTimersByTime(25 * 60 * 60 * 1000);

			await api.post(testUrl).set('Cookie', `tk=${refreshToken}`).expect(403);

			expect(consoleSpy).toHaveBeenCalledWith('Expired refresh token!');

			const userTokens = await getTestUserTokenArray(email);
			expect(userTokens).toHaveLength(0);
			vi.useRealTimers();
		});

		it('should clear old refresh token cookie, set new refresh token cookie and add new refresh token to user database on success', async () => {
			const loginResponse: LoginResponseWithSuccess = await api
				.post(loginUrl)
				.send({ email, password });

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const refreshToken = loginResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			const refreshResponse: SuperTestResponse<{ accessToken: string }> =
				await api.post(testUrl).set('Cookie', `tk=${refreshToken}`).expect(200);

			const cookies = refreshResponse.headers['set-cookie'];
			const clearRefreshToken = cookies
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			const newRefreshToken = cookies
				?.at(1)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			expect(cookies).toHaveLength(2);
			expect(clearRefreshToken).toEqual('');

			expect(refreshResponse.body.accessToken).toBeDefined();

			const userTokens = await getTestUserTokenArray(email);

			expect(userTokens).toContain(newRefreshToken);
			expect(userTokens).not.toContain(refreshToken);
		});
	});

	describe('Integration Flow Tests', () => {
		it('should complete full auth flow: login -> refresh -> logout', async () => {
			const loginResponse: LoginResponseWithSuccess = await api
				.post('/api/auth/login')
				.send({ email, password })
				.expect(200);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const refreshToken = loginResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			const refreshResponse: SuperTestResponse<{ accessToken: string }> =
				await api
					.post('/api/auth/refresh')
					.set('Cookie', `tk=${refreshToken}`)
					.expect(200);

			const newRefreshToken = refreshResponse.headers['set-cookie']
				?.at(1)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0) as unknown as string;

			const logoutResponse = await api
				.post('/api/auth/logout')
				.set('Cookie', `tk=${newRefreshToken}`)
				.expect(204);

			const logoutRefreshToken = logoutResponse.headers['set-cookie']
				?.at(0)
				?.split('=')
				.at(1)
				?.split(';')
				.at(0);

			const userTokens = await getTestUserTokenArray(email);

			expect(loginResponse.body.accessToken).toBeDefined();
			expect(refreshResponse.body.accessToken).toBeDefined();
			expect(refreshToken).not.toEqual(newRefreshToken);
			expect(logoutRefreshToken).toEqual('');
			expect(userTokens).toHaveLength(0);
		});

		it('should handle multiple concurrent logins from same user', async () => {
			// Login from device 1
			await api.post('/api/auth/login').send({ email, password }).expect(200);

			// Login from device 2
			await api.post('/api/auth/login').send({ email, password }).expect(200);

			// Login from device 3
			await api.post('/api/auth/login').send({ email, password }).expect(200);

			expect(consoleSpy).not.toHaveBeenCalled();

			const userTokens = await getTestUserTokenArray(email);

			expect(userTokens).toHaveLength(3);
		});
	});
});
