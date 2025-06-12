import { db } from '@/db/index.js';
import { work } from '@/db/schema/work.js';
import { sampleSUUID } from '@/utils/test.utils.js';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { workExists } from './work.services.helpers.js';

describe('Work Service Helper Functions', () => {
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

	describe('workExists function', () => {
		const mockFrom = vi.fn();
		const mockWhere = vi.fn();

		it('should return false if work with given id does not exist', async () => {
			mockDb.select.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockResolvedValue([]);

			const result = await workExists({ id: sampleSUUID });

			expect(result).toEqual(false);
			expect(mockDb.select).toHaveBeenCalledWith({ company: work.company });
			expect(mockFrom).toHaveBeenCalledWith(work);
		});

		it('should return true if work with given id exists', async () => {
			mockDb.select.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockResolvedValue([{ company: 'Test Company' }]);

			const result = await workExists({ id: sampleSUUID });

			expect(result).toEqual(true);
			expect(mockDb.select).toHaveBeenCalledWith({
				company: work.company,
			});
			expect(mockFrom).toHaveBeenCalledWith(work);
		});
	});
});
