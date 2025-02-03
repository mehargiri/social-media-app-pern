import app from '@/app.js';
import { db } from '@/db/index.js';
import {
	college,
	friendship,
	highschool,
	user,
	work,
} from '@/db/schema/index.js';
import { createAccessToken } from '@/features/auth/auth.utils.js';
import { convertToUUID } from '@/utils/general.utils.js';
import {
	createTestCollege,
	createTestHighSchool,
	createTestUser,
	createTestWork,
	getTestUserId,
	HTTPError400TestsType,
	LoginResponseWithSuccess,
	randomUserId,
	ResponseWithError,
	samplePassword,
	SuperTestResponse,
	testUser,
} from '@/utils/test.utils.js';
import { reset } from 'drizzle-seed';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { generate, SUUID } from 'short-uuid';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { findUserById, findUsersByName } from './user.services.js';
import { UserType } from './user.zod.schemas.js';

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

const userHTTP400Errors: HTTPError400TestsType<UserType>[] = [
	[
		'first name is empty',
		'firstName',
		{ firstName: '' },
		'firstName: First Name is required',
	],
	[
		'first name is more than 260 characters',
		'firstName',
		{ firstName: 'A'.repeat(261) },
		'firstName: First Name cannot be more than 260 characters',
	],
	[
		'last name is empty',
		'lastName',
		{ lastName: '' },
		'lastName: Last Name is required',
	],
	[
		'last name is more than 260 characters',
		'lastName',
		{ lastName: 'A'.repeat(261) },
		'lastName: Last Name cannot be more than 260 characters',
	],
	['email is empty', 'email', { email: '' }, 'email: Email is required'],
	[
		'email is not valid',
		'email',
		{ email: 'email.com' },
		'email: Email must be valid',
	],
	[
		'password is empty',
		'password',
		{ password: '' },
		'password: Password is required and must be minimum of 8 characters',
	],
	[
		'password is less than 8 characters',
		'password',
		{ password: 'A'.repeat(7) },
		'password: Password is required and must be minimum of 8 characters',
	],
	[
		'password has no uppercase but length is more than 8 characters',
		'password',
		{ password: 'mypassword1@' },
		'password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces',
	],
	[
		'password has no number but length is more than 8 characters',
		'password',
		{ password: 'Mypassword@' },
		'password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces',
	],
	[
		'password has no special character but length is more than 8 characters',
		'password',
		{ password: 'Mypassword1' },
		'password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces',
	],
	[
		'password has no special character but length is more than 8 characters',
		'password',
		{ password: 'Mypassword1' },
		'password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces',
	],
	[
		'password has a space in the middle but length is more than 8 characters',
		'password',
		{ password: 'My password1@' },
		'password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces',
	],
	[
		'phone is in the wrong format',
		'phone',
		{ phone: '1234567890' },
		'phone: Phone number must be in format XXX-XXX-XXXX',
	],
	[
		'birthday is in the wrong format',
		'birthday',
		{ birthday: '20200101' },
		'birthday: Birthday must be valid date in YYYY-MM-DD format',
	],
	[
		'birthday is not a valid date',
		'birthday',
		{ birthday: '2020-01-32' },
		'birthday: Birthday must be valid date in YYYY-MM-DD format',
	],
	[
		'bio is more than 1000 characters',
		'bio',
		{ bio: 'A'.repeat(1001) },
		'bio: Bio cannot be more than 1000 characters',
	],
	[
		'current city is more than 260 characters',
		'currentCity',
		{ currentCity: 'A'.repeat(261) },
		'currentCity: Current city cannot be more than 260 characters',
	],
	[
		'hometown is more than 260 characters',
		'hometown',
		{ hometown: 'A'.repeat(261) },
		'hometown: Hometown cannot be more than 260 characters',
	],
];

describe('User Routes Integration Tests', () => {
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
		await db.insert(highschool).values(testHighSchool);
		await db.insert(college).values(testCollege);

		loginResponse = await api.post(loginUrl).send(loginDetails);
		userId = await getTestUserId(loginDetails.email);
		authToken = createAccessToken(userId);
	});

	afterAll(async () => {
		const assetPath = join(__dirname, '../../assets');
		await rm(assetPath, { recursive: true, force: true });
		await mkdir(assetPath);
		await reset(db, { user, work, highschool, college, friendship });
	});

	describe('GET me route', () => {
		const testUrl = '/api/user/me';

		const callTestRoute = async (status: number, token?: string) => {
			const testApi = api.get(testUrl);
			if (token) testApi.auth(token, { type: 'bearer' });
			const data = await testApi.expect(status);
			return data;
		};

		it('should throw HTTP 401 when the route is accessed without auth token', async () => {
			await callTestRoute(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });

			vi.advanceTimersByTime(2 * 60 * 1000);

			await callTestRoute(403, authToken);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await callTestRoute(
				400,
				createAccessToken('random-id' as SUUID)
			);

			expect(response.body.error).toEqual('Valid id is required');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but there is no user with the provided id in the database', async () => {
			const response: ResponseWithError = await callTestRoute(
				404,
				createAccessToken(generate())
			);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return profile data including work, highSchool, college, and friends for logged user', async () => {
			const response: SuperTestResponse<getUserResponseSuccess> =
				await callTestRoute(200, loginResponse.body.accessToken);

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
		const callTestRoute = async (
			status: number,
			token?: string,
			id: string = userId
		) => {
			const testApi = api.get(`/api/user/${id}`);
			if (token) testApi.auth(token, { type: 'bearer' });
			const data = await testApi.expect(status);
			return data;
		};

		it('should throw HTTP 401 when the route is accessed without auth token', async () => {
			await callTestRoute(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });

			vi.advanceTimersByTime(2 * 60 * 1000);

			await callTestRoute(403, authToken);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await callTestRoute(
				400,
				authToken,
				'random-id'
			);

			expect(response.body.error).toEqual('Valid id is required');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but there is no user with the provided id in the database', async () => {
			const response: ResponseWithError = await callTestRoute(
				404,
				authToken,
				generate()
			);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return profile data including work, highSchool, college, and friends for the provided id of the user', async () => {
			const response: SuperTestResponse<getUserResponseSuccess> =
				await callTestRoute(200, loginResponse.body.accessToken);

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

		const callTestRoute = async (
			status: number,
			token?: string,
			queryValue?: string
		) => {
			const testApi = api.get(testUrlBase);
			if (token) testApi.auth(token, { type: 'bearer' });
			const data = await testApi.query({ name: queryValue }).expect(status);
			return data;
		};

		it('should throw HTTP 401 when the route is accessed without login', async () => {
			await callTestRoute(401, undefined, testName);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });

			vi.advanceTimersByTime(2 * 60 * 1000);

			await callTestRoute(403, authToken);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when name is not provided', async () => {
			const response: ResponseWithError = await callTestRoute(400, authToken);
			expect(response.body.error).toEqual('Name is required');
		});

		it('should return HTTP 404 and a message when there is no user with the provided name in the database', async () => {
			const response: ResponseWithError = await callTestRoute(
				404,
				authToken,
				'Testing Please'
			);

			expect(response.body.error).toEqual('No user with the name exists');
		});

		it('should return id, fullName, and profilePic for the provided name of the user', async () => {
			const response: SuperTestResponse<getUsersByNameResponseSuccess> =
				await callTestRoute(200, loginResponse.body.accessToken, testName);

			expect(response.body.length).toEqual(ARRAY_LENGTH);
			expect(response.body.at(0)?.fullName).toMatch(testName);
			expect(response.body.at(0)?.id).toBeDefined();
			expect(response.body.at(0)?.profilePic).toBeDefined();
		});
	});

	describe('Register new user', () => {
		const testUrl = '/api/user/register';
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const tempUser = testUsers[0]!;
		tempUser.phone = '123-456-7890';

		const callTestRoute = async (
			status: number,
			data?: (typeof testUsers)[number],
			message?: string
		) => {
			const response: ResponseWithError = await api
				.post(testUrl)
				.send(data)
				.expect(status);

			if (message) {
				expect(response.body.error).toContain(message);
			}
		};

		it.each(userHTTP400Errors)(
			'should return HTTP 400 and a message when %s',
			async (_testDescription, property, obj, errMessage) => {
				await callTestRoute(
					400,
					{
						...tempUser,
						[property]: obj[property],
					},
					errMessage
				);
			}
		);

		it('should return HTTP 500 and a message when user creation failed due to same duplicate entry for the email field', async () => {
			await callTestRoute(
				500,
				tempUser,
				'Something went wrong. Try again later!'
			);
		});

		it('should return HTTP 201 on success', async () => {
			await callTestRoute(201, {
				...tempUser,
				firstName: 'Test',
				lastName: 'User',
				email: 'email@email.com',
				password: 'Mypassword@123',
			});
		});
	});

	describe('Update user with id route', () => {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const tempUser = testUsers[0]!;
		tempUser.phone = '123-456-7890';
		const filePath = join(
			__dirname,
			'../../testAssets/blank-profile-picture.png'
		);

		const badExtensionFilePath = join(
			__dirname,
			'../../testAssets/blank-profile-picture-heic.heic'
		);

		const tooBigFilePath = join(
			__dirname,
			'../../testAssets/blank-profile-picture-too-big.png'
		);

		it('should throw HTTP 401 when the route is accessed without login', async () => {
			await api.patch(`/api/user/${userId}`).field(tempUser).expect(401);
		}, 6000);

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api
				.patch(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.expect(403);

			vi.useRealTimers();
		});

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

		it.each(userHTTP400Errors)(
			'should return HTTP 400 and a message when %s',
			async (_testDescription, property, obj, errMessage) => {
				const response: ResponseWithError = await api
					.patch(`/api/user/${userId}`)
					.auth(authToken, { type: 'bearer' })
					.field({ ...tempUser, [property]: obj[property] })
					.attach('coverImage', filePath)
					.expect(400);

				expect(response.body.error).toContain(errMessage);
			}
		);

		it('should return HTTP 400 and a message when attached image is not an approved filetypes: png and jpeg', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.attach('coverImage', badExtensionFilePath)
				.expect(400);

			expect(response.body.error).toEqual(
				'Invalid file type. Allowed: png and jpg/jpeg. Invalid file in coverImage'
			);
		});

		it('should return HTTP 400 and a message when attached image is too big', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.field(tempUser)
				.attach('coverImage', tooBigFilePath)
				.expect(400);

			expect(response.body.error).toEqual(
				'File size exceeds the limit. Allowed max: 1MB'
			);
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
		it('should throw HTTP 401 when the route is accessed without login', async () => {
			await api.delete(`/api/user/${userId}`).expect(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });

			vi.advanceTimersByTime(2 * 60 * 1000);

			await api
				.delete(`/api/user/${userId}`)
				.auth(authToken, { type: 'bearer' })
				.expect(403);

			vi.useRealTimers();
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
