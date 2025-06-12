import { createTestWork, sampleSUUID } from '@/utils/test.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import { afterAll, beforeAll, describe, expect, it, Mock, vi } from 'vitest';
import { createWork, deleteWork, updateWork } from './work.controllers.js';
import { deleteWorkById, updateWorkById } from './work.services.js';
import { WorkType } from './work.zod.schemas.js';

const testWork = createTestWork();
testWork.userId = sampleSUUID;

describe('Work Controller Function', () => {
	const req = {
		body: testWork,
		params: { id: sampleSUUID },
	};

	const res = {
		sendStatus: vi.fn(),
		json: vi.fn(),
	};

	vi.mock('./work.services.ts', () => ({
		makeWork: vi.fn(),
		workExists: vi.fn(),
		updateWorkById: vi.fn(),
		deleteWorkById: vi.fn(),
	}));

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('createWork function', () => {
		it('should call res.sendStatus with HTTP 201 on success', async () => {
			await createWork(
				req as unknown as Request<never, never, WorkType>,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenCalledWith(201);
		});
	});

	describe('updateWork function', () => {
		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await updateWork(
				req as unknown as Request<{ id: SUUID }, never, WorkType>,
				res as unknown as Response
			);
		};

		it('should throw Error when the provided id in req.params is invalid', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for work', { cause: 400 })
			);
		});

		it('should call res.json with the updated id on success', async () => {
			(updateWorkById as Mock).mockResolvedValue({ id: sampleSUUID });
			await callTestFn(sampleSUUID);

			expect(res.json).toHaveBeenCalledWith({ id: sampleSUUID });
		});
	});

	describe('deleteWork function', () => {
		beforeAll(() => {
			vi.resetAllMocks();
		});

		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await deleteWork(
				req as unknown as Request<{ id: SUUID; userId: SUUID }>,
				res as unknown as Response
			);
		};

		it('should throw Error when the provided id in req.params is invalid', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for work', { cause: 400 })
			);
		});

		it('should call res.json with a custom message on success', async () => {
			(deleteWorkById as Mock).mockResolvedValue({ id: sampleSUUID });
			await callTestFn(sampleSUUID);

			expect(res.json).toHaveBeenCalledWith({
				message: 'Work deleted successfully',
			});
		});
	});
});
