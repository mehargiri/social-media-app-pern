import { db } from '@/db/index.js';
import { highschool } from '@/db/schema/highschool.js';
import { sampleSUUID } from '@/utils/test.utils.js';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { highschoolExists } from './highschool.services.helpers.js';

describe('Highschool Service Helper Functions', () => {
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

	describe('highschoolExists function', () => {
		const mockFrom = vi.fn();
		const mockWhere = vi.fn();

		it('should return false if highschool with given id does not exist', async () => {
			mockDb.select.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockResolvedValue([]);

			const result = await highschoolExists({ id: sampleSUUID });

			expect(result).toEqual(false);
			expect(mockDb.select).toHaveBeenCalledWith({ name: highschool.name });
			expect(mockFrom).toHaveBeenCalledWith(highschool);
		});

		it('should return true if highschool with given id exists', async () => {
			mockDb.select.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockResolvedValue([{ name: 'Test Highschool' }]);

			const result = await highschoolExists({ id: sampleSUUID });

			expect(result).toEqual(true);
			expect(mockDb.select).toHaveBeenCalledWith({
				name: highschool.name,
			});
			expect(mockFrom).toHaveBeenCalledWith(highschool);
		});
	});
});
