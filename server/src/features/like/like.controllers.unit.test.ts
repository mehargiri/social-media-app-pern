import { createTestLike, sampleSUUID } from '@/utils/test.utils.js';
import { Request, Response } from 'express';
import { generate, SUUID } from 'short-uuid';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	getDetailedLikes,
	likeController,
	unlikeController,
} from './like.controllers.js';
import {
	deleteLike,
	findDetailedLikes,
	likeExists,
	upsertLike,
} from './like.services.js';
import { LikeType } from './like.zod.schemas.js';

const testLikes = Array.from({ length: 5 }).map((_item, index) => {
	return {
		...createTestLike(),
		createdAt: new Date(Date.now() + index * 24 * 60 * 60 * 1000),
	};
});

const testLikesWithPost = testLikes.filter((like) => like.postId !== null);
const testLikesWithComment = testLikes.filter(
	(like) => like.commentId !== null
);

const postLikeToCreate = testLikesWithPost[0];
const commentLikeToCreate = testLikesWithComment[0];

describe('Like Controller Functions', () => {
	const req: {
		query: { commentId?: SUUID; postId?: SUUID };
		body?: typeof postLikeToCreate;
	} = {
		query: {},
	};

	const res = {
		sendStatus: vi.fn(),
		json: vi.fn(),
	};

	vi.mock('./like.services.ts', () => ({
		findDetailedLikes: vi.fn(),
		upsertLike: vi.fn(),
		deleteLike: vi.fn(),
		updateEntityLikeCount: vi.fn(),
		updateEntityTopLikes: vi.fn(),
		likeExists: vi.fn(),
	}));

	describe('getDetailedLikes function', () => {
		const lastDate = testLikes[testLikes.length - 1]?.createdAt.toISOString();

		const nextCursor = lastDate
			? Buffer.from(lastDate).toString('base64url')
			: undefined;

		const callTestFn = async () => {
			await getDetailedLikes(
				req as unknown as Request<
					never,
					never,
					never,
					{ postId?: SUUID; commentId?: SUUID; cursor?: string }
				>,
				res as unknown as Response<{
					likes: Awaited<ReturnType<typeof findDetailedLikes>>;
					nextCursor: string | null;
				}>
			);
		};

		it('should throw Error when both postId and commentId is provided', async () => {
			req.query = { commentId: sampleSUUID, postId: sampleSUUID };

			await expect(callTestFn()).rejects.toThrowError(
				Error('Exactly one of postId or commentId must be provided', {
					cause: 400,
				})
			);
		});

		it('should throw Error when both postId and commentId is not provided', async () => {
			await expect(callTestFn()).rejects.toThrowError(
				Error('Exactly one of postId or commentId must be provided', {
					cause: 400,
				})
			);
		});

		it('should throw Error when the postId is invalid', async () => {
			req.query = { postId: 'random-id' as SUUID };

			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for post', { cause: 400 })
			);
		});

		it('should throw Error when the commentId is invalid', async () => {
			req.query = { commentId: 'random-id' as SUUID };

			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for comment', { cause: 400 })
			);
		});

		it('should call res.json with the detailed likes of a post and a nextCursor value on success when postId is provided', async () => {
			req.query = { postId: sampleSUUID };

			(findDetailedLikes as Mock).mockResolvedValue(testLikes);
			await callTestFn();

			expect(res.json).toHaveBeenCalledWith({
				likes: testLikes,
				nextCursor,
			});
		});

		it('should call res.json with the detailed likes of a comment and a nextCursor value on success when postId is provided', async () => {
			req.query = { commentId: sampleSUUID };

			(findDetailedLikes as Mock).mockResolvedValue(testLikes);
			await callTestFn();

			expect(res.json).toHaveBeenCalledWith({
				likes: testLikes,
				nextCursor,
			});
		});
	});

	describe('likeController function', () => {
		const callTestFn = async () => {
			await likeController(
				req as unknown as Request<
					never,
					never,
					LikeType & { forceError?: boolean }
				>,
				res as unknown as Response
			);
		};

		it('should throw Error when both postId and commentId is provided', async () => {
			if (postLikeToCreate) postLikeToCreate.commentId = sampleSUUID;
			req.body = postLikeToCreate;

			await expect(callTestFn()).rejects.toThrowError(
				Error('Exactly one of postId or commentId must be provided', {
					cause: 400,
				})
			);
		});

		it('should throw Error when both postId and commentId is not provided', async () => {
			if (postLikeToCreate) {
				postLikeToCreate.commentId = null;
				postLikeToCreate.postId = null;
			}

			req.body = postLikeToCreate;

			await expect(callTestFn()).rejects.toThrowError(
				Error('Exactly one of postId or commentId must be provided', {
					cause: 400,
				})
			);
		});

		it('should throw Error when the postId is invalid', async () => {
			if (postLikeToCreate) {
				postLikeToCreate.postId = 'random-id' as SUUID;
				postLikeToCreate.commentId = null;
			}
			req.body = postLikeToCreate;

			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for post', { cause: 400 })
			);
		});

		it('should throw Error when the commentId is invalid', async () => {
			if (commentLikeToCreate) {
				commentLikeToCreate.commentId = 'random-id' as SUUID;
				commentLikeToCreate.postId = null;
			}

			req.body = commentLikeToCreate;

			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for comment', { cause: 400 })
			);
		});

		it('should call upsertLike and res.sendStatus with HTTP 201 on success for a like creation of a post', async () => {
			if (postLikeToCreate) {
				postLikeToCreate.postId = sampleSUUID;
				postLikeToCreate.commentId = null;
			}

			req.body = postLikeToCreate;
			(upsertLike as Mock).mockResolvedValue([
				{
					id: sampleSUUID,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);

			await callTestFn();
			expect(res.sendStatus).toHaveBeenLastCalledWith(201);
		});

		it('should call upsertLike and res.sendStatus with HTTP 201 on success for a like creation of a comment', async () => {
			if (commentLikeToCreate) {
				commentLikeToCreate.commentId = sampleSUUID;
				commentLikeToCreate.postId = null;
			}

			req.body = commentLikeToCreate;
			(upsertLike as Mock).mockResolvedValue([
				{
					id: sampleSUUID,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);

			await callTestFn();

			expect(res.sendStatus).toHaveBeenLastCalledWith(201);
		});

		it('should call upsertLike and res.json with the updated like id on success for a like update of a post', async () => {
			if (postLikeToCreate) postLikeToCreate.type = testLikes[4]?.type;
			req.body = postLikeToCreate;
			(upsertLike as Mock).mockResolvedValue([
				{
					id: sampleSUUID,
					createdAt: new Date(),
					updatedAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
				},
			]);

			await callTestFn();

			expect(res.json).toHaveBeenLastCalledWith({ id: sampleSUUID });
		});

		it('should call upsertLike and res.json with the updated like id on success for a like update of a comment', async () => {
			if (commentLikeToCreate) commentLikeToCreate.type = testLikes[4]?.type;
			req.body = commentLikeToCreate;

			(upsertLike as Mock).mockResolvedValue([
				{
					id: sampleSUUID,
					createdAt: new Date(),
					updatedAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
				},
			]);

			await callTestFn();

			expect(res.json).toHaveBeenLastCalledWith({ id: sampleSUUID });
		});
	});

	describe('unlikeController function', () => {
		beforeEach(() => {
			vi.resetAllMocks();
		});

		const callTestFn = async () => {
			await unlikeController(
				req as unknown as Request<
					never,
					never,
					never,
					{ commentId?: SUUID; postId?: SUUID; forceError?: boolean }
				>,
				res as unknown as Response
			);
		};

		it('should throw Error when both postId and commentId is provided', async () => {
			req.query = { commentId: sampleSUUID, postId: sampleSUUID };

			await expect(callTestFn()).rejects.toThrowError(
				Error('Exactly one of postId or commentId must be provided', {
					cause: 400,
				})
			);
		});

		it('should throw Error when both postId and commentId is not provided', async () => {
			await expect(callTestFn()).rejects.toThrowError(
				Error('Exactly one of postId or commentId must be provided', {
					cause: 400,
				})
			);
		});

		it('should throw Error when the postId is invalid', async () => {
			req.query = { postId: 'random-id' as SUUID };

			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for post', { cause: 400 })
			);
		});

		it('should throw Error when the commentId is invalid', async () => {
			req.query = { commentId: 'random-id' as SUUID };

			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for comment', { cause: 400 })
			);
		});

		it('should throw Error when like for the given postId in request query does not exist', async () => {
			req.query = { postId: generate() };
			await expect(callTestFn()).rejects.toThrowError(
				Error('Like does not exist', { cause: 404 })
			);
		});

		it('should throw Error when like for the given commentId in request query does not exist', async () => {
			req.query = { commentId: generate() };
			await expect(callTestFn()).rejects.toThrowError(
				Error('Like does not exist', { cause: 404 })
			);
		});

		it('should call res.json with a message on successful deletion of a like of a post', async () => {
			req.query = { postId: sampleSUUID };

			(likeExists as Mock).mockResolvedValue(true);
			(deleteLike as Mock).mockResolvedValue({ id: sampleSUUID });

			await callTestFn();

			expect(res.json).toHaveBeenCalledWith({
				message: 'Like deleted successfully',
			});
		});

		it('should call res.json with a message on successful deletion of a like of a comment', async () => {
			req.query = { commentId: sampleSUUID };

			(likeExists as Mock).mockResolvedValue(true);
			(deleteLike as Mock).mockResolvedValue({ id: sampleSUUID });

			await callTestFn();

			expect(res.json).toHaveBeenCalledWith({
				message: 'Like deleted successfully',
			});
		});
	});
});
