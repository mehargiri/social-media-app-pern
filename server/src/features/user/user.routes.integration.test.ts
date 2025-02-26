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
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import {
	createTestCollege,
	createTestHighSchool,
	createTestUser,
	createTestWork,
	ExtractResponseBody,
	getTestUserId,
	HTTPError400TestsType,
	randomUserId,
	ResponseWithError,
	SuperTestResponse,
	testUser,
} from '@/utils/test.utils.js';
import { reset } from 'drizzle-seed';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { generate, SUUID } from 'short-uuid';
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
import { getUser, getUsersByName } from './user.controllers.js';
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

const createUserHTTP400Errors: HTTPError400TestsType<UserType>[] = [
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
	[
		'email is empty',
		'email',
		{ email: '' },
		'email: Email is required; email: Email must be valid',
	],
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
		'password: Password is required and must be minimum of 8 characters; password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces',
	],
	[
		'password is less than 8 characters',
		'password',
		{ password: 'A'.repeat(7) },
		'password: Password is required and must be minimum of 8 characters; password: Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces',
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
		'birthday: Birthday must be in YYYY-MM-DD format; birthday: Birthday must be valid date in YYYY-MM-DD format',
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

const updateUserHTTP400Errors: HTTPError400TestsType<UserType>[] = [
	...createUserHTTP400Errors,
	[
		'profilePic has an attached image that is not from an approved filetypes: png and jpeg',
		'profilePic',
		{
			profilePic: join(
				__dirname,
				'../../testAssets/blank-profile-picture-heic.heic'
			),
		},
		'Invalid file type. Allowed: png and jpg/jpeg. Invalid file in profilePic',
	],
	[
		'profilePic has an attached image that is too big',
		'profilePic',
		{
			profilePic: join(
				__dirname,
				'../../testAssets/blank-profile-picture-too-big.png'
			),
		},
		'File size exceeds the limit. Allowed max: 1MB',
	],
	[
		'coverPic has an attached image that is not from an approved filetypes: png and jpeg',
		'coverPic',
		{
			coverPic: join(
				__dirname,
				'../../testAssets/blank-profile-picture-heic.heic'
			),
		},
		'Invalid file type. Allowed: png and jpg/jpeg. Invalid file in coverPic',
	],
	[
		'coverPic has an attached image that is too big',
		'coverPic',
		{
			coverPic: join(
				__dirname,
				'../../testAssets/blank-profile-picture-too-big.png'
			),
		},
		'File size exceeds the limit. Allowed max: 1MB',
	],
];

const getTestUrl = (id?: string) => `/api/user/${id ?? ''}`;

interface RequestOptions {
	method: 'get' | 'post' | 'patch' | 'delete';
	url: string;
	token?: string;
	query?: Record<string, string>;
	data?: Record<string, string>;
	useField?: boolean;
	imageAttachments?: Record<string, string>;
}

const performRequest = (options: RequestOptions) => {
	const req = api[options.method](options.url);
	if (options.token) req.auth(options.token, { type: 'bearer' });
	if (options.query) req.query(options.query);
	if (options.data) {
		if (options.useField) req.field(options.data);
		else req.send(options.data);
	}
	if (options.imageAttachments) {
		for (const [field, path] of Object.entries(options.imageAttachments)) {
			req.attach(field, path);
		}
	}
	return req;
};

describe('User Routes Integration Tests', () => {
	type getUserResponse = SuperTestResponse<
		ExtractResponseBody<Parameters<typeof getUser>['1']>
	>;

	type getUsersByNameResponse = SuperTestResponse<
		ExtractResponseBody<Parameters<typeof getUsersByName>['1']>
	>;

	type WithoutNulls<T, K extends keyof T> = Omit<T, K> & {
		[P in K]: Exclude<T[P], null | undefined>;
	};

	let userId: SUUID, authToken: string, testUrl: string;

	beforeAll(async () => {
		const userIds = await db
			.insert(user)
			.values(testUsers)
			.returning({ id: user.id });

		const mainUserId = { ...userIds[0] } as NonNullable<(typeof userIds)[0]>;

		testCollege.userId = mainUserId.id;
		testWork.userId = mainUserId.id;
		testHighSchool.userId = mainUserId.id;

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

		userId = convertToSUUID(mainUserId.id);
		authToken = createAccessToken(userId);
	});

	afterAll(async () => {
		const assetPath = join(__dirname, '../../assets');
		await rm(assetPath, { recursive: true, force: true });
		await mkdir(assetPath);
		await reset(db, { user, work, highschool, college, friendship });
	});

	describe('GET me route', () => {
		const testUrl = getTestUrl('me');

		it('should throw HTTP 401 when the route is accessed without auth token', async () => {
			await performRequest({ method: 'get', url: testUrl }).expect(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
			}).expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'get',
				url: testUrl,
				token: createAccessToken('random-id' as SUUID),
			}).expect(400);

			expect(response.body.error).toEqual('Valid id is required for user');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but user does not exist', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'get',
				url: testUrl,
				token: createAccessToken(generate()),
			}).expect(404);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return profile data including work, highSchool, college, and friends for logged user', async () => {
			const response: getUserResponse = await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
			}).expect(200);

			expect(response.body?.id).toBeDefined();
			expect(response.body?.fullName).toBeDefined();
			expect(response.body?.gender).toBeDefined();
			expect(response.body?.phone).toBeDefined();
			expect(response.body?.email).toBeDefined();
			expect(response.body?.birthday).toBeDefined();
			expect(response.body?.profilePic).toBeDefined();
			expect(response.body?.coverPic).toBeDefined();
			expect(response.body?.birthday).toBeDefined();
			expect(response.body?.bio).toBeDefined();
			expect(response.body?.currentCity).toBeDefined();
			expect(response.body?.hometown).toBeDefined();
			expect(response.body?.highSchool).toBeDefined();
			expect(response.body?.college).toBeDefined();
			expect(response.body?.work).toBeDefined();
			expect(response.body?.friends).toBeDefined();
		});
	});

	describe('GET user with id route', () => {
		beforeEach(() => {
			testUrl = getTestUrl(userId);
		});

		it('should throw HTTP 401 when the route is accessed without auth token', async () => {
			await performRequest({ method: 'get', url: testUrl }).expect(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
			}).expect(403);
			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'get',
				url: getTestUrl('random-id'),
				token: authToken,
			}).expect(400);

			expect(response.body.error).toEqual('Valid id is required for user');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but user does not exist', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'get',
				url: getTestUrl(generate()),
				token: authToken,
			}).expect(404);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return profile data including work, highSchool, college, and friends for the provided id of the user', async () => {
			const response: getUserResponse = await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
			}).expect(200);

			expect(response.body?.id).toBeDefined();
			expect(response.body?.fullName).toBeDefined();
			expect(response.body?.gender).toBeDefined();
			expect(response.body?.phone).toBeDefined();
			expect(response.body?.email).toBeDefined();
			expect(response.body?.birthday).toBeDefined();
			expect(response.body?.profilePic).toBeDefined();
			expect(response.body?.coverPic).toBeDefined();
			expect(response.body?.birthday).toBeDefined();
			expect(response.body?.bio).toBeDefined();
			expect(response.body?.currentCity).toBeDefined();
			expect(response.body?.hometown).toBeDefined();
			expect(response.body?.highSchool).toBeDefined();
			expect(response.body?.college).toBeDefined();
			expect(response.body?.work).toBeDefined();
			expect(response.body?.friends).toBeDefined();
		});
	});

	describe('GET user with name route', () => {
		const testName = testUser.firstName;
		beforeEach(() => {
			testUrl = getTestUrl();
		});

		it('should throw HTTP 401 when the route is accessed without login', async () => {
			await performRequest({
				method: 'get',
				url: testUrl,
				query: { name: testName },
			}).expect(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
				query: { name: testName },
			}).expect(403);
			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when name is not provided', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
			}).expect(400);
			expect(response.body.error).toEqual('Name is required');
		});

		it('should return HTTP 404 and a message when there is no user with the provided name in the database', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
				query: { name: 'Testing Please' },
			}).expect(404);

			expect(response.body.error).toEqual('No user with the name exists');
		});

		it('should return matching users (id, fullName, profilePic)', async () => {
			const response: getUsersByNameResponse = await performRequest({
				method: 'get',
				url: testUrl,
				token: authToken,
				query: { name: testName },
			}).expect(200);

			expect(response.body.length).toEqual(ARRAY_LENGTH);
			expect(response.body.at(0)?.fullName).toMatch(testName);
			expect(response.body.at(0)?.id).toBeDefined();
			expect(response.body.at(0)?.profilePic).toBeDefined();
		});
	});

	describe('Register new user', () => {
		const testUrl = getTestUrl('register');
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { profilePic, coverPic, ...userWithoutImages } = {
			...testUsers[0],
			phone: '123-456-7890',
		};

		const tempUser = userWithoutImages as WithoutNulls<
			typeof userWithoutImages,
			'bio' | 'currentCity' | 'birthday' | 'phone' | 'gender' | 'hometown'
		>;

		it.each(createUserHTTP400Errors)(
			'should return HTTP 400 and a message when %s',
			async (_testDescription, property, obj, errMessage) => {
				const errMessages = errMessage.split('; ');
				const response: ResponseWithError = await performRequest({
					method: 'post',
					url: testUrl,
					data: { ...tempUser, [property]: obj[property] },
				});

				expect(response.body.error).toEqual([...errMessages]);
			}
		);

		it('should return HTTP 500 and a message when user creation failed due to same duplicate entry for the email field', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'post',
				url: testUrl,
				data: tempUser,
			}).expect(500);

			expect(response.body.error).toEqual(
				'Something went wrong. Try again later!'
			);
		});

		it('should return HTTP 201 on success', async () => {
			await performRequest({
				method: 'post',
				url: testUrl,
				data: {
					...tempUser,
					firstName: 'Test',
					lastName: 'User',
					email: 'email@email.com',
					password: 'Mypassword@123',
				},
			}).expect(201);
		});
	});

	describe('Update user with id route', () => {
		const filePath = join(
			__dirname,
			'../../testAssets/blank-profile-picture.png'
		);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { profilePic, coverPic, ...userWithoutPic } = {
			...testUsers[0],
			phone: '123-456-7890',
		};

		const tempUser = userWithoutPic as WithoutNulls<
			typeof userWithoutPic,
			'birthday' | 'gender' | 'bio' | 'currentCity' | 'hometown'
		>;

		beforeEach(() => {
			testUrl = getTestUrl(userId);
		});

		it('should throw HTTP 401 when the route is accessed without login', async () => {
			await performRequest({
				method: 'patch',
				url: testUrl,
				data: tempUser,
				useField: true,
			}).expect(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await performRequest({
				method: 'patch',
				url: testUrl,
				token: authToken,
				data: tempUser,
				useField: true,
			}).expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'patch',
				url: getTestUrl('random-id'),
				token: authToken,
				data: tempUser,
				useField: true,
			}).expect(400);

			expect(response.body.error).toEqual('Valid id is required for user');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but user does not exist', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'patch',
				url: getTestUrl(generate()),
				token: authToken,
				data: tempUser,
				useField: true,
			}).expect(404);

			expect(response.body.error).toEqual('User does not exist');
		});

		it.each(updateUserHTTP400Errors)(
			'should return HTTP 400 and a message when %s',
			async (_testDescription, property, obj, errMessage) => {
				const errMessages = errMessage.split('; ');
				const options: RequestOptions = {
					method: 'patch',
					url: testUrl,
					token: authToken,
					data: { ...tempUser, [property]: obj[property] },
					useField: true,
				};

				if (['profilePic', 'coverPic'].includes(property)) {
					options.imageAttachments = {
						[property]: obj[property] as typeof property,
					};
				}

				const response: ResponseWithError = await performRequest(
					options
				).expect(400);
				expect(response.body.error).toEqual(
					property === 'coverPic' || property === 'profilePic'
						? errMessage
						: [...errMessages]
				);
			}
		);

		it('should return SUUID of the updated user on success with only coverImage attached', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await performRequest({
				method: 'patch',
				url: testUrl,
				token: authToken,
				data: tempUser,
				useField: true,
				imageAttachments: { coverPic: filePath },
			}).expect(200);

			expect(response.body.id).toEqual(userId);
		});

		it('should return SUUID of the updated user on success with only profileImage attached', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await performRequest({
				method: 'patch',
				url: testUrl,
				token: authToken,
				data: tempUser,
				useField: true,
				imageAttachments: { profilePic: filePath },
			}).expect(200);

			expect(response.body.id).toEqual(userId);
		});

		it('should return SUUID of the updated user on success with both images attached', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await performRequest({
				method: 'patch',
				url: testUrl,
				token: authToken,
				data: tempUser,
				useField: true,
				imageAttachments: { profilePic: filePath, coverPic: filePath },
			}).expect(200);

			expect(response.body.id).toEqual(userId);
		});
	});

	describe('Delete user with id route', () => {
		beforeEach(() => {
			testUrl = getTestUrl(userId);
		});

		it('should throw HTTP 401 when the route is accessed without login', async () => {
			await performRequest({ method: 'delete', url: testUrl }).expect(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await performRequest({
				method: 'delete',
				url: testUrl,
				token: authToken,
			}).expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'delete',
				url: getTestUrl('random-id'),
				token: authToken,
			}).expect(400);

			expect(response.body.error).toEqual('Valid id is required for user');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but user does not exist', async () => {
			const response: ResponseWithError = await performRequest({
				method: 'delete',
				url: getTestUrl(generate()),
				token: authToken,
			}).expect(404);

			expect(response.body.error).toEqual('User does not exist');
		});

		it('should return a message saying user deleted successfully on success', async () => {
			const response: SuperTestResponse<{ message: string }> =
				await performRequest({
					method: 'delete',
					url: testUrl,
					token: authToken,
				}).expect(200);

			expect(response.body.message).toEqual('User deleted successfully');
		});
	});
});
