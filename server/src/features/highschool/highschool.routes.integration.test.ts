import app from '@/app.js';
import { db } from '@/db/index.js';
import { highschool, user } from '@/db/schema/index.js';
import { convertToSUUID } from '@/utils/general.utils.js';
import {
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
import { HighschoolType } from './highschool.zod.schemas.js';

const testUser = createTestUser();
const sampleHighschool = {
	name: 'HighSchool Name',
	description: 'The best highschool ever!',
	startYear: 1900,
	endYear: 1905,
	graduated: true,
};

const api = supertest(app);

const highschool400Errors: HTTPError400TestsType<HighschoolType>[] = [
	[
		'name is more than 260 characters',
		'name',
		{ name: 'A'.repeat(261) },
		'name: Name cannot be more than 260 characters',
	],
	[
		'description is more than 1000 characters',
		'description',
		{ description: 'A'.repeat(1001) },
		'description: Description cannot be more than 1000 characters',
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
];

describe('Highschool Routes Integration Tests', () => {
	let authToken: string, userId: string, highschoolId: SUUID;

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
		await reset(db, { user, highschool });
	});

	const callTestRoute = async (
		type: 'create' | 'update',
		url: string,
		status: number,
		token?: string,
		data?: Partial<typeof sampleHighschool>,
		error?: string
	) => {
		const testApi = type === 'create' ? api.post(url) : api.patch(url);

		const response = token
			? await testApi
					.auth(authToken, { type: 'bearer' })
					.send(data)
					.expect(status)
			: await testApi.expect(status);

		if (error) {
			expect((response.body as ResponseWithError).error).toEqual([error]);
		}

		return response;
	};

	describe('Create New Highschool Route', () => {
		const testUrl = '/api/highschool';

		it('should throw HTTP 401 when the route is accessed without auth token', async () => {
			await callTestRoute('create', testUrl, 401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired auth token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await callTestRoute('create', testUrl, 403, authToken);
			vi.useRealTimers();
		});

		it.each(highschool400Errors)(
			'should throw HTTP 400 and a message when the highschool %s',
			async (_testDescription, property, obj, errMessage) => {
				await callTestRoute(
					'create',
					testUrl,
					400,
					authToken,
					{ ...sampleHighschool, [property]: obj[property] },
					errMessage
				);
			}
		);

		it('should return with HTTP 201 even when a field is missing', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { graduated, ...highschoolData } = sampleHighschool;
			await callTestRoute('create', testUrl, 201, authToken, highschoolData);

			await reset(db, { highschool });
		});

		it('should return with HTTP 201 on success', async () => {
			await callTestRoute('create', testUrl, 201, authToken, sampleHighschool);
		});
	});

	describe('Update Highschool Route', () => {
		let testUrl: string;

		beforeAll(async () => {
			const response = await db
				.insert(highschool)
				.values({ ...sampleHighschool, userId })
				.returning({ id: highschool.id });

			highschoolId = convertToSUUID(response[0]?.id ?? '');

			testUrl = `/api/highschool/${highschoolId}`;
		});

		it('should throw HTTP 401 when the route is accessed without auth token', async () => {
			await callTestRoute('update', testUrl, 401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired auth token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await callTestRoute('update', testUrl, 403, authToken);
			vi.useRealTimers();
		});

		it('should throw HTTP 400 and a message when the highschool id is not valid', async () => {
			const response: ResponseWithError = await api
				.patch('/api/highschool/random-id')
				.auth(authToken, { type: 'bearer' })
				.send(sampleHighschool)
				.expect(400);

			expect(response.body.error).toEqual(
				'Valid id is required for highschool'
			);
		});

		it('should throw HTTP 404 and a message when the highschool id is valid but does not exist', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/highschool/${sampleSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.send(sampleHighschool)
				.expect(404);

			expect(response.body.error).toEqual('Highschool does not exist');
		});

		it.each(highschool400Errors)(
			'should throw HTTP 400 and a message when the highschool %s',
			async (_testDescription, property, obj, errMessage) => {
				await callTestRoute(
					'update',
					testUrl,
					400,
					authToken,
					{ ...sampleHighschool, [property]: obj[property] },
					errMessage
				);
			}
		);

		it('should return highschool id even when a field is missing', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { graduated, ...highschoolData } = sampleHighschool;

			const response: SuperTestResponse<{ id: SUUID }> = await callTestRoute(
				'update',
				testUrl,
				200,
				authToken,
				highschoolData
			);

			expect(response.body.id).toEqual(highschoolId);
		});

		it('should return highschool id on success', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await callTestRoute(
				'update',
				testUrl,
				200,
				authToken,
				sampleHighschool
			);

			expect(response.body.id).toEqual(highschoolId);
		});
	});

	describe('Delete Highschool Route', () => {
		let testUrl: string;

		beforeAll(async () => {
			const response = await db
				.insert(highschool)
				.values({ ...sampleHighschool, userId })
				.returning({ id: highschool.id });

			highschoolId = convertToSUUID(response[0]?.id ?? '');

			testUrl = `/api/highschool/${highschoolId}`;
		});

		it('should throw HTTP 401 when the route is accessed without auth token', async () => {
			await api.delete(testUrl).expect(401);
		});

		it('should throw HTTP 403 when the route is accessed with an expired auth token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.delete(testUrl).auth(authToken, { type: 'bearer' }).expect(403);
			vi.useRealTimers();
		});

		it('should throw HTTP 400 and a message when the highschool id is not valid', async () => {
			const response: ResponseWithError = await api
				.delete('/api/highschool/random-id')
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual(
				'Valid id is required for highschool'
			);
		});

		it('should throw HTTP 404 and a message when the highschool id is valid but does not exist', async () => {
			const response: ResponseWithError = await api
				.delete(`/api/highschool/${sampleSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.expect(404);

			expect(response.body.error).toEqual('Highschool does not exist');
		});

		it('should return a message on success', async () => {
			const response: SuperTestResponse<{ message: string }> = await api
				.delete(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('Highschool deleted successfully');
		});
	});
});
