import { db } from '@/db/index.js';
import { work } from '@/db/schema/work.js';
import { convertToUUID } from '@/utils/general.utils.js';
import { createTestWork, sampleSUUID } from '@/utils/test.utils.js';
import { SUUID } from 'short-uuid';
import {
	beforeEach,
	describe,
	expect,
	it,
	Mock,
	MockedFunction,
	vi,
} from 'vitest';
import { workExists } from './work.services.helpers.js';
import { deleteWorkById, makeWork, updateWorkById } from './work.services.js';
import { WorkType } from './work.zod.schemas.js';

const testWork = createTestWork();
testWork.userId = sampleSUUID;

const sampleUUID = convertToUUID(sampleSUUID);

describe('Work Service Functions', () => {
	vi.mock('@/db/index.js', () => ({
		db: {
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	}));

	vi.mock('./work.services.helpers.js', () => ({
		workExists: vi.fn(),
	}));

	beforeEach(() => {
		vi.resetAllMocks();
	});

	const mockDb = db as unknown as {
		insert: MockedFunction<(...args: unknown[]) => unknown>;
		update: MockedFunction<(...args: unknown[]) => unknown>;
		delete: MockedFunction<(...args: unknown[]) => unknown>;
	};

	const dbResponse = [{ id: sampleUUID }];

	describe('makeWork function', () => {
		it('should create a new work row successfully', async () => {
			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

			mockDb.insert.mockReturnValue({ values: mockValues });

			const result = await makeWork({
				...(testWork as WorkType & { userId: SUUID }),
			});

			expect(mockDb.insert).toHaveBeenCalledWith(work);
			expect(mockValues).toHaveBeenCalledWith({
				...testWork,
				userId: sampleUUID,
			});
			expect(mockReturning).toHaveBeenCalledWith({ id: work.id });

			expect(result).toEqual({ id: sampleSUUID });
		});
	});
	describe('updateWorkById function', () => {
		it('should throw Error if work with provided id does not exist', async () => {
			(workExists as Mock).mockResolvedValue(false);

			await expect(
				updateWorkById({
					...(testWork as WorkType & { userId: SUUID }),
					id: sampleSUUID,
				})
			).rejects.toThrow(Error('Work does not exist', { cause: 404 }));

			expect(workExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.update).not.toHaveBeenCalled();
		});

		it('should update an existing work row with new data and new updatedAt date successfully', async () => {
			(workExists as Mock).mockResolvedValue(true);

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { userId, ...updateData } = testWork;
			const mockDate = new Date('2025-01-01');
			vi.setSystemTime(mockDate);

			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
			const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
			mockDb.update.mockReturnValue({ set: mockSet });

			const result = await updateWorkById({
				...(testWork as WorkType & { userId: SUUID }),
				id: sampleSUUID,
			});

			expect(workExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.update).toHaveBeenCalledWith(work);

			expect(mockSet).toHaveBeenCalledWith({
				...updateData,
				updatedAt: mockDate,
			});

			expect(result).toEqual({ id: sampleSUUID });
			vi.useRealTimers();
		});
	});
	describe('deleteWorkById function', () => {
		it('should throw Error if work with provided id does not exist', async () => {
			(workExists as Mock).mockResolvedValue(false);

			await expect(
				deleteWorkById({
					userId: testWork.userId as SUUID,
					id: sampleSUUID,
				})
			).rejects.toThrow(Error('Work does not exist', { cause: 404 }));

			expect(workExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.delete).not.toHaveBeenCalled();
		});

		it('should delete an existing row successfully', async () => {
			(workExists as Mock).mockResolvedValue(true);

			const { userId } = testWork;

			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
			mockDb.delete.mockReturnValue({ where: mockWhere });

			const result = await deleteWorkById({
				id: sampleSUUID,
				userId: userId as SUUID,
			});

			expect(workExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.delete).toHaveBeenCalledWith(work);

			expect(result).toEqual({ id: sampleSUUID });
		});
	});
});
