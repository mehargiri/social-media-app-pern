import { createTestCollege, sampleSUUID } from '@/utils/test.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import { afterAll, beforeAll, describe, expect, it, Mock, vi } from 'vitest';
import {
	createCollege,
	deleteCollege,
	updateCollege,
} from './college.controllers.js';
import { deleteCollegeById, updateCollegeById } from './college.services.js';
import { CollegeType } from './college.zod.schemas.js';

const testCollege = createTestCollege();
testCollege.userId = sampleSUUID;

describe('College Controller Functions', () => {
	const req = {
		body: testCollege,
		params: {
			id: sampleSUUID,
		},
	};

	const res = {
		sendStatus: vi.fn(),
		json: vi.fn(),
	};

	vi.mock('./college.services.ts', () => ({
		makeCollege: vi.fn(),
		updateCollegeById: vi.fn(),
		deleteCollegeById: vi.fn(),
	}));

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('createCollege function', () => {
		it('should call res.sendStatus with HTTP 201 on success', async () => {
			await createCollege(
				req as unknown as Request<never, never, CollegeType>,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenCalledWith(201);
		});
	});

	describe('updateCollege function', () => {
		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await updateCollege(
				req as unknown as Request<{ id: SUUID }, never, CollegeType>,
				res as unknown as Response
			);
		};

		it('should throw Error when the provided id in req.params is invalid', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for college', { cause: 400 })
			);
		});

		it('should call res.json with the updated id on success', async () => {
			(updateCollegeById as Mock).mockResolvedValue({ id: sampleSUUID });

			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({ id: sampleSUUID });
		});
	});

	describe('deleteCollege function', () => {
		beforeAll(() => {
			vi.resetAllMocks();
		});

		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await deleteCollege(
				req as unknown as Request<{ id: SUUID; userId: SUUID }>,
				res as unknown as Response
			);
		};

		it('should throw Error when the provided id in req.params is invalid', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for college', { cause: 400 })
			);
		});

		it('should call res.json with a custom message', async () => {
			(deleteCollegeById as Mock).mockResolvedValue({ id: sampleSUUID });

			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({
				message: 'College deleted successfully',
			});
		});
	});
});
