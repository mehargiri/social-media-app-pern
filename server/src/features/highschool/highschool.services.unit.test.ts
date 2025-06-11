import { db } from '@/db/index.js';
import { highschool } from '@/db/schema/highschool.js';
import { convertToUUID } from '@/utils/general.utils.js';
import { createTestHighSchool, sampleSUUID } from '@/utils/test.utils.js';
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
import { highschoolExists } from './highschool.services.helpers.js';
import {
	deleteHighschoolById,
	makeHighschool,
	updateHighschoolById,
} from './highschool.services.js';
import { HighschoolType } from './highschool.zod.schemas.js';

const testHighschool = createTestHighSchool();
testHighschool.userId = sampleSUUID;

const sampleUUID = convertToUUID(sampleSUUID);

describe('Highschool Service Functions', () => {
	vi.mock('@/db/index.js', () => ({
		db: {
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	}));

	vi.mock('./highschool.services.helpers.js', () => ({
		highschoolExists: vi.fn(),
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

	describe('makeHighschool function', () => {
		it('should create a new highschool row successfully', async () => {
			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

			mockDb.insert.mockReturnValue({ values: mockValues });

			const result = await makeHighschool({
				...(testHighschool as HighschoolType & { userId: SUUID }),
			});

			expect(mockDb.insert).toHaveBeenCalledWith(highschool);
			expect(mockValues).toHaveBeenCalledWith({
				...(testHighschool as HighschoolType & { userId: SUUID }),
				userId: sampleUUID,
			});
			expect(mockReturning).toHaveBeenCalledWith({ id: highschool.id });

			expect(result).toEqual({ id: sampleSUUID });
		});
	});
	describe('updateHighschoolById function', () => {
		it('should throw Error if highschool with provided id does not exist', async () => {
			(highschoolExists as Mock).mockResolvedValue(false);

			await expect(
				updateHighschoolById({
					...(testHighschool as HighschoolType & { userId: SUUID }),
					id: sampleSUUID,
				})
			).rejects.toThrow(Error('Highschool does not exist', { cause: 404 }));

			expect(highschoolExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.update).not.toHaveBeenCalled();
		});

		it('should update an existing highschool row with new data and new updatedAt date successfully', async () => {
			(highschoolExists as Mock).mockResolvedValue(true);

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { userId, ...updateData } = testHighschool;
			const mockDate = new Date('2025-01-01');
			vi.setSystemTime(mockDate);

			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
			const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
			mockDb.update.mockReturnValue({ set: mockSet });

			const result = await updateHighschoolById({
				...(testHighschool as HighschoolType & { userId: SUUID }),
				id: sampleSUUID,
			});

			expect(highschoolExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.update).toHaveBeenCalledWith(highschool);

			expect(mockSet).toHaveBeenCalledWith({
				...updateData,
				updatedAt: mockDate,
			});

			expect(result).toEqual({ id: sampleSUUID });
			vi.useRealTimers();
		});
	});
	describe('deleteHighschoolById function', () => {
		it('should throw Error if highschool with provided id does not exist', async () => {
			(highschoolExists as Mock).mockResolvedValue(false);

			await expect(
				deleteHighschoolById({
					userId: testHighschool.userId as SUUID,
					id: sampleSUUID,
				})
			).rejects.toThrow(Error('Highschool does not exist', { cause: 404 }));

			expect(highschoolExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.delete).not.toHaveBeenCalled();
		});

		it('should delete an existing row successfully', async () => {
			(highschoolExists as Mock).mockResolvedValue(true);

			const { userId } = testHighschool;

			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
			mockDb.delete.mockReturnValue({ where: mockWhere });

			const result = await deleteHighschoolById({
				id: sampleSUUID,
				userId: userId as SUUID,
			});

			expect(highschoolExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.delete).toHaveBeenCalledWith(highschool);

			expect(result).toEqual({ id: sampleSUUID });
		});
	});
});
