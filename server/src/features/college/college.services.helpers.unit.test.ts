import { db } from '@/db/index.js';
import { college } from '@/db/schema/college.js';
import { sampleSUUID } from '@/utils/test.utils.js';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { collegeExists } from './college.services.helpers.js';

describe('College Service Helper Functions', () => {
	vi.mock('@/db/index.js', () => ({
		db: {
			select: vi.fn(),
		},
	}));

	beforeEach(() => {
		vi.resetAllMocks();
	});

	const mockDb = db as unknown as {
		select: MockedFunction<(...args: unknown[]) => unknown>;
	};

	describe('collegeExists function', () => {
		const mockFrom = vi.fn();
		const mockWhere = vi.fn();

		it('should return false if college with given id does not exist', async () => {
			mockDb.select.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockResolvedValue([]);

			const result = await collegeExists({ id: sampleSUUID });

			expect(result).toEqual(false);
			expect(mockDb.select).toHaveBeenCalledWith({ name: college.name });
			expect(mockFrom).toHaveBeenCalledWith(college);
		});

		it('should return true if college with given id exists', async () => {
			mockDb.select.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockResolvedValue([{ name: 'Test college' }]);

			const result = await collegeExists({ id: sampleSUUID });

			expect(result).toEqual(true);
			expect(mockDb.select).toHaveBeenCalledWith({
				name: college.name,
			});
			expect(mockFrom).toHaveBeenCalledWith(college);
		});
	});
});
