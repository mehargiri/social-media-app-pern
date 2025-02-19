import { createTestComment, sampleSUUID } from '@/utils/test.utils.js';
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

const defaultComment = {
	content: 'Some content',
	commentLevel: 0,
	createdAt: new Date(),
	postId: sampleSUUID,
	userId: sampleSUUID,
	parentCommentId: '' as SUUID,
};

const testComments = Array.from({ length: 5 }).map((_item, index) => {
	const comment = createTestComment();
	const isEven = index % 2 === 0;
	return {
		...comment,
		parentCommentId: isEven ? sampleSUUID : '',
		postId: sampleSUUID,
		userId: sampleSUUID,
		createdAt: new Date(Date.now() + index * 24 * 60 * 60 * 1000),
	};
});

const commentToCreate =
	testComments.find((comment) => comment.parentCommentId === '') ??
	defaultComment;

const replyToCreate = testComments.find(
	(comment) => comment.parentCommentId !== '' && comment.commentLevel !== 0
) ?? { ...defaultComment, parentCommentId: sampleSUUID, commentLevel: 1 };

const replyToNotCreate = testComments.find(
	(comment) => comment.parentCommentId !== '' && comment.commentLevel === 0
) ?? { ...defaultComment, parentCommentId: sampleSUUID, commentLevel: 0 };

describe('Comment Controller Functions', () => {
	const req = {
		params: { id: sampleSUUID },
		query: { parentCommentId: sampleSUUID },
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
		const comments = testComments.filter(
			(comment) => comment.parentCommentId === ''
		);

		const lastDate = comments[comments.length - 1]?.createdAt.toISOString();

		const nextCursor = lastDate
			? Buffer.from(lastDate).toString('base64url')
			: undefined;

		it('should call res.json with the comments and a nextCursor value on success', async () => {
			(findComments as Mock).mockResolvedValue(comments);
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

			expect(res.json).toHaveBeenCalledWith({
				comments: comments,
				nextCursor,
			});
		});
	});

	describe('getReplies function', () => {
		const replies = testComments.filter(
			(comment) => comment.parentCommentId !== ''
		);

		const lastDate = replies[replies.length - 1]?.createdAt.toISOString();

		const nextCursor = lastDate
			? Buffer.from(lastDate).toString('base64url')
			: undefined;

		it('should call res.json with the replies and a nextCursor value on success', async () => {
			(findReplies as Mock).mockResolvedValue(replies);
			await getReplies(
				req as Request<
					never,
					never,
					never,
					{ parentCommentId: SUUID; commentLevel?: string; cursor?: string }
				>,
				res as unknown as Response<{
					replies: Awaited<ReturnType<typeof findReplies>>;
					nextCursor: string | null;
				}>
			);

			expect(nextCursor).not.toBeNull();
			expect(res.json).toHaveBeenCalledWith({
				replies: replies,
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
				req as unknown as Request<
					{ id: SUUID },
					never,
					never,
					{ parentCommentId?: SUUID }
				>,
				res as unknown as Response
			);
		};

		it('should throw Error when invalid id is provided in the request params', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for comment', { cause: 400 })
			);
		});

		it('should throw Error when invalid id is provided in the request query', async () => {
			await expect(
				callTestFn(sampleSUUID, 'random-id' as SUUID)
			).rejects.toThrowError(
				Error('Valid id is required for parent comment', { cause: 400 })
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
