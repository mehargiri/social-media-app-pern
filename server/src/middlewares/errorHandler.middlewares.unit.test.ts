import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import errorHandler from './errorHandler.middlewares.js';

describe('errorHandler Middleware Function', () => {
	let error: Error | MulterError;
	const req = {} as Request;
	const res = {
		status: vi.fn().mockReturnThis(),
		json: vi.fn(),
		sendStatus: vi.fn(),
	};
	const next = vi.fn() as NextFunction;

	const callTestFn = (error: Error) => {
		errorHandler(error, req, res as unknown as Response, next);
	};

	afterAll(() => {
		vi.resetAllMocks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should call res.json with error message and res.status with response status when an error has a message and a cause', () => {
		callTestFn(Error('Invalid Credentials', { cause: 401 }));

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({ error: 'Invalid Credentials' });
	});

	it('should call res.sendStatus with response status when an error only has a cause', () => {
		callTestFn(Error('', { cause: 403 }));

		expect(res.sendStatus).toHaveBeenCalledWith(403);
	});

	it('should handle MulterError for unexpected file type', () => {
		error = new MulterError('LIMIT_UNEXPECTED_FILE');

		callTestFn(error);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			error: expect.stringContaining(
				'Invalid file type. Allowed: png and jpg/jpeg.'
			) as string,
		});
	});

	it('should handle MulterError for unsupported file size', () => {
		error = new MulterError('LIMIT_FILE_SIZE');

		callTestFn(error);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			error: 'File size exceeds the limit. Allowed max: 1MB',
		});
	});

	it('should handle unexpected error with HTTP 500', () => {
		error = new Error('Some Random Error');

		callTestFn(error);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({
			error: 'Something went wrong. Try again later!',
		});
	});

	it('should console.log the unexpected error', () => {
		error = new Error('Some Random Error');

		console.error = vi.fn();

		callTestFn(error);

		expect(console.error).toHaveBeenCalledWith(error);
	});
});
