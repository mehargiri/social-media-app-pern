import app from '@/app.js';
import { db } from '@/db/index.js';
import { post, user } from '@/db/schema/index.js';
import { createAccessToken } from '@/features/auth/auth.utils.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import {
	createTestPost,
	createTestUser,
	ExtractResponseBody,
	getTestUserId,
	HTTPError400TestsType,
	ResponseWithError,
	SuperTestResponse,
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
import { getPosts } from './post.controllers.js';
import { PostType } from './post.zod.schemas.js';

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const api = supertest(app);

const post400Errors: HTTPError400TestsType<PostType>[] = [
	[
		'content is empty',
		'content',
		{ content: '' },
		'content: Content is required',
	],
	[
		'content has more than 10,000 characters',
		'content',
		{ content: 'A'.repeat(10001) },
		'content: Content cannot be more than 10,000 characters',
	],
	[
		'assets has an attached image that is not from an approved filetypes: png and jpeg',
		'assets',
		{
			assets: join(
				__dirname,
				'../../testAssets/blank-profile-picture-heic.heic'
			),
		},
		'Invalid file type. Allowed: png and jpg/jpeg. Invalid file in assets',
	],
	[
		'assets has an attached image that is too big',
		'assets',
		{
			assets: join(
				__dirname,
				'../../testAssets/blank-profile-picture-too-big.png'
			),
		},
		'File size exceeds the limit. Allowed max: 1MB',
	],
];

const testUser1 = createTestUser();
const testUser2 = createTestUser();
testUser2.email = 'test2@email.com';

const testUser1Posts = Array.from({ length: 10 }).map(() => {
	return createTestPost();
});

const testUser2Posts = Array.from({ length: 10 }).map(() => {
	return createTestPost();
});

describe('Post Routes Integration Tests', () => {
	let authToken: string;
	let testUser1SUUID: SUUID, testUser2SUUID: SUUID;
	let testPostsId: { id: string }[];

	beforeAll(async () => {
		await db.insert(user).values([testUser1, testUser2]);

		testUser1SUUID = await getTestUserId(testUser1.email);
		testUser2SUUID = await getTestUserId(testUser2.email);

		const testUser1Id = convertToUUID(testUser1SUUID);
		const testUser2Id = convertToUUID(testUser2SUUID);

		authToken = createAccessToken(testUser1SUUID);

		testUser1Posts.map((post) => (post.userId = testUser1Id));

		testUser2Posts.map((post) => (post.userId = testUser2Id));

		vi.useFakeTimers({ shouldAdvanceTime: true });

		const postIds = await db
			.insert(post)
			.values([...testUser1Posts.slice(0, 5), ...testUser2Posts.slice(0, 5)])
			.returning({ id: post.id });

		testPostsId = postIds;

		vi.advanceTimersByTime(2 * 60 * 1000);

		await db
			.insert(post)
			.values([...testUser1Posts.slice(5), ...testUser2Posts.slice(5)]);

		vi.useRealTimers();
	});

	afterAll(async () => {
		const assetPath = join(__dirname, '../../assets');
		await rm(assetPath, { recursive: true, force: true });
		await mkdir(assetPath);
		await reset(db, { user, post });
	});

	describe('GET posts route', () => {
		const testUrl = '/api/posts';

		type getPostsResponse = SuperTestResponse<
			ExtractResponseBody<Parameters<typeof getPosts>['1']>
		>;

		const requiredPropsPost = [
			'content',
			'postAssets',
			'profilePic',
			'fullName',
			'postCreatedAt',
			'postUpdatedAt',
		];

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.get(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.get(testUrl).auth(authToken, { type: 'bearer' }).expect(403);

			vi.useRealTimers();
		});

		it('should return total 5 posts with userId, content, postAssets, user profilePic, user fullName, postCreatedAt date, and postUpdatedAt date along with a nextCursor value when no query params is passed. 	should return the next 5 posts that was created before the cursor value with userId, content, postAssets, user profilePic, user fullName, postCreatedAt date, and postUpdatedAt date along with a nextCursor value when a query params of cursor is passed', async () => {
			const response: getPostsResponse = await api
				.get(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = response.body.nextCursor ?? '';

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.posts).toHaveLength(5);

			requiredPropsPost.forEach((prop) => {
				expect(response.body.posts[0]).toHaveProperty(prop);
			});

			const cursorResponse: getPostsResponse = await api
				.get(`${testUrl}?cursor=${cursor}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const decodedCursorTime = new Date(
				Buffer.from(cursor, 'base64url').toString()
			).getTime();

			expect(cursorResponse.body.nextCursor).not.toBeNull();
			expect(cursorResponse.body.posts).toHaveLength(5);
			expect(
				new Date(cursorResponse.body.posts[0]?.postCreatedAt ?? '').getTime()
			).toBeLessThan(decodedCursorTime);

			requiredPropsPost.forEach((prop) => {
				expect(cursorResponse.body.posts[0]).toHaveProperty(prop);
			});
		});

		it('should return total 5 posts, created by the logged in user, with userId, content, postAssets, user profilePic, user fullName, postCreatedAt date, and postUpdatedAt date along with a nextCursor value when a query params of user=me is passed. should return the next 5 posts that was created by the logged in user before the cursor value with userId, content, postAssets, user profilePic, user fullName, postCreatedAt date, and postUpdatedAt date along with a nextCursor value when a query params of cursor and user=me is passed', async () => {
			const response: getPostsResponse = await api
				.get(`${testUrl}?user=me`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = response.body.nextCursor ?? '';

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.posts).toHaveLength(5);
			expect(response.body.posts[0]?.fullName).toMatch(
				`${testUser1.firstName} ${testUser1.lastName}`
			);
			requiredPropsPost.forEach((prop) => {
				expect(response.body.posts[0]).toHaveProperty(prop);
			});

			const cursorResponse: getPostsResponse = await api
				.get(`${testUrl}?cursor=${cursor}&user=me`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const decodedCursorTime = new Date(
				Buffer.from(cursor, 'base64url').toString()
			).getTime();

			expect(cursorResponse.body.nextCursor).not.toBeNull();
			expect(cursorResponse.body.posts).toHaveLength(5);
			expect(cursorResponse.body.posts[0]?.fullName).toMatch(
				`${testUser1.firstName} ${testUser1.lastName}`
			);
			expect(
				new Date(cursorResponse.body.posts[0]?.postCreatedAt ?? '').getTime()
			).toBeLessThan(decodedCursorTime);

			requiredPropsPost.forEach((prop) => {
				expect(cursorResponse.body.posts[0]).toHaveProperty(prop);
			});

			const cursorResponseAgain: getPostsResponse = await api
				.get(
					`${testUrl}?cursor=${cursorResponse.body.nextCursor ?? ''}&user=me`
				)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(cursorResponseAgain.body.nextCursor).toBeNull();
			expect(cursorResponseAgain.body.posts).toHaveLength(0);
		});

		it('should return total 5 posts, created by the specific user, with userId, content, postAssets, user profilePic, user fullName, postCreatedAt date, and postUpdatedAt date along with a nextCursor value when a query params of userId is passed. should return the next 5 posts that was created by the specific user before the cursor value with userId, content, postAssets, user profilePic, user fullName, postCreatedAt date, and postUpdatedAt date along with a nextCursor value when a query params of cursor and userId is passed', async () => {
			const response: getPostsResponse = await api
				.get(`${testUrl}?user=${testUser2SUUID}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = response.body.nextCursor ?? '';

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.posts).toHaveLength(5);
			expect(response.body.posts[0]?.fullName).toMatch(
				`${testUser2.firstName} ${testUser2.lastName}`
			);
			requiredPropsPost.forEach((prop) => {
				expect(response.body.posts[0]).toHaveProperty(prop);
			});

			const cursorResponse: getPostsResponse = await api
				.get(`${testUrl}?cursor=${cursor}&user=${testUser2SUUID}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const decodedCursorTime = new Date(
				Buffer.from(cursor, 'base64url').toString()
			).getTime();

			expect(cursorResponse.body.nextCursor).not.toBeNull();
			expect(cursorResponse.body.posts).toHaveLength(5);
			expect(cursorResponse.body.posts[0]?.fullName).toMatch(
				`${testUser2.firstName} ${testUser2.lastName}`
			);
			expect(
				new Date(cursorResponse.body.posts[0]?.postCreatedAt ?? '').getTime()
			).toBeLessThan(decodedCursorTime);

			requiredPropsPost.forEach((prop) => {
				expect(cursorResponse.body.posts[0]).toHaveProperty(prop);
			});

			const cursorResponseAgain: getPostsResponse = await api
				.get(
					`${testUrl}?cursor=${cursorResponse.body.nextCursor ?? ''}&user=me`
				)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(cursorResponseAgain.body.nextCursor).toBeNull();
			expect(cursorResponseAgain.body.posts).toHaveLength(0);
		});
	});

	describe('Create posts route (POST)', () => {
		const testUrl = '/api/posts';
		let testPost: Partial<Omit<(typeof testUser1Posts)[0], 'assets'>>;

		beforeEach(() => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { assets, ...post } = { ...testUser1Posts[0] };
			testPost = post;
		});

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.post(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.post(testUrl).auth(authToken, { type: 'bearer' }).expect(403);

			vi.useRealTimers();
		});

		it.each(post400Errors)(
			'should return HTTP 400 when the post %s',
			async (_testDescription, property, obj, errMessage) => {
				if (property === 'content') testPost.content = obj[property] as string;

				const route = api
					.post(testUrl)
					.auth(authToken, { type: 'bearer' })
					.field(testPost);

				if (property === 'assets') {
					route.attach(property, obj[property] as string);
				}

				const response: ResponseWithError = await route.expect(400);
				expect(response.body.error).toEqual(
					property === 'assets' ? errMessage : [errMessage]
				);
			}
		);

		it('should return HTTP 201 on success', async () => {
			await api
				.post(testUrl)
				.auth(authToken, { type: 'bearer' })
				.field(testPost)
				.attach(
					'assets',
					join(__dirname, '../../testAssets/blank-profile-picture.png')
				)
				.expect(201);
		});
	});

	describe('Update posts route (PATCH)', () => {
		let testUrl: string;
		let postId: string;
		let testPost: Partial<Omit<(typeof testUser1Posts)[0], 'assets'>>;

		beforeEach(() => {
			postId = convertToSUUID(testPostsId[0]?.id ?? '');
			testUrl = `/api/posts/${postId}`;

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { assets, ...post } = { ...testUser1Posts[0] };
			testPost = post;
		});

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.patch(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.patch(testUrl).auth(authToken, { type: 'bearer' }).expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await api
				.patch('/api/posts/random-id')
				.auth(authToken, { type: 'bearer' })
				.field(testPost)
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for post');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but does not exist', async () => {
			const response: ResponseWithError = await api
				.patch(`/api/posts/${generate()}`)
				.auth(authToken, { type: 'bearer' })
				.field(testPost)
				.expect(404);

			expect(response.body.error).toEqual('Post does not exist');
		});

		it.each(post400Errors)(
			'should return HTTP 400 when the post %s',
			async (_testDescription, property, obj, errMessage) => {
				if (property === 'content') testPost.content = obj[property] as string;

				const route = api
					.patch(testUrl)
					.auth(authToken, { type: 'bearer' })
					.field(testPost);

				if (property === 'assets') {
					route.attach(property, obj[property] as string);
				}

				const response: ResponseWithError = await route.expect(400);
				expect(response.body.error).toEqual(
					property === 'assets' ? errMessage : [errMessage]
				);
			}
		);

		it('should return the post id on success when there are 3 images or less attached', async () => {
			const response: SuperTestResponse<{ id: string }> = await api
				.patch(testUrl)
				.auth(authToken, { type: 'bearer' })
				.field(testPost)
				.attach(
					'assets',
					join(__dirname, '../../testAssets/blank-profile-picture.png')
				)
				.attach(
					'assets',
					join(__dirname, '../../testAssets/blank-profile-picture.png')
				)
				.attach(
					'assets',
					join(__dirname, '../../testAssets/blank-profile-picture.png')
				)
				.expect(200);

			expect(response.body.id).toEqual(postId);
		});
	});

	describe('Delete post route (DELETE)', () => {
		let testUrl: string;
		let postId: string;

		beforeEach(() => {
			postId = convertToSUUID(testPostsId[0]?.id ?? '');
			testUrl = `/api/posts/${postId}`;
		});

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.delete(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.delete(testUrl).auth(authToken, { type: 'bearer' }).expect(403);
			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await api
				.delete('/api/posts/random-id')
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for post');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but does not exist', async () => {
			const response: ResponseWithError = await api
				.delete(`/api/posts/${generate()}`)
				.auth(authToken, { type: 'bearer' })
				.expect(404);

			expect(response.body.error).toEqual('Post does not exist');
		});

		it('should return a message saying post deleted successfully on success', async () => {
			const response: SuperTestResponse<{ message: string }> = await api
				.delete(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('Post deleted successfully');
		});
	});
});
