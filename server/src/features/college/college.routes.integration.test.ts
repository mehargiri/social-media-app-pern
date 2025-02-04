import app from '@/app.js';
import { db } from '@/db/index.js';
import { college, user } from '@/db/schema/index.js';
import { convertToSUUID } from '@/utils/general.utils.js';
import {
	createTestCollege,
	createTestUser,
	HTTPError400TestsType,
	LoginResponseWithSuccess,
	ResponseWithError,
	samplePassword,
	sampleSUUID,
	SuperTestResponse,
} from '@/utils/test.utils.js';
import { reset } from 'drizzle-seed';
import { SUUID } from 'short-uuid';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CollegeType } from './college.zod.schemas.js';

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const api = supertest(app);
const testUser = createTestUser();
const testCollege = createTestCollege();

const college400Errors: HTTPError400TestsType<CollegeType>[] = [
	[
		'name is more than 260 characters',
		'name',
		{ name: 'A'.repeat(261) },
		'name: Name cannot be more than 260 characters',
	],
	[
		'description is more than 500 characters',
		'description',
		{ description: 'A'.repeat(501) },
		'description: Description cannot be more than 500 characters',
	],
	[
		'major1 is more than 260 characters',
		'major1',
		{ major1: 'A'.repeat(261) },
		'major1: Major1 cannot be more than 260 characters',
	],
	[
		'major2 is more than 260 characters',
		'major2',
		{ major2: 'A'.repeat(261) },
		'major2: Major2 cannot be more than 260 characters',
	],
	[
		'major3 is more than 260 characters',
		'major3',
		{ major3: 'A'.repeat(261) },
		'major3: Major3 cannot be more than 260 characters',
	],
	[
		'degree is more than 260 characters',
		'degree',
		{ degree: 'A'.repeat(261) },
		'degree: Degree cannot be more than 260 characters',
	],
	[
		'startYear is less than 1900',
		'startYear',
		{ startYear: 1889 },
		'startYear: Start Year cannot be less than 1900',
	],
	[
		'startYear is more than 9998',
		'startYear',
		{ startYear: 9999 },
		'startYear: Start Year cannot be more than 9998',
	],
	[
		'endYear is less than 1901',
		'endYear',
		{ endYear: 1900 },
		'endYear: End Year cannot be less than 1901',
	],
	[
		'endYear is more than 9999',
		'endYear',
		{ endYear: 10000 },
		'endYear: End Year cannot be more than 9999',
	],
	[
		'type has an unknown value',
		'type',
		{ type: 'randomValue' },
		'type: Invalid type provided. Accepted values are: college, graduate_school, university.',
	],
];

describe('College Routes Integration Tests', () => {
	let authToken: string, userId: string, collegeId: SUUID;

	beforeAll(async () => {
		const response = await db
			.insert(user)
			.values(testUser)
			.returning({ id: user.id });

		userId = response[0]?.id ?? '';

		const loginResponse: LoginResponseWithSuccess = await api
			.post('/api/auth/login')
			.send({ email: testUser.email, password: samplePassword });

		authToken = loginResponse.body.accessToken;
	});

	afterAll(async () => {
		await reset(db, { user, college });
	});
	describe('Create New College Route', () => {
		const testUrl = '/api/college';

		it('should return HTTP 401 when the route is accessed without auth token', async () => {
			await api.post(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired auth token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.post(testUrl).auth(authToken, { type: 'bearer' }).expect(403);
			vi.useRealTimers();
		});

		it.each(college400Errors)(
			'should return HTTP 400 and a message when the college %s',
			async (_testDescription, property, obj, errMessage) => {
				const response: ResponseWithError = await api
					.post(testUrl)
					.auth(authToken, { type: 'bearer' })
					.send({ ...testCollege, [property]: obj[property] })
					.expect(400);

				expect(response.body.error).toContain(errMessage);
			}
		);

		it('should return HTTP 201 even when a field is missing', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { type, ...collegeData } = testCollege;

			await api
				.post(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(collegeData)
				.expect(201);

			await reset(db, { college });
		});

		it('should return HTTP 201 on success', async () => {
			await api
				.post(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(testCollege)
				.expect(201);
		});
	});

	describe('Update College Route', () => {
		let testUrl: string;

		beforeAll(async () => {
			const response = await db
				.insert(college)
				.values({ ...testCollege, userId })
				.returning({ id: college.id });

			collegeId = convertToSUUID(response[0]?.id ?? '');
			testUrl = `/api/college/${collegeId}`;
		});

		it('should return HTTP 401 when the route is accessed without auth token', async () => {
			await api.patch(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired auth token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.patch(testUrl).auth(authToken, { type: 'bearer' }).expect(403);
			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the college id is not valid', async () => {
			const response: ResponseWithError = await api
				.patch('/api/college/random-id')
				.auth(authToken, { type: 'bearer' })
				.send(testCollege)
				.expect(400);

			expect(response.body.error).toContain('Valid id is required');
		});

		it('should return HTTP 404 and a message when the college id is valid but does not exist', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/college/${sampleSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.send(testCollege)
				.expect(404);

			expect(response.body.error).toContain('College does not exist');
		});

		it.each(college400Errors)(
			'should return HTTP 400 and a message when the college %s',
			async (_testDescription, property, obj, errMessage) => {
				const response: ResponseWithError = await api
					.patch(testUrl)
					.auth(authToken, { type: 'bearer' })
					.send({ ...testCollege, [property]: obj[property] })
					.expect(400);

				expect(response.body.error).toContain(errMessage);
			}
		);

		it('should return college id even when a field is missing', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { type, ...collegeData } = testCollege;

			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(collegeData)
				.expect(200);

			expect(response.body.id).toEqual(collegeId);
		});

		it('should return college id on success', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(testCollege)
				.expect(200);

			expect(response.body.id).toEqual(collegeId);
		});
	});

	describe('Delete College Route', () => {
		let testUrl: string;

		beforeAll(async () => {
			const response = await db
				.insert(college)
				.values({ ...testCollege, userId })
				.returning({ id: college.id });

			collegeId = convertToSUUID(response[0]?.id ?? '');
			testUrl = `/api/college/${collegeId}`;
		});

		it('should return HTTP 401 when the route is accessed without auth token', async () => {
			await api.delete(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired auth token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.delete(testUrl).auth(authToken, { type: 'bearer' }).expect(403);
			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the college id is not valid', async () => {
			const response: ResponseWithError = await api
				.delete('/api/college/random-id')
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toContain('Valid id is required');
		});

		it('should return HTTP 400 and a message when the college id is valid but does not exist', async () => {
			const response: ResponseWithError = await api
				.delete(`/api/college/${sampleSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.expect(404);

			expect(response.body.error).toContain('College does not exist');
		});

		it('should return a message on success', async () => {
			const response: SuperTestResponse<{ message: string }> = await api
				.delete(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('College deleted successfully');
		});
	});
});
