/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import errorHandler from './errorHandler.js';

describe('errorHandler Middleware Function', () => {
	let error: Error | MulterError;
	const req = {} as Request;
	const res = {
		status: vi.fn().mockReturnThis(),
		json: vi.fn(),
	};
	const next = vi.fn() as NextFunction;

	afterAll(() => {
		vi.resetAllMocks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each([[400], [401], [404], [422]])(
		'should handle HTTP errors by sending a proper message, HTTP error: %i',
		(errorCode) => {
			error = new Error('', { cause: errorCode });

			errorHandler(error, req, res as unknown as Response, next);

			expect(res.status).toHaveBeenCalledWith(errorCode);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ error: expect.any(String) })
			);
		}
	);

	it('should handle MulterError for unexpected file type', () => {
		error = new MulterError('LIMIT_UNEXPECTED_FILE');

		errorHandler(error, req, res as unknown as Response, next);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			error: expect.stringContaining(
				'Invalid file type. Allowed: png and jpg/jpeg.'
			),
		});
	});

	it('should handle MulterError for unsupported file size', () => {
		error = new MulterError('LIMIT_FILE_SIZE');

		errorHandler(error, req, res as unknown as Response, next);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			error: 'File size exceeds the limit. Allowed max: 10MB',
		});
	});

	it('should handle unexpected error with HTTP 500', () => {
		error = new Error('Some Random Error');

		errorHandler(error, req, res as unknown as Response, next);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({
			error: 'Something went wrong. Try again later!',
		});
	});

	it('should console.log the unexpected error', () => {
		error = new Error('Some Random Error');

		console.error = vi.fn();

		errorHandler(error, req, res as unknown as Response, next);

		expect(console.error).toHaveBeenCalledWith(error);
	});
});
