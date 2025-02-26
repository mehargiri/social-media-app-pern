import {
	createTestComment,
	createTestReply,
	sampleSUUID,
} from '@/utils/test.utils.js';
import { Request, Response } from 'express';
import { generate, SUUID } from 'short-uuid';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	createComment,
	deleteComment,
	getComments,
	getReplies,
	updateComment,
} from './comment.controllers.js';
import {
	commentExists,
	deleteCommentById,
	findComments,
	findReplies,
	makeComment,
	updateCommentById,
} from './comment.services.js';
import { CommentType, UpdateCommentType } from './comment.zod.schemas.js';

const testComments = Array.from({ length: 5 }).map((_item, index) => {
	return {
		...createTestComment(),
		postId: sampleSUUID,
		createdAt: new Date(Date.now() + index * 24 * 60 * 60 * 1000),
	};
});

const testReplies = Array.from({ length: 5 }).map((_item, index) => ({
	...createTestReply({ commentLevel: 1 }),
	parentCommentId: sampleSUUID,
	createdAt: new Date(Date.now() + index * 24 * 60 * 60 * 1000),
}));

const commentToCreate = testComments[0];
const replyToCreate = testReplies[0];
const replyToNotCreate = testReplies[1];
if (replyToNotCreate) replyToNotCreate.commentLevel = 0;

describe('Comment Controller Functions', () => {
	const req = {
		params: { id: sampleSUUID },
		query: { parentCommentId: sampleSUUID, postId: sampleSUUID },
		body: commentToCreate,
	};

	const res = {
		sendStatus: vi.fn(),
		json: vi.fn(),
	};

	vi.mock('./comment.services.ts', () => ({
		makeComment: vi.fn(),
		commentExists: vi.fn(),
		updateCommentById: vi.fn(),
		deleteCommentById: vi.fn(),
		findComments: vi.fn(),
		findReplies: vi.fn(),
		updateParentCommentReplyCount: vi.fn(),
	}));

	describe('getComments function', () => {
		const lastDate =
			testComments[testComments.length - 1]?.createdAt.toISOString();

		const nextCursor = lastDate
			? Buffer.from(lastDate).toString('base64url')
			: undefined;

		const callTestFn = async () => {
			await getComments(
				req as unknown as Request<
					never,
					never,
					never,
					{ postId: SUUID; cursor?: string }
				>,
				res as unknown as Response<{
					comments: Awaited<ReturnType<typeof findComments>>;
					nextCursor: string | null;
				}>
			);
		};

		it('should throw Error when the postId is invalid', async () => {
			req.query.postId = 'random-id' as SUUID;
			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for post')
			);
		});

		it('should call res.json with the comments and a nextCursor value on success', async () => {
			req.query.postId = sampleSUUID;
			(findComments as Mock).mockResolvedValue(testComments);
			await callTestFn();

			expect(res.json).toHaveBeenCalledWith({
				comments: testComments,
				nextCursor,
			});
		});
	});

	describe('getReplies function', () => {
		const lastDate =
			testReplies[testReplies.length - 1]?.createdAt.toISOString();

		const nextCursor = lastDate
			? Buffer.from(lastDate).toString('base64url')
			: undefined;

		const callTestFn = async () => {
			await getReplies(
				req as unknown as Request<
					never,
					never,
					never,
					{ parentCommentId: SUUID; cursor?: string }
				>,
				res as unknown as Response<{
					replies: Awaited<ReturnType<typeof findReplies>>;
					nextCursor: string | null;
				}>
			);
		};

		it('should throw Error when the parentCommentId is invalid', async () => {
			req.query.parentCommentId = 'random-id' as SUUID;
			await expect(callTestFn()).rejects.toThrowError(
				Error('Valid id is required for parent comment')
			);
		});

		it('should call res.json with the replies and a nextCursor value on success', async () => {
			req.query.parentCommentId = sampleSUUID;
			(findReplies as Mock).mockResolvedValue(testReplies);
			await callTestFn();

			expect(nextCursor).not.toBeNull();
			expect(res.json).toHaveBeenCalledWith({
				replies: testReplies,
				nextCursor,
			});
		});
	});

	describe('createComment function', () => {
		it('should throw Error when parentCommentId and comment level of 0 is present in req.body', async () => {
			req.body = replyToNotCreate;
			await expect(
				createComment(
					req as unknown as Request<never, never, CommentType>,
					res as unknown as Response
				)
			).rejects.toThrowError(
				Error(
					'Comment level has to be greater than 0 if parent comment id is present',
					{ cause: 400 }
				)
			);
		});

		it('should call makeComment and res.sendStatus with HTTP 201 on success for a comment creation', async () => {
			req.body = commentToCreate;
			(makeComment as Mock).mockResolvedValue({ id: sampleSUUID });

			await createComment(
				req as unknown as Request<never, never, CommentType>,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenLastCalledWith(201);
		});

		it('should call makeComment and res.sendStatus with HTTP 201 on success for a reply creation', async () => {
			req.body = replyToCreate;
			(makeComment as Mock).mockResolvedValue({ id: sampleSUUID });

			await createComment(
				req as unknown as Request<never, never, CommentType>,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenLastCalledWith(201);
		});
	});

	describe('updateComment function', () => {
		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await updateComment(
				req as unknown as Request<{ id: SUUID }, never, UpdateCommentType>,
				res as unknown as Response
			);
		};

		it('should throw Error when invalid id is provided in the request params', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for comment', { cause: 400 })
			);
		});

		it('should throw Error when comment with given id in request params does not exist', async () => {
			await expect(callTestFn(generate())).rejects.toThrowError(
				Error('Comment does not exist', { cause: 404 })
			);
		});

		it('should call res.json with the same id present in request params on success', async () => {
			(commentExists as Mock).mockResolvedValue(true);
			(updateCommentById as Mock).mockResolvedValue({ id: sampleSUUID });
			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({ id: sampleSUUID });
		});
	});

	describe('deleteComment function', () => {
		beforeEach(() => {
			vi.resetAllMocks();
		});

		const callTestFn = async (id: SUUID, parentCommentId?: SUUID) => {
			req.params.id = id;
			if (parentCommentId) req.query.parentCommentId = parentCommentId;
			await deleteComment(
				req as unknown as Request<{ id: SUUID }>,
				res as unknown as Response
			);
		};

		it('should throw Error when invalid id is provided in the request params', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for comment', { cause: 400 })
			);
		});

		it('should throw Error when comment with given id in request params does not exist', async () => {
			await expect(callTestFn(generate(), sampleSUUID)).rejects.toThrowError(
				Error('Comment does not exist', { cause: 404 })
			);
		});

		it('should call res.json with a message on successful deletion of a comment', async () => {
			(commentExists as Mock).mockResolvedValue(true);
			(deleteCommentById as Mock).mockResolvedValue({ id: sampleSUUID });
			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({
				message: 'Comment deleted successfully',
			});
		});

		it('should call res.json with a message on successful deletion of a reply', async () => {
			(commentExists as Mock).mockResolvedValue(true);
			(deleteCommentById as Mock).mockResolvedValue({ id: sampleSUUID });
			await callTestFn(sampleSUUID, sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({
				message: 'Comment deleted successfully',
			});
		});
	});
});
