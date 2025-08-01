import app from '@/app.js';
import { db } from '@/db/index.js';
import { comment, post, user } from '@/db/schema/index.js';
import { createAccessToken } from '@/features/auth/auth.utils.js';
import { convertToSUUID } from '@/utils/general.utils.js';
import {
	createTestComment,
	createTestPost,
	createTestReply,
	ExtractResponseBody,
	ResponseWithError,
	SuperTestResponse,
	testUser,
} from '@/utils/test.utils.js';
import { reset } from 'drizzle-seed';
import { SUUID } from 'short-uuid';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getReplies } from './comment.controllers.js';

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const api = supertest(app);
const testPost = createTestPost();
const testComment = createTestComment();
const testReplies = Array.from({ length: 10 }).map(() => ({
	...createTestReply({ commentLevel: 1 }),
}));

describe('Reply Routes Integration Tests', () => {
	let authToken: string;
	let testUserSUUID: SUUID, testParentCommentSUUID: SUUID;

	beforeAll(async () => {
		const [testUserId] = await db
			.insert(user)
			.values(testUser)
			.returning({ id: user.id });

		testUserSUUID = convertToSUUID(testUserId?.id ?? '');

		const [testPostId] = await db
			.insert(post)
			.values({ ...testPost, userId: testUserId?.id ?? '' })
			.returning({ id: post.id });

		const [testCommentId] = await db
			.insert(comment)
			.values({
				...testComment,
				userId: testUserId?.id ?? '',
				postId: testPostId?.id ?? '',
			})
			.returning({ id: comment.id });

		testParentCommentSUUID = convertToSUUID(testCommentId?.id ?? '');

		testReplies.forEach((reply) => {
			reply.userId = (testUserId?.id ?? '') as unknown as SUUID;
			reply.postId = (testPostId?.id ?? '') as unknown as SUUID;
			reply.parentCommentId = (testCommentId?.id ?? '') as unknown as SUUID;
		});

		vi.useFakeTimers({ shouldAdvanceTime: true });

		await db
			.insert(comment)
			.values([...testReplies.slice(0, 5)])
			.returning({ id: comment.id });

		vi.advanceTimersByTime(2 * 60 * 1000);

		await db.insert(comment).values([...testReplies.slice(5)]);

		vi.useRealTimers();

		authToken = createAccessToken(testUserSUUID);
	});

	afterAll(async () => {
		await reset(db, { user, post, comment });
	});

	describe('GET replies route', () => {
		const testUrlBase = '/api/replies';
		let testUrl: string;

		beforeAll(() => {
			testUrl = `${testUrlBase}/${testParentCommentSUUID}`;
		});

		type GetRepliesResponse = SuperTestResponse<
			ExtractResponseBody<Parameters<typeof getReplies>['1']>
		>;

		const requiredProps = [
			'id',
			'postId',
			'content',
			'likesCount',
			'topLikeType1',
			'topLikeType2',
			'repliesCount',
			'createdAt',
			'updatedAt',
			'profilePic',
			'fullName',
			'userId',
		];

		it('should return HTTP 401 when the route is accessed without authentication', async () => {
			await api.get(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.get(testUrl).auth(authToken, { type: 'bearer' }).expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid parentCommentId', async () => {
			const response: ResponseWithError = await api
				.get(`${testUrlBase}/random`)
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toContain(
				'Valid id is required for parent comment'
			);
		});

		it('should return first 5 replies with required properties', async () => {
			const response: GetRepliesResponse = await api
				.get(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.replies).toHaveLength(5);

			requiredProps.forEach((prop) => {
				expect(response.body.replies[0]).toHaveProperty(prop);
			});

			response.body.replies.forEach((reply) => {
				expect(reply.parentCommentId).toEqual(testParentCommentSUUID);
			});
		});

		it('should return next 5 replies when cursor is provided', async () => {
			const firstResponse: GetRepliesResponse = await api
				.get(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = firstResponse.body.nextCursor ?? '';

			const cursorResponse: GetRepliesResponse = await api
				.get(`${testUrl}?cursor=${cursor}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const decodedCursorTime = new Date(
				Buffer.from(cursor, 'base64url').toString()
			).getTime();

			expect(cursorResponse.body.nextCursor).not.toBeNull();
			expect(cursorResponse.body.replies).toHaveLength(5);
			expect(
				new Date(cursorResponse.body.replies[0]?.createdAt ?? '').getTime()
			).toBeLessThan(decodedCursorTime);

			requiredProps.forEach((prop) => {
				expect(cursorResponse.body.replies[0]).toHaveProperty(prop);
			});

			cursorResponse.body.replies.forEach((reply) => {
				expect(reply.parentCommentId).toEqual(testParentCommentSUUID);
			});
		});
	});
});
