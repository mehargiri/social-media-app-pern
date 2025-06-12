import { db } from '@/db/index.js';
import { college } from '@/db/schema/college.js';
import { convertToUUID } from '@/utils/general.utils.js';
import { createTestCollege, sampleSUUID } from '@/utils/test.utils.js';
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
import { collegeExists } from './college.services.helpers.js';
import {
	deleteCollegeById,
	makeCollege,
	updateCollegeById,
} from './college.services.js';
import { CollegeType } from './college.zod.schemas.js';

const testCollege = createTestCollege();
testCollege.userId = sampleSUUID;

const sampleUUID = convertToUUID(sampleSUUID);

describe('College Service Functions', () => {
	vi.mock('@/db/index.js', () => ({
		db: {
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	}));

	vi.mock('./College.services.helpers.js', () => ({
		collegeExists: vi.fn(),
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

	describe('makeCollege function', () => {
		it('should create a new College row successfully', async () => {
			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

			mockDb.insert.mockReturnValue({ values: mockValues });

			const result = await makeCollege({
				...(testCollege as CollegeType & { userId: SUUID }),
			});

			expect(mockDb.insert).toHaveBeenCalledWith(college);
			expect(mockValues).toHaveBeenCalledWith({
				...(testCollege as CollegeType & { userId: SUUID }),
				userId: sampleUUID,
			});
			expect(mockReturning).toHaveBeenCalledWith({ id: college.id });

			expect(result).toEqual({ id: sampleSUUID });
		});
	});
	describe('updateCollegeById function', () => {
		it('should throw Error if College with provided id does not exist', async () => {
			(collegeExists as Mock).mockResolvedValue(false);

			await expect(
				updateCollegeById({
					...(testCollege as CollegeType & { userId: SUUID }),
					id: sampleSUUID,
				})
			).rejects.toThrow(Error('College does not exist', { cause: 404 }));

			expect(collegeExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.update).not.toHaveBeenCalled();
		});

		it('should update an existing College row with new data and new updatedAt date successfully', async () => {
			(collegeExists as Mock).mockResolvedValue(true);

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { userId, ...updateData } = testCollege;
			const mockDate = new Date('2025-01-01');
			vi.setSystemTime(mockDate);

			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
			const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
			mockDb.update.mockReturnValue({ set: mockSet });

			const result = await updateCollegeById({
				...(testCollege as CollegeType & { userId: SUUID }),
				id: sampleSUUID,
			});

			expect(collegeExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.update).toHaveBeenCalledWith(college);

			expect(mockSet).toHaveBeenCalledWith({
				...updateData,
				updatedAt: mockDate,
			});

			expect(result).toEqual({ id: sampleSUUID });
			vi.useRealTimers();
		});
	});
	describe('deleteCollegeById function', () => {
		it('should throw Error if College with provided id does not exist', async () => {
			(collegeExists as Mock).mockResolvedValue(false);

			await expect(
				deleteCollegeById({
					userId: testCollege.userId as SUUID,
					id: sampleSUUID,
				})
			).rejects.toThrow(Error('College does not exist', { cause: 404 }));

			expect(collegeExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.delete).not.toHaveBeenCalled();
		});

		it('should delete an existing row successfully', async () => {
			(collegeExists as Mock).mockResolvedValue(true);

			const { userId } = testCollege;

			const mockReturning = vi.fn().mockResolvedValue(dbResponse);
			const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
			mockDb.delete.mockReturnValue({ where: mockWhere });

			const result = await deleteCollegeById({
				id: sampleSUUID,
				userId: userId as SUUID,
			});

			expect(collegeExists).toHaveBeenCalledWith({ id: sampleSUUID });
			expect(mockDb.delete).toHaveBeenCalledWith(college);

			expect(result).toEqual({ id: sampleSUUID });
		});
	});
});
