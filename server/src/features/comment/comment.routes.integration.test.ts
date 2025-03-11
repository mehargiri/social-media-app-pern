import app from '@/app.js';
import { db } from '@/db/index.js';
import { comment, post, user } from '@/db/schema/index.js';
import { createAccessToken } from '@/features/auth/auth.utils.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import {
	createTestComment,
	createTestPost,
	createTestReply,
	ExtractResponseBody,
	HTTPError400TestsType,
	ResponseWithError,
	SuperTestResponse,
	testUser,
} from '@/utils/test.utils.js';
import { eq } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import { generate, SUUID } from 'short-uuid';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getComments } from './comment.controllers.js';
import {
	getParentCommentReplyCount,
	getPostCommentsCount,
} from './comment.services.js';
import { CommentType } from './comment.zod.schemas.js';

const testReplyLevel1 = createTestReply({ commentLevel: 1 });
const testReplyLevel2 = createTestReply({ commentLevel: 2 });

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const api = supertest(app);
const testPost = createTestPost();
const testComments = Array.from({ length: 10 }).map(() => ({
	...createTestComment(),
}));

const comment400Errors: HTTPError400TestsType<CommentType>[] = [
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
		'post id is empty',
		'postId',
		{ postId: '' },
		'postId: Post id is required; postId: Valid post id is required',
	],
	[
		'post id is not valid',
		'postId',
		{ postId: 'random-id' },
		'postId: Valid post id is required',
	],
	[
		'comment level is less than 0',
		'commentLevel',
		{ commentLevel: -1 },
		'commentLevel: Comment level cannot be less than 0',
	],
	[
		'comment level is more than 0',
		'commentLevel',
		{ commentLevel: 3 },
		'commentLevel: Comment level cannot be more than 2',
	],
	[
		'parent comment id is not valid',
		'parentCommentId',
		{ parentCommentId: 'random-id' },
		'parentCommentId: Valid parent comment id is required',
	],
];

const updateComment400Errors = comment400Errors.slice(0, 2);

const testUrlBase = '/api/comments';

const fullTestUrl = (id: string) => {
	return `${testUrlBase}/${id}`;
};

describe('Comment Routes Integration Tests', () => {
	let authToken: string;
	let testPostSUUID: SUUID,
		testUserSUUID: SUUID,
		testParentCommentSUUID: SUUID,
		testParentReplySUUID: SUUID;

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

		testPostSUUID = convertToSUUID(testPostId?.id ?? '');

		testComments.forEach((comment) => {
			comment.userId = testUserId?.id ?? '';
			// testPostId.id is of string type and the testComments.postId should be of type string in order to add into the database. So, the unknown type assertion is needed in this case. Usually this is not recommended.
			comment.postId = (testPostId?.id ?? '') as unknown as SUUID;
		});

		vi.useFakeTimers({ shouldAdvanceTime: true });

		const [testCommentId] = await db
			.insert(comment)
			.values([...testComments.slice(0, 5)])
			.returning({ id: comment.id });

		testParentCommentSUUID = convertToSUUID(testCommentId?.id ?? '');

		vi.advanceTimersByTime(2 * 60 * 1000);

		await db.insert(comment).values([...testComments.slice(5)]);

		vi.advanceTimersByTime(2 * 60 * 1000);

		const testReplyId = await db
			.insert(comment)
			.values({
				...testReplyLevel1,
				postId: testPostId?.id ?? '',
				userId: testUserId?.id ?? '',
				parentCommentId: testCommentId?.id,
			})
			.returning({ id: comment.id });

		testParentReplySUUID = convertToSUUID(testReplyId[0]?.id ?? '');

		await db
			.update(post)
			.set({ commentsCount: 11 })
			.where(eq(post.id, testPostId?.id ?? ''));

		await db
			.update(comment)
			.set({ repliesCount: 1 })
			.where(eq(comment.id, testCommentId?.id ?? ''));

		vi.useRealTimers();

		authToken = createAccessToken(testUserSUUID);
	});

	afterAll(async () => {
		await reset(db, { user, post, comment });
	});

	describe('GET comments route', () => {
		let testUrl: string;

		beforeAll(() => {
			testUrl = `${testUrlBase}?postId=${testPostSUUID}`;
		});

		type getCommentsResponse = SuperTestResponse<
			ExtractResponseBody<Parameters<typeof getComments>['1']>
		>;

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.get(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api.get(testUrl).auth(authToken, { type: 'bearer' }).expect(403);

			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the route is accessed with invalid postId', async () => {
			const response: ResponseWithError = await api
				.get(`${testUrlBase}?postId=random`)
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for post');
		});

		it('should return total 5 comments with id, postId, content, likesCount, topLikeType1, topLikeType2, repliesCount, createdAt, updatedAt, user fullName, user profilePic along with a nextCursor value when a query params of postId is only passed. should return the next 5 comments that was created before the cursor value with id, postId, content, likesCount, topLikeType1, topLikeType2, repliesCount, createdAt, updatedAt, user fullName, user profilePic along with a nextCursor value when query params of postId and cursor is passed', async () => {
			const requiredPropsComment = [
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
			];

			const response: getCommentsResponse = await api
				.get(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const cursor = response.body.nextCursor ?? '';

			expect(response.body.nextCursor).not.toBeNull();
			expect(response.body.comments).toHaveLength(5);

			requiredPropsComment.forEach((prop) => {
				expect(response.body.comments[0]).toHaveProperty(prop);
			});

			const cursorResponse: getCommentsResponse = await api
				.get(`${testUrl}&cursor=${cursor}`)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			const decodedCursorTime = new Date(
				Buffer.from(cursor, 'base64url').toString()
			).getTime();

			expect(cursorResponse.body.nextCursor).not.toBeNull();
			expect(cursorResponse.body.comments).toHaveLength(5);
			expect(
				new Date(cursorResponse.body.comments[0]?.createdAt ?? '').getTime()
			).toBeLessThan(decodedCursorTime);

			requiredPropsComment.forEach((prop) => {
				expect(cursorResponse.body.comments[0]).toHaveProperty(prop);
			});
		});
	});

	describe('Create comments route (POST)', () => {
		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.post(testUrlBase).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });

			vi.advanceTimersByTime(2 * 60 * 1000);
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send(testComments[0])
				.expect(403);

			vi.useRealTimers();
		});

		it.each(comment400Errors)(
			'should return HTTP 400 when the comment %s',
			async (_testDescription, property, obj, errMessage) => {
				const errMessages = errMessage.split('; ');
				const response: ResponseWithError = await api
					.post(testUrlBase)
					.auth(authToken, { type: 'bearer' })
					.send({
						...testComments[0],
						postId: testPostSUUID,
						[property]: obj[property],
					})
					.expect(400);

				expect(response.body.error).toEqual([...errMessages]);
			}
		);

		it('should return HTTP 400 when a reply has a commentLevel of 0', async () => {
			testReplyLevel1.postId = testPostSUUID;
			testReplyLevel1.userId = testUserSUUID;
			testReplyLevel1.parentCommentId = testParentCommentSUUID;

			const response: ResponseWithError = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testReplyLevel1,
					commentLevel: 0,
				})
				.expect(400);

			expect(response.body.error).toEqual(
				'Comment level has to be greater than 0 if parent comment id is present'
			);
		});

		it('should return HTTP 500, a message and rollback comment creation if an error occurs', async () => {
			const response: ResponseWithError = await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testComments[0],
					postId: testPostSUUID,
					userId: 'random',
					forceError: true,
				})
				.expect(500);

			expect(response.body.error).toEqual(
				'Forced transaction error for comment creation'
			);

			const totalComments = await db
				.select({ id: comment.id })
				.from(comment)
				.where(eq(comment.postId, convertToUUID(testPostSUUID)));

			expect(totalComments).toHaveLength(11);

			const postData = await getPostCommentsCount({ id: testPostSUUID });
			expect(postData?.commentsCount).toEqual(11);
		});

		it('should return HTTP 201 on successful comment creation. Post should have the comment count of 12.', async () => {
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testComments[0],
					postId: testPostSUUID,
					userId: testUserSUUID,
				})
				.expect(201);

			const postData = await getPostCommentsCount({ id: testPostSUUID });
			expect(postData?.commentsCount).toEqual(12);

			// Delete the newly created comment and update the post comment count
			const comments = await db
				.select({ id: comment.id })
				.from(comment)
				.where(eq(comment.postId, convertToUUID(testPostSUUID)))
				.orderBy(comment.createdAt)
				.limit(2);

			await db.delete(comment).where(eq(comment.id, comments.at(1)?.id ?? ''));
			await db
				.update(post)
				.set({ commentsCount: 11 })
				.where(eq(post.id, convertToUUID(testPostSUUID)));
		});

		it('should return HTTP 201 on successful creation of reply with commentLevel of 1. Parent comment should have a reply count of 2. Post should have the comment count of 12.', async () => {
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testReplyLevel1,
					postId: testPostSUUID,
					userId: testUserSUUID,
					parentCommentId: testParentCommentSUUID,
				})
				.expect(201);

			const parentCommentData = await getParentCommentReplyCount({
				id: testParentCommentSUUID,
			});

			const postData = await getPostCommentsCount({ id: testPostSUUID });

			expect(postData?.commentsCount).toEqual(12);
			expect(parentCommentData?.repliesCount).toEqual(2);

			// Delete the newly created reply and update repliesCount to 1
			const replies = await db
				.select({
					id: comment.id,
				})
				.from(comment)
				.where(
					eq(comment.parentCommentId, convertToUUID(testParentCommentSUUID))
				)
				.orderBy(comment.createdAt)
				.limit(2);

			await db.delete(comment).where(eq(comment.id, replies.at(1)?.id ?? ''));
			await db
				.update(comment)
				.set({ repliesCount: 1 })
				.where(eq(comment.id, convertToUUID(testParentCommentSUUID)));
			await db
				.update(post)
				.set({ commentsCount: 11 })
				.where(eq(post.id, convertToUUID(testPostSUUID)));
		});

		it('should return HTTP 201 on successful creation of reply with commentLevel of 2. Parent comment should have a reply count of 1. Post comment should have comment count of 12.', async () => {
			await api
				.post(testUrlBase)
				.auth(authToken, { type: 'bearer' })
				.send({
					...testReplyLevel2,
					postId: testPostSUUID,
					userId: testUserSUUID,
					parentCommentId: testParentReplySUUID,
				})
				.expect(201);

			const parentCommentData = await getParentCommentReplyCount({
				id: testParentReplySUUID,
			});

			const postData = await getPostCommentsCount({ id: testPostSUUID });

			expect(postData?.commentsCount).toEqual(12);
			expect(parentCommentData?.repliesCount).toEqual(1);

			// Delete the newly created comment and update the post comment count
			const comments = await db
				.select({ id: comment.id })
				.from(comment)
				.where(eq(comment.postId, convertToUUID(testPostSUUID)))
				.orderBy(comment.createdAt)
				.limit(2);

			await db.delete(comment).where(eq(comment.id, comments.at(1)?.id ?? ''));
			await db
				.update(post)
				.set({ commentsCount: 11 })
				.where(eq(post.id, convertToUUID(testPostSUUID)));
		});
	});

	describe('Update comments route (PATCH)', () => {
		let testUrl: string;

		beforeAll(() => {
			testUrl = fullTestUrl(testParentCommentSUUID);
		});

		it('should return HTTP 401 when the route is accessed without login', async () => {
			await api.patch(testUrl).expect(401);
		});

		it('should return HTTP 403 when the route is accessed with an expired token', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			vi.advanceTimersByTime(2 * 60 * 1000);

			await api
				.patch(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send({ ...testComments[0], content: 'Test content' })
				.expect(403);
			vi.useRealTimers();
		});

		it('should return HTTP 400 and a message when the provided id is invalid (not SUUID)', async () => {
			const response: ResponseWithError = await api
				.patch(fullTestUrl('random-id'))
				.auth(authToken, { type: 'bearer' })
				.send({ ...testComments[0], content: 'Test content' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for comment');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but does not exist', async () => {
			const response: ResponseWithError = await api
				.patch(fullTestUrl(generate()))
				.auth(authToken, { type: 'bearer' })
				.send({ ...testComments[0], content: 'Test content' })
				.expect(404);

			expect(response.body.error).toEqual('Comment does not exist');
		});

		// 400 Errors for comments
		it.each(updateComment400Errors)(
			'should return HTTP 400 when the comment %s',
			async (_testDescription, property, obj, errMessage) => {
				const response: ResponseWithError = await api
					.patch(testUrl)
					.auth(authToken, { type: 'bearer' })
					.send({ ...testComments[0], [property]: obj[property] })
					.expect(400);

				expect(response.body.error).toEqual([errMessage]);
			}
		);

		it('should return the comment id on success', async () => {
			const response: SuperTestResponse<{ id: SUUID }> = await api
				.patch(testUrl)
				.auth(authToken, { type: 'bearer' })
				.send({ ...testComments[0], content: 'Test content' })
				.expect(200);

			expect(response.body.id).toEqual(testParentCommentSUUID);
		});
	});

	describe('Delete comments route (DELETE)', () => {
		let testUrl: string;

		beforeAll(() => {
			testUrl = fullTestUrl(testParentCommentSUUID);
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
				.delete(fullTestUrl('random-id'))
				.auth(authToken, { type: 'bearer' })
				.expect(400);

			expect(response.body.error).toEqual('Valid id is required for comment');
		});

		it('should return HTTP 404 and a message when the provided id is valid (SUUID) but does not exist', async () => {
			const response: ResponseWithError = await api
				.delete(fullTestUrl(generate()))
				.auth(authToken, { type: 'bearer' })
				.expect(404);

			expect(response.body.error).toEqual('Comment does not exist');
		});

		it('should return HTTP 500, a message and rollback comment deletion if an error occurs', async () => {
			const response: ResponseWithError = await api
				.delete(`${testUrl}?forceError=true`)
				.auth(authToken, { type: 'bearer' })
				.expect(500);

			expect(response.body.error).toEqual(
				'Forced transaction error for comment deletion'
			);

			const totalComments = await db
				.select({ id: comment.id })
				.from(comment)
				.where(eq(comment.postId, convertToUUID(testPostSUUID)));

			expect(totalComments).toHaveLength(11);

			const postData = await getPostCommentsCount({ id: testPostSUUID });
			expect(postData?.commentsCount).toEqual(11);
		});

		it('should return a message saying comment deleted successfully when reply is deleted on success. Parent comment should have a reply count of 0. Post should have a comment count of 10', async () => {
			const response: SuperTestResponse<{ message: string }> = await api
				.delete(fullTestUrl(testParentReplySUUID))
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('Comment deleted successfully');

			const parentCommentData = await getParentCommentReplyCount({
				id: testParentCommentSUUID,
			});

			const postData = await getPostCommentsCount({ id: testPostSUUID });

			expect(postData?.commentsCount).toEqual(10);
			expect(parentCommentData?.repliesCount).toEqual(0);

			// Add the deletedReply back to the database
			await db.insert(comment).values({
				...testReplyLevel1,
				postId: convertToUUID(testPostSUUID),
				userId: convertToUUID(testUserSUUID),
				parentCommentId: convertToUUID(testParentCommentSUUID),
			});

			await db
				.update(post)
				.set({ commentsCount: 11 })
				.where(eq(post.id, convertToUUID(testPostSUUID)));
		});

		it('should return a message saying comment deleted successfully on success. Post should have a comment count of 10', async () => {
			const response: SuperTestResponse<{ message: string }> = await api
				.delete(testUrl)
				.auth(authToken, { type: 'bearer' })
				.expect(200);

			expect(response.body.message).toEqual('Comment deleted successfully');

			const postData = await getPostCommentsCount({ id: testPostSUUID });

			expect(postData?.commentsCount).toEqual(10);
		});
	});
});
