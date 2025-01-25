import app from '@/app.js';
import { db } from '@/db/index.js';
import { user, work } from '@/db/schema/index.js';
import { convertToSUUID } from '@/utils/general.utils.js';
import {
	createTestUser,
	createTestWork,
	LoginResponseWithSuccess,
	ResponseWithError,
	samplePassword,
	sampleSUUID,
	SuperTestResponse,
} from '@/utils/test.utils.js';
import { reset } from 'drizzle-seed';
import { SUUID } from 'short-uuid';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorkType } from './work.zod.schemas.js';

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const api = supertest(app);
const testUser = createTestUser();
const testWork = createTestWork();

type Work400ErrorType<T extends keyof WorkType> = [
	test_description: string,
	property: T,
	obj: Partial<Record<T, WorkType[T]>>,
	errMessage: string
];

const work400Errors: Work400ErrorType<keyof WorkType>[] = [
	[
		'company is more than 260 characters',
		'company',
		{ company: 'A'.repeat(261) },
		'company: Company cannot be more than 260 characters',
	],
	[
		'position is more than 260 characters',
		'position',
		{ position: 'A'.repeat(261) },
		'position: Position cannot be more than 260 characters',
	],
	[
		'city is more than 260 characters',
		'city',
		{ city: 'A'.repeat(261) },
		'city: City cannot be more than 260 characters',
	],
	[
		'description is more than 500 characters',
		'description',
		{ description: 'A'.repeat(501) },
		'description: Description cannot be more than 500 characters',
	],
	[
		'startYear is less than 1900',
		'startYear',
		{ startYear: 1899 },
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
];

describe('Work Routes Integration Tests', () => {
	let authToken: string, userId: string, workId: SUUID;

	beforeAll(async () => {
		const userResponse = await db
			.insert(user)
			.values(testUser)
			.returning({ id: user.id });

		userId = userResponse[0]?.id ?? '';

		const response: LoginResponseWithSuccess = await api
			.post('/api/auth/login')
			.send({ email: testUser.email, password: samplePassword });

		authToken = response.body.accessToken;
	});

	afterAll(async () => {
		await reset(db, { user, work });
	});

	describe('Create New Work Route', () => {
		const testUrl = '/api/work';

		it('should return HTTP 401 when the route is accessed without auth token', async () => {
			await api.post(testUrl).expect(401);
		});

		it.each(work400Errors)(
			'should return HTTP 400 and a message when the work %s',
			async (_testDescription, property, obj, errMessage) => {
				const response: ResponseWithError = await api
					.post(testUrl)
					.auth(authToken, { type: 'bearer' })
					.send({ ...testWork, [property]: obj[property] })
					.expect(400);

				expect(response.body.error).toContain(errMessage);
			}
		);

		it('should return HTTP 201 even when a field is missing', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { workingNow, ...workData } = testWork;

			await api
				.post(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(workData)
				.expect(201);

			await reset(db, { work });
		});

		it('should return HTTP 201 on success', async () => {
			await api
				.post(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(testWork)
				.expect(201);
		});
	});

	describe('Update Work Route', () => {
		let testUrl: string;

		beforeAll(async () => {
			const response = await db
				.insert(work)
				.values({ ...testWork, userId })
				.returning({ id: work.id });

			workId = convertToSUUID(response[0]?.id ?? '');

			testUrl = `/api/work/${workId}`;
		});

		it('should return HTTP 401 when the route is accessed without auth token', async () => {
			await api.patch(testUrl).expect(401);
		});

		it('should return HTTP 400 and a message when the work id is not valid', async () => {
			const response: ResponseWithError = await api
				.patch('/api/work/random-id')
				.auth(authToken, { type: 'bearer' })
				.send(testWork)
				.expect(400);

			expect(response.body.error).toContain('Valid id is required');
		});

		it('should return HTTP 404 and a message when the work id is valid but does not exist', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/work/${sampleSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.send(testWork)
				.expect(404);

			expect(response.body.error).toContain('Work does not exist');
		});

		it.each(work400Errors)(
			'should return HTTP 400 and a message when the work %s',
			async (_testDescription, property, obj, errMessage) => {
				const response: ResponseWithError = await api
					.patch(testUrl)
					.auth(authToken, { type: 'bearer' })
					.send({ ...testWork, [property]: obj[property] })
					.expect(400);

				expect(response.body.error).toContain(errMessage);
			}
		);

		it('should return updated id even when a field is missing', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { workingNow, ...workData } = testWork;

			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(workData)
				.expect(200);

			expect(response.body.id).toEqual(workId);
		});

		it('should return updated id on success', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send(testWork)
				.expect(200);

			expect(response.body.id).toEqual(workId);
		});
	});

	describe('Delete Work Route', () => {
		let testUrl: string;

		beforeAll(async () => {
			const response = await db
				.insert(work)
				.values({ ...testWork, userId })
				.returning({ id: work.id });

			workId = convertToSUUID(response[0]?.id ?? '');

			testUrl = `/api/work/${workId}`;
		});

		it('should return HTTP 401 when the route is accessed without auth token', async () => {
			await api.delete(testUrl).expect(401);
		});

		it('should return HTTP 400 and a message when the work id is invalid', async () => {
			const response: ResponseWithError = await api
				.delete('/api/work/random-id')
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toContain('Valid id is required');
		});

		it('should return HTTP 404 and a message when the work id is valid but does not exist', async () => {
			const response: ResponseWithError = await api
				.delete(`/api/work/${sampleSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.expect(404);

			expect(response.body.error).toContain('Work does not exist');
		});

		it('should return a message on success', async () => {
			const response: SuperTestResponse<{ message: string }> = await api
				.delete(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toContain('Work deleted successfully');
		});
	});
});
