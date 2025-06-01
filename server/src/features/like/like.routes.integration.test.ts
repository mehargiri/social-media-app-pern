import app from '@/app.js';
import { db } from '@/db/index.js';
import { comment, like, post, user } from '@/db/schema/index.js';
import { createAccessToken } from '@/features/auth/auth.utils.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import {
	createTestComment,
	createTestLike,
	createTestPost,
	createTestUser,
	ExtractResponseBody,
	ResponseWithError,
	sampleSUUID,
	SuperTestResponse,
	testUser,
} from '@/utils/test.utils.js';
import { and, eq } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import { SUUID } from 'short-uuid';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDetailedLikes } from './like.controllers.js';

const api = supertest(app);

const testUsers = Array.from({ length: 10 }).map((_, index) => ({
	...createTestUser(),
	email: `test${index.toString()}@gmail.com`,
}));

const testPost = createTestPost();
const testComment = createTestComment();

const testLikesForPost = Array.from({ length: 10 }).map(() => ({
	...createTestLike(),
}));

const testLikesForComment = Array.from({ length: 10 }).map(() => ({
	...createTestLike(),
}));

const testUrlBase = '/api/likes';

describe('Like Routes Integration Tests', () => {
	let authToken: string,
		testUserSUUID: SUUID,
		testPostSUUID: SUUID,
		testCommentSUUID: SUUID;

	beforeAll(async () => {
		const [originalTestUserId] = await db
			.insert(user)
			.values(testUser)
			.returning({ id: user.id });

		testUserSUUID = convertToSUUID(originalTestUserId?.id ?? '');

		const testUsersIds = await db
			.insert(user)
			.values(testUsers)
			.returning({ id: user.id });

		const [testPostId] = await db
			.insert(post)
			.values({ ...testPost, userId: originalTestUserId?.id ?? '' })
			.returning({ id: post.id });

		testPostSUUID = convertToSUUID(testPostId?.id ?? '');

		const [testCommentId] = await db
			.insert(comment)
			.values({
				...testComment,
				userId: originalTestUserId?.id ?? '',
				postId: testPostId?.id ?? '',
			})
			.returning({ id: comment.id });

		testCommentSUUID = convertToSUUID(testCommentId?.id ?? '');

		vi.useFakeTimers({ shouldAdvanceTime: true });

		testLikesForPost.forEach((testLike, index) => {
			testLike.userId = testUsersIds.at(index)?.id ?? '';
			testLike.postId = (testPostId?.id ?? '') as unknown as SUUID;
			testLike.commentId = null;
		});

		testLikesForComment.forEach((testLike, index) => {
			testLike.userId = testUsersIds.at(index)?.id ?? '';
			testLike.commentId = (testCommentId?.id ?? '') as unknown as SUUID;
			testLike.postId = null;
		});

		await db
			.insert(like)
			.values([
				...testLikesForPost.slice(0, 5),
				...testLikesForComment.slice(0, 5),
			])
			.returning({ id: like.id });

		vi.advanceTimersByTime(2 * 60 * 1000);

		await db
			.insert(like)
			.values([...testLikesForPost.slice(5), ...testLikesForComment.slice(5)]);

		await db
			.update(post)
			.set({ commentsCount: 1, likesCount: 10 })
			.where(eq(post.id, testPostId?.id ?? ''));

		await db
			.update(comment)
			.set({ likesCount: 10 })
			.where(eq(comment.id, testCommentId?.id ?? ''));

		vi.useRealTimers();

		authToken = createAccessToken(testUserSUUID);
	});

	afterAll(async () => {
		await reset(db, { user, post, comment, like });
	});

	const testUrl = (entityType: 'post' | 'comment', entityId: SUUID) => {
		return `${testUrlBase}?${
			entityType === 'post' ? 'postId' : 'commentId'
		}=${entityId}`;
	};

	describe('GET likes route', () => {
		type getLikesResponse = SuperTestResponse<
			ExtractResponseBody<Parameters<typeof getDetailedLikes>['1']>
		>;

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.get(testUrl('post', testPostSUUID)).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api
				.get(testUrl('post', testPostSUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the route is accessed with both valid postId and commentId', async () => {
			const response: ResponseWithError = await api
				.get(
					`${testUrlBase}?postId=${testPostSUUID}&commentId=${testCommentSUUID}`
				)
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual(
				'Exactly one of postId or commentId must be provided'
			);
		});

		it('should return HTTP 400 and a message when the route is accessed without valid postId and commentId', async () => {
			const response: ResponseWithError = await api
				.get(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual(
				'Exactly one of postId or commentId must be provided'
			);
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid postId', async () => {
			const response: ResponseWithError = await api
				.get(testUrl('post', 'random-id' as SUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for post');
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid commentId', async () => {
			const response: ResponseWithError = await api
				.get(testUrl('comment', 'random-id' as SUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for comment');
		});

		it('should return total 5 likes with postId, userId, type, fullName, profilePic, createdAt along with a nextCursor value when a query params of postId is only passed. should return the next 5 likes that was created before the cursor value with postId, userId, type, fullName, profilePic, createdAt along with a nextCursor value when query params of postId and cursor is passed. should return likes that belong to a single post.', async () => {
			const requiredPropsLike = [
				'postId',
				'userId',
				'type',
				'fullName',
				'profilePic',
				'createdAt',
			];

			const response: getLikesResponse = await api
				.get(testUrl('post', testPostSUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = response.body.nextCursor ?? '';

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.likes).toHaveLength(5);

			requiredPropsLike.forEach((prop) => {
				expect(response.body.likes?.at(0)).toHaveProperty(prop);
			});

			response.body.likes?.forEach((like) => {
				expect(like.postId).not.toEqual(sampleSUUID);
				expect(like.commentId).toBeUndefined();
				expect(like.userId).not.toEqual(testUserSUUID);
			});

			const cursorResponse: getLikesResponse = await api
				.get(`${testUrl('post', testPostSUUID)}&cursor=${cursor}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const decodedCursorTime = new Date(
				Buffer.from(cursor, 'base64url').toString()
			).getTime();

			expect(cursorResponse.body.nextCursor).not.toBeNull();
			expect(cursorResponse.body.likes).toHaveLength(5);
			expect(
				new Date(cursorResponse.body.likes?.at(0)?.createdAt ?? '').getTime()
			).toBeLessThan(decodedCursorTime);

			requiredPropsLike.forEach((prop) => {
				expect(cursorResponse.body.likes?.at(0)).toHaveProperty(prop);
			});

			cursorResponse.body.likes?.forEach((like) => {
				expect(like.postId).not.toEqual(sampleSUUID);
				expect(like.commentId).toBeUndefined();
				expect(like.userId).not.toEqual(testUserSUUID);
			});
		});

		it('should return total 5 likes with commentId, userId, type, fullName, profilePic, createdAt along with a nextCursor value when a query params of commentId is only passed. should return the next 5 likes that was created before the cursor value with commentId, userId, type, fullName, profilePic, createdAt along with a nextCursor value when query params of commentId and cursor is passed. should return likes that belong to a single comment.', async () => {
			const requiredPropsLike = [
				'commentId',
				'userId',
				'type',
				'fullName',
				'profilePic',
				'createdAt',
			];

			const response: getLikesResponse = await api
				.get(testUrl('comment', testCommentSUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = response.body.nextCursor ?? '';

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.likes).toHaveLength(5);

			requiredPropsLike.forEach((prop) => {
				expect(response.body.likes?.at(0)).toHaveProperty(prop);
			});

			response.body.likes?.forEach((like) => {
				expect(like.commentId).not.toEqual(sampleSUUID);
				expect(like.postId).toBeUndefined();
				expect(like.userId).not.toEqual(testUserSUUID);
			});

			const cursorResponse: getLikesResponse = await api
				.get(`${testUrl('comment', testCommentSUUID)}&cursor=${cursor}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const decodedCursorTime = new Date(
				Buffer.from(cursor, 'base64url').toString()
			).getTime();

			expect(cursorResponse.body.nextCursor).not.toBeNull();
			expect(cursorResponse.body.likes).toHaveLength(5);
			expect(
				new Date(cursorResponse.body.likes?.at(0)?.createdAt ?? '').getTime()
			).toBeLessThan(decodedCursorTime);

			requiredPropsLike.forEach((prop) => {
				expect(cursorResponse.body.likes?.at(0)).toHaveProperty(prop);
			});

			cursorResponse.body.likes?.forEach((like) => {
				expect(like.commentId).not.toEqual(sampleSUUID);
				expect(like.postId).toBeUndefined();
				expect(like.userId).not.toEqual(testUserSUUID);
			});
		});
	});

	describe('Create/Update likes route (POST)', () => {
		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.post(testUrlBase).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });

			vi.advanceTimersByTime(2 * 60 * 1000);
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({ ...testLikesForPost.at(0), postId: testPostSUUID })
				.expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the route is accessed with both valid postId and commentId', async () => {
			const response: ResponseWithError = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					postId: testPostSUUID,
					commentId: testCommentSUUID,
				})
				.expect(400);

			expect(response.body.error).toEqual(
				'Exactly one of postId or commentId must be provided'
			);
		});

		it('should return HTTP 400 and a message when the route is accessed without valid postId and commentId', async () => {
			const response: ResponseWithError = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({ ...testLikesForPost.at(0), postId: null, commentId: null })
				.expect(400);

			expect(response.body.error).toEqual(
				'Exactly one of postId or commentId must be provided'
			);
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid postId', async () => {
			const response: ResponseWithError = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					postId: 'random-id',
					commentId: null,
				})
				.expect(400);

			expect(response.body.error).toEqual([
				'postId: Valid id is required for post',
			]);
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid commentId', async () => {
			const response: ResponseWithError = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					postId: null,
					commentId: 'random-id',
				})
				.expect(400);

			expect(response.body.error).toEqual([
				'commentId: Valid id is required for comment',
			]);
		});

		it('should return HTTP 500, a message and rollback for like creation or update if an error occurs', async () => {
			const response: ResponseWithError = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					postId: testPostSUUID,
					userId: testUserSUUID,
					forceError: true,
				})
				.expect(500);

			expect(response.body.error).toEqual(
				'Forced transaction error for like upsert'
			);

			const totalLikesofPost = await db
				.select({ id: like.id })
				.from(like)
				.where(eq(like.postId, convertToUUID(testPostSUUID)));

			expect(totalLikesofPost).toHaveLength(10);

			const [postData] = await db
				.select({ likesCount: post.likesCount })
				.from(post)
				.where(eq(post.id, convertToUUID(testPostSUUID)));
			expect(postData?.likesCount).toEqual(10);
		});

		it('should return HTTP 201 on successful like creation for a post. Post should have the like count of 11.', async () => {
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					postId: testPostSUUID,
					commentId: null,
				})
				.expect(201);

			const [postData] = await db
				.select({ likesCount: post.likesCount })
				.from(post)
				.where(eq(post.id, convertToUUID(testPostSUUID)));
			expect(postData?.likesCount).toEqual(11);

			// Delete the newly created like and update the post like count
			const [postLike] = await db
				.select({ id: like.id })
				.from(like)
				.where(
					and(
						eq(like.postId, convertToUUID(testPostSUUID)),
						eq(like.userId, convertToUUID(testUserSUUID))
					)
				);

			await db.delete(like).where(eq(like.id, postLike?.id ?? ''));
			await db
				.update(post)
				.set({ likesCount: 10 })
				.where(eq(post.id, convertToUUID(testPostSUUID)));
		});

		it('should return HTTP 201 on successful like creation for a comment. Comment should have the like count of 11.', async () => {
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForComment.at(0),
					postId: null,
					commentId: testCommentSUUID,
				})
				.expect(201);

			const [commentData] = await db
				.select({ likesCount: comment.likesCount })
				.from(comment)
				.where(eq(comment.id, convertToUUID(testCommentSUUID)));
			expect(commentData?.likesCount).toEqual(11);

			// Delete the newly created like and update the comment like count
			const [commentLike] = await db
				.select({ id: like.id })
				.from(like)
				.where(
					and(
						eq(like.commentId, convertToUUID(testCommentSUUID)),
						eq(like.userId, convertToUUID(testUserSUUID))
					)
				);

			await db.delete(like).where(eq(like.id, commentLike?.id ?? ''));
			await db
				.update(comment)
				.set({ likesCount: 10 })
				.where(eq(comment.id, convertToUUID(testCommentSUUID)));
		});

		it("should return the like id on successful update of a post like. Post's like type should be equal to the updated like type.", async () => {
			const typeToUpdate = testLikesForPost.find(
				(like) => like.type !== testLikesForPost.at(0)
			)?.type;

			const response = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					postId: testPostSUUID,
					commentId: null,
				});

			const updateResponse: SuperTestResponse<{ id: string }> = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					postId: testPostSUUID,
					commentId: null,
					type: typeToUpdate,
				})
				.expect(200);

			expect(response.body).not.toHaveProperty('id');
			expect(updateResponse.body.id).toBeDefined();

			const [likeData] = await db
				.select({ id: like.id, type: like.type })
				.from(like)
				.where(
					and(
						eq(like.postId, convertToUUID(testPostSUUID)),
						eq(like.userId, convertToUUID(testUserSUUID))
					)
				);
			expect(likeData?.type).toEqual(typeToUpdate);

			// Delete the newly created like and update the post like count
			await db.delete(like).where(eq(like.id, likeData?.id ?? ''));
			await db
				.update(post)
				.set({ likesCount: 10 })
				.where(eq(post.id, convertToUUID(testPostSUUID)));
		});

		it("should return the like id on successful update of a comment like. Comment's like type should be equal to the updated like type.", async () => {
			const typeToUpdate = testLikesForComment.find(
				(like) => like.type !== testLikesForComment.at(0)
			)?.type;

			const response = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForComment.at(0),
					postId: null,
					commentId: testCommentSUUID,
				});

			const updateResponse: SuperTestResponse<{ id: string }> = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForComment.at(0),
					postId: null,
					commentId: testCommentSUUID,
					type: typeToUpdate,
				})
				.expect(200);

			expect(response.body).not.toHaveProperty('id');
			expect(updateResponse.body.id).toBeDefined();

			const [likeData] = await db
				.select({ id: like.id, type: like.type })
				.from(like)
				.where(
					and(
						eq(like.commentId, convertToUUID(testCommentSUUID)),
						eq(like.userId, convertToUUID(testUserSUUID))
					)
				);
			expect(likeData?.type).toEqual(typeToUpdate);

			// Delete the newly created like and update the post like count
			await db.delete(like).where(eq(like.id, likeData?.id ?? ''));
			await db
				.update(comment)
				.set({ likesCount: 10 })
				.where(eq(comment.id, convertToUUID(testCommentSUUID)));
		});
	});

	describe('Delete like route (DELETE)', () => {
		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.delete(testUrl('post', testPostSUUID)).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api
				.delete(testUrl('post', testPostSUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the route is accessed with both valid postId and commentId', async () => {
			const response: ResponseWithError = await api
				.delete(
					`${testUrlBase}?postId=${testPostSUUID}&commentId=${testCommentSUUID}`
				)
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual(
				'Exactly one of postId or commentId must be provided'
			);
		});

		it('should return HTTP 400 and a message when the route is accessed without valid postId and commentId', async () => {
			const response: ResponseWithError = await api
				.delete(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual(
				'Exactly one of postId or commentId must be provided'
			);
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid postId', async () => {
			const response: ResponseWithError = await api
				.delete(testUrl('post', 'random-id' as SUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for post');
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid commentId', async () => {
			const response: ResponseWithError = await api
				.delete(testUrl('comment', 'random-id' as SUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for comment');
		});

		it('should return HTTP 404 and a message when the provided post id is valid (SUUID) but does not exist', async () => {
			const response: ResponseWithError = await api
				.delete(testUrl('post', sampleSUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(404);

			expect(response.body.error).toEqual('Like does not exist');
		});

		it('should return HTTP 500, a message and rollback like deletion if an error occurs', async () => {
			const response: ResponseWithError = await api
				.delete(`${testUrl('post', testPostSUUID)}&forceError=true`)
				.auth(authToken, { type: 'bearer' })
				.expect(500);

			expect(response.body.error).toEqual(
				'Forced transaction error for like deletion'
			);

			const totalLikesofPost = await db
				.select({ id: like.id })
				.from(like)
				.where(eq(like.postId, convertToUUID(testPostSUUID)));

			expect(totalLikesofPost).toHaveLength(10);

			const [postData] = await db
				.select({ likesCount: post.likesCount })
				.from(post)
				.where(eq(post.id, convertToUUID(testPostSUUID)));
			expect(postData?.likesCount).toEqual(10);
		});

		it('should return a message saying like deleted successfully on success when provided a postId. Post should have a like count of 10', async () => {
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					commentId: null,
					postId: testPostSUUID,
				});

			const response: SuperTestResponse<{ message: string }> = await api
				.delete(testUrl('post', testPostSUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('Like deleted successfully');

			const [postData] = await db
				.select({ likesCount: post.likesCount })
				.from(post)
				.where(eq(post.id, convertToUUID(testPostSUUID)));

			expect(postData?.likesCount).toEqual(10);
		});

		it('should return a message saying like deleted successfully on success when provided a commentId. Comment should have a like count of 10', async () => {
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testLikesForPost.at(0),
					commentId: testCommentSUUID,
					postId: null,
				});

			const response: SuperTestResponse<{ message: string }> = await api
				.delete(testUrl('comment', testCommentSUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('Like deleted successfully');

			const [commentData] = await db
				.select({ likesCount: comment.likesCount })
				.from(comment)
				.where(eq(comment.id, convertToUUID(testCommentSUUID)));

			expect(commentData?.likesCount).toEqual(10);
		});
	});
});
