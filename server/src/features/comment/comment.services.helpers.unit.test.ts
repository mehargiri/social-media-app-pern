import { db } from '@/db/index.js';
import { comment } from '@/db/schema/comment.js';
import { convertToUUID } from '@/utils/general.utils.js';
import { sampleSUUID } from '@/utils/test.utils.js';
import { eq, sql } from 'drizzle-orm';
import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it,
	MockedFunction,
	vi,
} from 'vitest';
import {
	commentExists,
	updateParentCommentReplyCount,
} from './comment.services.helpers.js';

const mockDb = db as unknown as {
	select: MockedFunction<(...args: unknown[]) => unknown>;
	update: MockedFunction<(...args: unknown[]) => unknown>;
};

const sampleUUID = convertToUUID(sampleSUUID);

describe('Comment Service Helper Functions', () => {
	vi.mock('@/db/index.js', () => ({
		db: {
			select: vi.fn(),
			update: vi.fn(),
		},
	}));

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('commentExists function', () => {
		beforeEach(() => {
			vi.resetAllMocks();
		});

		it('should return undefined if comment with given id does not exist', async () => {
			const mockSelect = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([]),
			};

			mockDb.select.mockReturnValue(mockSelect);

			const result = await commentExists({ id: sampleSUUID });

			expect(mockDb.select).toHaveBeenCalledTimes(1);

			expect(mockSelect.from).toHaveBeenCalledWith(comment);
			expect(mockSelect.where).toHaveBeenCalledWith(eq(comment.id, sampleUUID));
			expect(result).toBeUndefined();
		});

		it('should return an object with parentCommentId as null if comment with given id exists and is a top level comment', async () => {
			const mockSelect = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([{ parentCommentId: null }]),
			};

			mockDb.select.mockReturnValue(mockSelect);

			const result = await commentExists({ id: sampleSUUID });

			expect(mockDb.select).toHaveBeenCalledTimes(1);

			expect(mockSelect.from).toHaveBeenCalledWith(comment);
			expect(mockSelect.where).toHaveBeenCalledWith(eq(comment.id, sampleUUID));
			expect(result).toEqual({ parentCommentId: null });
		});

		it('should return an object with parentCommentId as SUUID if comment with given id exists and is not a top level comment', async () => {
			const mockSelect = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([{ parentCommentId: sampleUUID }]),
			};

			mockDb.select.mockReturnValue(mockSelect);

			const result = await commentExists({ id: sampleSUUID });

			expect(mockDb.select).toHaveBeenCalledTimes(1);

			expect(mockSelect.from).toHaveBeenCalledWith(comment);
			expect(mockSelect.where).toHaveBeenCalledWith(eq(comment.id, sampleUUID));
			expect(result).toEqual({ parentCommentId: sampleSUUID });
		});
	});

	describe('updateParentCommentReplyCount function', () => {
		it('should increase the reply count of a comment with given id and type as "increase"', async () => {
			const mockUpdate = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue(true),
			};

			mockDb.update.mockReturnValue(mockUpdate);

			await updateParentCommentReplyCount({
				id: sampleSUUID,
				type: 'increase',
			});

			expect(mockDb.update).toHaveBeenCalledWith(comment);
			expect(mockUpdate.set).toHaveBeenCalledWith({
				repliesCount: sql`${comment.repliesCount} + 1`,
			});
			expect(mockUpdate.where).toHaveBeenCalledWith(eq(comment.id, sampleUUID));
		});

		it('should decrease the reply count of a comment with given id and type as "decrease"', async () => {
			const mockUpdate = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue(true),
			};

			mockDb.update.mockReturnValue(mockUpdate);

			await updateParentCommentReplyCount({
				id: sampleSUUID,
				type: 'decrease',
			});

			expect(mockDb.update).toHaveBeenCalledWith(comment);
			expect(mockUpdate.set).toHaveBeenCalledWith({
				repliesCount: sql`${comment.repliesCount} - 1`,
			});
			expect(mockUpdate.where).toHaveBeenCalledWith(eq(comment.id, sampleUUID));
		});
	});
});
