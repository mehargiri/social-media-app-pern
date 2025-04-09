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
			reply.userId = testUserId?.id ?? '';
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

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api
				.get(`${testUrlBase}?parentCommentId=${testParentCommentSUUID}`)
				.expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api
				.get(`${testUrlBase}?parentCommentId=${testParentCommentSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid parentCommentId', async () => {
			const response: ResponseWithError = await api
				.get(`${testUrlBase}?parentCommentId=random`)
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual(
				'Valid id is required for parent comment'
			);
		});

		it('should return total 5 replies with id, postId, content, likesCount, topLikeType1, topLikeType2, repliesCount, createdAt, updatedAt, user fullName, user profilePic along with a nextCursor value when a query params of parentCommentId is only passed. should return the next 5 replies that was created before the cursor value with id, postIdm content, likesCount, topLikeType1, topLikeType2, repliesCount, createdAt, updatedAt, user fullName, user profilePic along with a nextCUrsor value when query params of parentCommentId and cursor is passed', async () => {
			type getRepliesResponse = SuperTestResponse<
				ExtractResponseBody<Parameters<typeof getReplies>['1']>
			>;

			const requiredPropsReply = [
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

			const response: getRepliesResponse = await api
				.get(`${testUrlBase}?parentCommentId=${testParentCommentSUUID}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = response.body.nextCursor ?? '';

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.replies).toHaveLength(5);

			requiredPropsReply.forEach((prop) => {
				expect(response.body.replies[0]).toHaveProperty(prop);
			});

			const cursorResponse: getRepliesResponse = await api
				.get(
					`${testUrlBase}?parentCommentId=${testParentCommentSUUID}&cursor=${cursor}`
				)
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

			requiredPropsReply.forEach((prop) => {
				expect(cursorResponse.body.replies[0]).toHaveProperty(prop);
			});
		});
	});
});
