import { db } from '@/db/index.js';
import { comment } from '@/db/schema/comment.js';
import { user } from '@/db/schema/user.js';
import { convertToUUID } from '@/utils/general.utils.js';
import {
	createTestComment,
	createTestCommentForSelect,
	createTestReply,
	createTestReplyForSelect,
	sampleSUUID,
} from '@/utils/test.utils.js';
import { and, desc, eq } from 'drizzle-orm';
import {
	beforeEach,
	describe,
	expect,
	it,
	Mock,
	MockedFunction,
	vi,
} from 'vitest';
import {
	commentExists,
	updateParentCommentReplyCount,
} from './comment.services.helpers.js';
import {
	deleteCommentById,
	findComments,
	findReplies,
	makeComment,
	updateCommentById,
} from './comment.services.js';

const sampleUUID = convertToUUID(sampleSUUID);

const mockDb = db as unknown as {
	select: MockedFunction<(...args: unknown[]) => unknown>;
	insert: MockedFunction<(...args: unknown[]) => unknown>;
	update: MockedFunction<(...args: unknown[]) => unknown>;
	delete: MockedFunction<(...args: unknown[]) => unknown>;
	transaction: MockedFunction<
		(callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>
	>;
};

const createMockSelect = (resolvedValue: unknown[]) => ({
	from: vi.fn().mockReturnThis(),
	leftJoin: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	orderBy: vi.fn().mockReturnThis(),
	limit: vi.fn().mockResolvedValue(resolvedValue),
});

const createMockMutation = (
	resolveType: 'resolve' | 'reject',
	value: unknown[] | Error,
	mutationType: 'insert' | 'delete'
) => {
	if (mutationType === 'insert') {
		return {
			values: vi.fn().mockReturnThis(),
			returning:
				resolveType === 'resolve'
					? vi.fn().mockResolvedValue(value)
					: vi.fn().mockRejectedValue(value),
		};
	}

	return {
		where: vi.fn().mockReturnThis(),
		returning:
			resolveType === 'resolve'
				? vi.fn().mockResolvedValue(value)
				: vi.fn().mockRejectedValue(value),
	};
};

describe('Comment Service Functions', () => {
	vi.mock('@/db/index.js', () => ({
		db: {
			select: vi.fn(),
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			transaction: vi.fn(),
		},
	}));

	vi.mock('./comment.services.helpers.js', () => ({
		commentExists: vi.fn(),
		updateParentCommentReplyCount: vi.fn(),
	}));

	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('findComments function', () => {
		const testComments = Array.from({ length: 10 }).map(() => ({
			...createTestCommentForSelect(),
			postId: sampleUUID,
			userId: sampleUUID,
			commentLevel: 0,
			id: sampleUUID,
		}));

		const testCommentsWithSUUID = testComments.map((comment) => ({
			...comment,
			id: sampleSUUID,
			postId: sampleSUUID,
			userId: sampleSUUID,
		}));

		it('should find comments', async () => {
			const mockSelect = createMockSelect(testComments);

			mockDb.select.mockReturnValue(mockSelect);

			const result = await findComments({ postId: sampleSUUID });

			expect(mockDb.select).toHaveBeenCalledTimes(1);

			expect(mockSelect.from).toHaveBeenCalledWith(comment);
			expect(mockSelect.leftJoin).toHaveBeenCalledWith(
				user,
				eq(comment.userId, user.id)
			);
			expect(mockSelect.where).toHaveBeenCalledWith(
				and(
					eq(comment.postId, convertToUUID(sampleSUUID)),
					eq(comment.commentLevel, 0)
				)
			);
			expect(mockSelect.orderBy).toHaveBeenCalledWith(desc(comment.createdAt));
			expect(mockSelect.limit).toHaveBeenCalledWith(5);

			expect(result).toEqual(testCommentsWithSUUID);

			// commentLevel property for comments only exists during test
			expect(result.at(0)).toHaveProperty('commentLevel');
		});

		it('should include commentLevel in test environment', async () => {
			const mockSelect = createMockSelect(testComments);

			mockDb.select.mockReturnValue(mockSelect);

			vi.stubEnv('NODE_ENV', 'test');

			const result = await findComments({ postId: sampleSUUID });

			expect(result.at(0)).toHaveProperty('commentLevel');
		});

		it('should handle comments with null user data', async () => {
			const commentsWithNullUser = testComments.map((comment) => ({
				...comment,
				userId: null,
				fullName: null,
				profilePic: null,
			}));

			const commentsWithNullUserSUUID = commentsWithNullUser.map((comment) => ({
				...comment,
				id: sampleSUUID,
				postId: sampleSUUID,
			}));

			const mockSelect = createMockSelect(commentsWithNullUser);

			mockDb.select.mockReturnValue(mockSelect);

			const result = await findComments({ postId: sampleSUUID });

			expect(result).toEqual(commentsWithNullUserSUUID);
		});
	});

	describe('findReplies function', () => {
		const testReplies = Array.from({ length: 5 }).map(() => ({
			...createTestReplyForSelect({ commentLevel: 1 }),
			postId: sampleUUID,
			userId: sampleUUID,
			parentCommentId: sampleUUID,
			id: sampleUUID,
		}));

		const testRepliesWithSUUID = testReplies.map((reply) => ({
			...reply,
			id: sampleSUUID,
			postId: sampleSUUID,
			parentCommentId: sampleSUUID,
			userId: sampleSUUID,
		}));

		it('should find replies', async () => {
			const mockSelect = createMockSelect(testReplies);

			mockDb.select.mockReturnValue(mockSelect);

			const result = await findReplies({ parentCommentId: sampleSUUID });

			expect(mockDb.select).toHaveBeenCalledTimes(1);

			expect(mockSelect.from).toHaveBeenCalledWith(comment);

			expect(mockSelect.leftJoin).toHaveBeenCalledWith(
				user,
				eq(comment.userId, user.id)
			);
			expect(mockSelect.where).toHaveBeenCalledWith(
				and(eq(comment.parentCommentId, convertToUUID(sampleSUUID)))
			);
			expect(mockSelect.orderBy).toHaveBeenCalledWith(desc(comment.createdAt));
			expect(mockSelect.limit).toHaveBeenCalledWith(5);

			expect(result).toEqual(testRepliesWithSUUID);
		});

		it('should handle replies with null user data', async () => {
			const repliesWithNullUser = testReplies.map((reply) => ({
				...reply,
				userId: null,
				fullName: null,
				profilePic: null,
			}));

			const repliesWithNullUserSUUID = repliesWithNullUser.map((reply) => ({
				...reply,
				id: sampleSUUID,
				postId: sampleSUUID,
				parentCommentId: sampleSUUID,
			}));

			const mockSelect = createMockSelect(repliesWithNullUser);

			mockDb.select.mockReturnValue(mockSelect);

			const result = await findReplies({ parentCommentId: sampleSUUID });

			expect(result).toEqual(repliesWithNullUserSUUID);
		});
	});

	describe('makeComment', () => {
		const mockTransaction = {
			insert: vi.fn().mockReturnThis(),
		};

		const dbResponse = { id: sampleUUID };

		const setupTransaction = (
			insertValue: unknown[] | Error,
			resolveType: 'resolve' | 'reject'
		) => {
			const mockInsert = createMockMutation(resolveType, insertValue, 'insert');

			mockTransaction.insert.mockReturnValue(mockInsert);

			mockDb.transaction.mockImplementation(async (callback) => {
				const result = await callback(mockTransaction);
				return result;
			});

			return mockInsert;
		};

		it('should create a top-level comment successfully', async () => {
			const newTestComment = createTestComment();
			newTestComment.postId = sampleSUUID;
			newTestComment.userId = sampleSUUID;

			const mockInsert = setupTransaction([dbResponse], 'resolve');

			const result = await makeComment(newTestComment);

			expect(mockTransaction.insert).toHaveBeenCalledWith(comment);
			expect(mockInsert.values).toHaveBeenCalledWith({
				content: newTestComment.content,
				commentLevel: undefined,
				userId: sampleUUID,
				postId: sampleUUID,
				parentCommentId: null,
			});
			expect(mockInsert.returning).toHaveBeenCalledWith({ id: comment.id });
			expect(result).toEqual({ id: sampleSUUID });
		});

		it('should create a reply comment successfully', async () => {
			const newTestReply = createTestReply({ commentLevel: 1 });
			newTestReply.postId = sampleSUUID;
			newTestReply.parentCommentId = sampleSUUID;
			newTestReply.userId = sampleSUUID;

			const mockInsert = setupTransaction([dbResponse], 'resolve');

			await makeComment(newTestReply);

			expect(mockTransaction.insert).toHaveBeenCalledWith(comment);
			expect(mockInsert.values).toHaveBeenCalledWith({
				commentLevel: newTestReply.commentLevel,
				content: newTestReply.content,
				userId: sampleUUID,
				postId: sampleUUID,
				parentCommentId: sampleUUID,
			});
			expect(mockInsert.returning).toHaveBeenCalledWith({ id: comment.id });
		});

		it('should throw error when parentCommentId exists but commentLevel is 0', async () => {
			const newTestReply = createTestReply({ commentLevel: 0 });
			newTestReply.parentCommentId = sampleSUUID;
			newTestReply.postId = sampleSUUID;
			newTestReply.userId = sampleSUUID;

			await expect(makeComment(newTestReply)).rejects.toThrowError(
				Error(
					'Comment level has to be greater than 0 if parent comment id is present',
					{ cause: 400 }
				)
			);
		});

		it('should update parent comment reply count when creating a reply', async () => {
			const newTestReply = createTestReply({ commentLevel: 1 });
			newTestReply.parentCommentId = sampleSUUID;
			newTestReply.postId = sampleSUUID;
			newTestReply.userId = sampleSUUID;

			setupTransaction([dbResponse], 'resolve');

			await makeComment(newTestReply);

			expect(updateParentCommentReplyCount).toHaveBeenCalledWith(
				{
					id: newTestReply.parentCommentId,
					type: 'increase',
				},
				mockTransaction
			);
		});

		it('should not update parent comment reply count for top-level comments', async () => {
			const newTestComment = createTestComment();
			newTestComment.postId = sampleSUUID;
			newTestComment.userId = sampleSUUID;

			setupTransaction([dbResponse], 'resolve');

			await makeComment(newTestComment);

			expect(updateParentCommentReplyCount).not.toHaveBeenCalled();
		});

		it('should handle transaction rollback on error', async () => {
			const newTestReply = createTestReply({ commentLevel: 1 });
			newTestReply.parentCommentId = sampleSUUID;
			newTestReply.postId = sampleSUUID;
			newTestReply.userId = sampleSUUID;

			setupTransaction(
				Error('Simulated database error on insert', { cause: 500 }),
				'reject'
			);

			await expect(makeComment(newTestReply)).rejects.toThrowError(
				Error('Simulated database error on insert', { cause: 500 })
			);

			expect(updateParentCommentReplyCount).not.toBeCalled();
		});
	});

	describe('updateCommentById', () => {
		const dbResponse = { id: sampleUUID };

		it('should update comment successfully', async () => {
			const newTestComment = createTestComment();
			newTestComment.postId = sampleSUUID;
			newTestComment.userId = sampleSUUID;

			const updatedDate = new Date();

			const mockUpdate = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([dbResponse]),
			};

			mockDb.update.mockReturnValue(mockUpdate);

			(commentExists as Mock).mockResolvedValue({ parentCommentId: null });

			const result = await updateCommentById({
				content: newTestComment.content,
				userId: newTestComment.userId,
				id: sampleSUUID,
			});

			expect(mockDb.update).toHaveBeenCalledWith(comment);
			expect(mockUpdate.set).toHaveBeenCalledWith({
				content: newTestComment.content,
				updatedAt: updatedDate,
			});
			expect(mockUpdate.where).toHaveBeenCalledWith(
				and(eq(comment.id, sampleUUID), eq(comment.userId, sampleUUID))
			);
			expect(mockUpdate.returning).toHaveBeenCalledWith({ id: comment.id });

			expect(result).toEqual({ id: sampleSUUID });
		});

		it('should throw error when comment does not exist', async () => {
			(commentExists as Mock).mockResolvedValue(undefined);

			await expect(
				updateCommentById({
					id: sampleSUUID,
					userId: sampleSUUID,
					content: 'sample content',
				})
			).rejects.toThrowError(Error('Comment does not exist', { cause: 404 }));
		});
	});

	describe('deleteCommentById', () => {
		const mockTransaction = {
			delete: vi.fn().mockReturnThis(),
		};

		const dbResponse = { id: sampleUUID };

		const setupTransaction = (
			insertValue: unknown[] | Error,
			resolveType: 'resolve' | 'reject'
		) => {
			const mockDelete = createMockMutation(resolveType, insertValue, 'delete');

			mockTransaction.delete.mockReturnValue(mockDelete);

			mockDb.transaction.mockImplementation(async (callback) => {
				const result = await callback(mockTransaction);
				return result;
			});

			return mockDelete;
		};

		it('should delete comment successfully', async () => {
			const mockDelete = setupTransaction([dbResponse], 'resolve');

			(commentExists as Mock).mockResolvedValue({ parentCommentId: null });

			await deleteCommentById({
				id: sampleSUUID,
				userId: sampleSUUID,
			});

			expect(mockTransaction.delete).toHaveBeenCalledWith(comment);
			expect(mockDelete.where).toHaveBeenCalledWith(
				and(eq(comment.id, sampleUUID), eq(comment.userId, sampleUUID))
			);
			expect(mockDelete.returning).toHaveBeenCalledWith({ id: comment.id });
		});

		it('should throw error when comment does not exist', async () => {
			(commentExists as Mock).mockResolvedValue(undefined);

			await expect(
				deleteCommentById({ id: sampleSUUID, userId: sampleSUUID })
			).rejects.toThrowError(Error('Comment does not exist', { cause: 404 }));
		});

		it('should not decrease parent comment reply count when deleting a comment', async () => {
			setupTransaction([dbResponse], 'resolve');

			(commentExists as Mock).mockResolvedValue({ parentCommentId: null });

			await deleteCommentById({
				id: sampleSUUID,
				userId: sampleSUUID,
			});

			expect(updateParentCommentReplyCount).not.toHaveBeenCalled();
		});

		it('should increase parent comment reply count when deleting top-level comment', async () => {
			setupTransaction([dbResponse], 'resolve');

			(commentExists as Mock).mockResolvedValue({
				parentCommentId: sampleSUUID,
			});

			await deleteCommentById({
				id: sampleSUUID,
				userId: sampleSUUID,
			});

			expect(updateParentCommentReplyCount).toHaveBeenCalledWith(
				{
					id: sampleSUUID,
					type: 'decrease',
				},
				mockTransaction
			);
		});

		it('should return isReply flag correctly for top-level comments', async () => {
			setupTransaction([dbResponse], 'resolve');

			(commentExists as Mock).mockResolvedValue({ parentCommentId: null });

			const result = await deleteCommentById({
				id: sampleSUUID,
				userId: sampleSUUID,
			});

			expect(result).toEqual({
				id: sampleSUUID,
				isReply: false,
			});
		});

		it('should return isReply flag correctly for replies', async () => {
			setupTransaction([dbResponse], 'resolve');

			(commentExists as Mock).mockResolvedValue({
				parentCommentId: sampleSUUID,
			});

			const result = await deleteCommentById({
				id: sampleSUUID,
				userId: sampleSUUID,
			});

			expect(result).toEqual({
				id: sampleSUUID,
				isReply: true,
			});
		});

		it('should handle transaction rollback on error on delete', async () => {
			setupTransaction(
				Error('Simulated database error on delete', { cause: 500 }),
				'reject'
			);

			(commentExists as Mock).mockResolvedValue({ parentCommentId: null });

			await expect(
				deleteCommentById({ id: sampleSUUID, userId: sampleSUUID })
			).rejects.toThrowError(
				Error('Simulated database error on delete', { cause: 500 })
			);

			expect(updateParentCommentReplyCount).not.toBeCalled();
		});
	});
});
