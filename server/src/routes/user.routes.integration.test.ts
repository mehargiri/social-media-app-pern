import app from '@/app.js';
import { db } from '@/db/index.js';
import {
	college,
	friendship,
	highSchool,
	user,
	work,
} from '@/db/schema/index.js';
import { findUserById, findUsersByName } from '@/services/user.services.js';
import { createAccessToken } from '@/utils/auth.utils.js';
import { convertToUUID } from '@/utils/general.utils.js';
import {
	createTestCollege,
	createTestHighSchool,
	createTestUser,
	createTestWork,
	getTestUserId,
	randomUserId,
	samplePassword,
	testUser,
} from '@/utils/test.utils.js';
import { reset } from 'drizzle-seed';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { generate, SUUID } from 'short-uuid';
import supertest, { Response } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const api = supertest(app);
const ARRAY_LENGTH = 5;

const testEmails = Array.from(Array(ARRAY_LENGTH).keys()).map(
	(item) => `test${item.toString()}@email.com`
);

const testUsers = Array.from({ length: ARRAY_LENGTH }, createTestUser).map(
	(user, i) => ({ ...user, email: testEmails[i] ?? '' })
);

const testCollege = createTestCollege();
const testWork = createTestWork();
const testHighSchool = createTestHighSchool();

describe('User Routes Integration Tests', () => {
	type SuperTestResponse<T> = Omit<Response, 'body'> & { body: T };
	type ResponseWithError = SuperTestResponse<{ error: string }>;
	type LoginResponseWithSuccess = SuperTestResponse<{ accessToken: string }>;

	type getUserResponseSuccess = NonNullable<
		Awaited<ReturnType<typeof findUserById>>
	>;

	type getUsersByNameResponseSuccess = NonNullable<
		Awaited<ReturnType<typeof findUsersByName>>
	>;

	const loginUrl = '/api/auth/login';
	const loginDetails = {
		email: testUsers[0]?.email ?? '',
		password: samplePassword,
	};
	let loginResponse: LoginResponseWithSuccess;
	let userId: SUUID, authToken: string;

	beforeAll(async () => {
		await db.insert(user).values(testUsers);

		const mainUserId = convertToUUID(await getTestUserId(loginDetails.email));

		testCollege.userId = mainUserId;
		testWork.userId = mainUserId;
		testHighSchool.userId = mainUserId;

		const testFriendShips = await Promise.all(
			testUsers.map(async (user) => ({
				userId: convertToUUID(await getTestUserId(user.email)),
				friendId: await randomUserId(testEmails, user.email),
			}))
		);

		await db.insert(friendship).values(testFriendShips);
		await db.insert(work).values(testCollege);
		await db.insert(highSchool).values(testHighSchool);
		await db.insert(college).values(testCollege);

		loginResponse = await api.post(loginUrl).send(loginDetails);
		userId = await getTestUserId(loginDetails.email);
		authToken = createAccessToken(userId);
	});

	afterAll(async () => {
		const assetPath = join(__dirname, '../assets');
		await rm(assetPath, { recursive: true, force: true });
		await mkdir(assetPath);
		await reset(db, { user, work, highSchool, college, friendship });
	});

	describe('GET me route', () => {
		const testUrl = '/api/user/me';

		const callTestFn = async (status: number, token?: string) => {
			const data = token
				? await api.get(testUrl).auth(token, { type: 'bearer' }).expect(status)
				: await api.get(testUrl).expect(status);
			return data;
		};

		it('should throw HTTP 401 if the route is accessed without auth token', async () => {
			await callTestFn(401);
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await callTestFn(
				400,
				createAccessToken('random-id' as SUUID)
			);

			expect(response.body.error).toEqual('Valid id is required');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but there is no user with the provided id in the database', async () => {
			const response: ResponseWithError = await callTestFn(
				404,
				createAccessToken(generate())
			);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return profile data including work, highSchool, college, and friends for logged user', async () => {
			const response: SuperTestResponse<getUserResponseSuccess> =
				await callTestFn(200, loginResponse.body.accessToken);

			expect(response.body.id).toBeDefined();
			expect(response.body.fullName).toBeDefined();
			expect(response.body.gender).toBeDefined();
			expect(response.body.phone).toBeDefined();
			expect(response.body.email).toBeDefined();
			expect(response.body.birthday).toBeDefined();
			expect(response.body.profilePic).toBeDefined();
			expect(response.body.coverPic).toBeDefined();
			expect(response.body.birthday).toBeDefined();
			expect(response.body.bio).toBeDefined();
			expect(response.body.currentCity).toBeDefined();
			expect(response.body.hometown).toBeDefined();
			expect(response.body.highSchool).toBeDefined();
			expect(response.body.college).toBeDefined();
			expect(response.body.work).toBeDefined();
			expect(response.body.friends).toBeDefined();
		});
	});

	describe('GET user with id route', () => {
		const callTestFn = async (
			status: number,
			token?: string,
			id: string = userId
		) => {
			const data = token
				? await api
						.get(`/api/user/${id}`)
						.auth(token, { type: 'bearer' })
						.expect(status)
				: await api.get(`/api/user/${id}`).expect(status);
			return data;
		};

		it('should throw HTTP 401 if the route is accessed without auth token', async () => {
			await callTestFn(401);
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await callTestFn(
				400,
				authToken,
				'random-id'
			);

			expect(response.body.error).toEqual('Valid id is required');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but there is no user with the provided id in the database', async () => {
			const response: ResponseWithError = await callTestFn(
				404,
				authToken,
				generate()
			);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return profile data including work, highSchool, college, and friends for the provided id of the user', async () => {
			const response: SuperTestResponse<getUserResponseSuccess> =
				await callTestFn(200, loginResponse.body.accessToken);

			expect(response.body.id).toBeDefined();
			expect(response.body.fullName).toBeDefined();
			expect(response.body.gender).toBeDefined();
			expect(response.body.phone).toBeDefined();
			expect(response.body.email).toBeDefined();
			expect(response.body.birthday).toBeDefined();
			expect(response.body.profilePic).toBeDefined();
			expect(response.body.coverPic).toBeDefined();
			expect(response.body.birthday).toBeDefined();
			expect(response.body.bio).toBeDefined();
			expect(response.body.currentCity).toBeDefined();
			expect(response.body.hometown).toBeDefined();
			expect(response.body.highSchool).toBeDefined();
			expect(response.body.college).toBeDefined();
			expect(response.body.work).toBeDefined();
			expect(response.body.friends).toBeDefined();
		});
	});

	describe('GET user with name route', () => {
		const testName = testUser.firstName;
		const testUrlBase = '/api/user/';

		const callTestFn = async (
			status: number,
			token?: string,
			queryValue?: string
		) => {
			const data = token
				? await api
						.get(testUrlBase)
						.auth(token, { type: 'bearer' })
						.query({ name: queryValue })
						.expect(status)
				: await api.get(testUrlBase).query({ name: queryValue }).expect(status);
			return data;
		};

		it('should throw HTTP 401 if the route is accessed without login', async () => {
			await callTestFn(401, undefined, testName);
		});

		it('should return HTTP 400 and a message when name is not provided', async () => {
			const response: ResponseWithError = await callTestFn(400, authToken);
			expect(response.body.error).toEqual('Name is required');
		});

		it('should return HTTP 404 and a message when there is no user with the provided name in the database', async () => {
			const response: ResponseWithError = await callTestFn(
				404,
				authToken,
				'Testing Please'
			);

			expect(response.body.error).toEqual('No user with the name exists');
		});

		it('should return id, fullName, and profilePic for the provided name of the user', async () => {
			const response: SuperTestResponse<getUsersByNameResponseSuccess> =
				await callTestFn(200, loginResponse.body.accessToken, testName);

			expect(response.body.length).toEqual(ARRAY_LENGTH);
			expect(response.body.at(0)?.fullName).toMatch(testName);
			expect(response.body.at(0)?.id).toBeDefined();
			expect(response.body.at(0)?.profilePic).toBeDefined();
		});
	});

	describe('Register new user', () => {
		const testUrl = '/api/user/register';
		let tempUser: typeof testUser & { phone: string; birthday: string };

		const callTestFn = async (status: number, message?: string) => {
			const response: ResponseWithError = await api
				.post(testUrl)
				.send(tempUser)
				.expect(status);

			if (message) {
				expect(response.body.error).toContain(message);
			}
		};

		beforeEach(() => {
			tempUser = { ...testUser, phone: '123-456-7581', birthday: '2025-01-01' };
		});

		it('should return HTTP 400 and a message when first name is empty in request body', async () => {
			tempUser.firstName = '';

			await callTestFn(400, 'firstName: First Name is required');
		});

		it('should return HTTP 400 and a message when first name is more than 260 characters', async () => {
			tempUser.firstName = 'A'.repeat(261);

			await callTestFn(
				400,
				'firstName: First Name cannot be more than 260 characters'
			);
		});

		it('should return HTTP 400 and a message when last name is empty in request body', async () => {
			tempUser.lastName = '';

			await callTestFn(400, 'lastName: Last Name is required');
		});

		it('should return HTTP 400 and a message when last name is more than 260 characters', async () => {
			tempUser.lastName = 'A'.repeat(261);

			await callTestFn(
				400,
				'lastName: Last Name cannot be more than 260 characters'
			);
		});

		it('should return HTTP 400 and a message when email is empty in request body', async () => {
			tempUser.email = '';

			await callTestFn(400, 'email: Email is required');
		});

		it('should return HTTP 400 and a message when email is not valid', async () => {
			tempUser.email = 'sampleemail';

			await callTestFn(400, 'email: Email must be valid');
		});

		it('should return HTTP 400 and a message when password is less than 8 characters', async () => {
			tempUser.password = 'pass';
			await callTestFn(
				400,
				'password: Password is required and must be minimum of 8 characters'
			);
		});

		it('should return HTTP 400 and a message when password is more than 8 characters but too simple', async () => {
			tempUser.password = 'Password1';

			await callTestFn(
				400,
				'password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces'
			);
		});

		it('should return HTTP 400 and a message when phone number is provided in incorrect format', async () => {
			tempUser.phone = '1234567891';

			await callTestFn(
				400,
				'phone: Phone number must be in format XXX-XXX-XXXX'
			);
		});

		it('should return HTTP 400 and a message when birthday is provided in incorrect format', async () => {
			tempUser.birthday = '20240101';

			await callTestFn(
				400,
				'birthday: Birthday must be valid date in YYYY-MM-DD format'
			);
		});

		it('should return HTTP 400 and a message when provided birthday is an invalid date', async () => {
			tempUser.birthday = '2024-02-32';

			await callTestFn(
				400,
				'birthday: Birthday must be valid date in YYYY-MM-DD format'
			);
		});

		it('should return HTTP 500 and a message when user creation failed due to same duplicate entry for the email field', async () => {
			tempUser.email = testUsers[0]?.email ?? '';

			await callTestFn(500, 'Something went wrong. Try again later!');
		});

		it('should return HTTP 201 on success', async () => {
			await callTestFn(201);
		});
	});

	describe('Update user with id route', () => {
		const tempUser = { ...testUsers[0] };
		const filePath = join(__dirname, '../../public/blank-profile-picture.png');

		it('should throw HTTP 401 if the route is accessed without login', async () => {
			await api.patch(`/api/user/${userId}`).field(tempUser).expect(401);
		}, 6000);

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/user/random-id`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.attach('coverImage', filePath)
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but there is no user with the provided id in the database', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/user/${generate()}`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.attach('coverImage', filePath)
				.expect(404);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return SUUID of the updated user on success with only coverImage attached', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.attach('coverImage', filePath)
				.expect(200);

			expect(response.body.id).toEqual(userId);
		});

		it('should return SUUID of the updated user on success with only profileImage attached', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.attach('profileImage', filePath)
				.expect(200);

			expect(response.body.id).toEqual(userId);
		});

		it('should return SUUID of the updated user on success with both images attached', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.attach('profileImage', filePath)
				.attach('coverImage', filePath)
				.expect(200);

			expect(response.body.id).toEqual(userId);
		});
	});

	describe('Delete user with id route', () => {
		it('should throw HTTP 401 if the route is accessed without login', async () => {
			await api.delete(`/api/user/${userId}`).expect(401);
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await api
				.delete('/api/user/random-id')
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required');
		});
		it('should return HTTP 404 and a message when the user deletion failed for some reason', async () => {
			const response: ResponseWithError = await api
				.delete(`/api/user/${generate()}`)
				.auth(authToken, { type: 'bearer' })
				.expect(404);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return a message saying user deleted successfully on success', async () => {
			const response: SuperTestResponse<{ message: string }> = await api
				.delete(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('User deleted successfully');
		});
	});
});
