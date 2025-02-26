import { createTestHighSchool, sampleSUUID } from '@/utils/test.utils.js';
import { Request, Response } from 'express';
import { generate, SUUID } from 'short-uuid';
import { afterAll, beforeAll, describe, expect, it, Mock, vi } from 'vitest';
import {
	createHighschool,
	deleteHighschool,
	updateHighschool,
} from './highschool.controllers.js';
import {
	deleteHighschoolById,
	highschoolExists,
	makeHighschool,
	updateHighschoolById,
} from './highschool.services.js';
import { HighschoolType } from './highschool.zod.schemas.js';

const testHighschool = createTestHighSchool();
testHighschool.userId = sampleSUUID;

describe('Highschool Controller Functions', () => {
	const req = {
		params: {
			id: sampleSUUID,
		},
	};

	const res = {
		sendStatus: vi.fn(),
		json: vi.fn(),
	};

	vi.mock('./highschool.services.ts', () => ({
		makeHighschool: vi.fn(),
		updateHighschoolById: vi.fn(),
		deleteHighschoolById: vi.fn(),
		highschoolExists: vi.fn(),
	}));

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('createHighschool function', () => {
		it('should call makeHighschool and res.sendStatus with HTTP 201 on success', async () => {
			(makeHighschool as Mock).mockResolvedValue({ id: sampleSUUID });
			await createHighschool(
				req as unknown as Request<never, never, HighschoolType>,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenCalledWith(201);
		});
	});

	describe('updateHighschool function', () => {
		beforeAll(() => {
			vi.resetAllMocks();
		});

		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await updateHighschool(
				req as unknown as Request<{ id: SUUID }, never, HighschoolType>,
				res as unknown as Response
			);
		};

		it('should throw Error when invalid id is provided in the request params', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for highschool', { cause: 400 })
			);
		});

		it('should throw Error when highschool with the given id in the request params does not exits', async () => {
			await expect(callTestFn(generate())).rejects.toThrowError(
				Error('Highschool does not exist', { cause: 404 })
			);
		});

		it('should call res.json with the same id present in request params on success', async () => {
			(highschoolExists as Mock).mockResolvedValue(true);
			(updateHighschoolById as Mock).mockResolvedValue({ id: sampleSUUID });

			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({ id: sampleSUUID });
		});
	});

	describe('deleteHighschool function', () => {
		beforeAll(() => {
			vi.resetAllMocks();
		});

		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await deleteHighschool(
				req as unknown as Request<{ id: SUUID }>,
				res as unknown as Response
			);
		};

		it('should throw Error when invalid id is provided in the request params', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required for highschool', { cause: 400 })
			);
		});

		it('should throw Error when highschool with the given id in the request params does not exists', async () => {
			await expect(callTestFn(generate())).rejects.toThrowError(
				Error('Highschool does not exist', { cause: 404 })
			);
		});

		it('should call res.json with a message on success', async () => {
			(highschoolExists as Mock).mockResolvedValue(true);
			(deleteHighschoolById as Mock).mockResolvedValue({
				id: sampleSUUID,
			});

			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({
				message: 'Highschool deleted successfully',
			});
		});
	});
});
