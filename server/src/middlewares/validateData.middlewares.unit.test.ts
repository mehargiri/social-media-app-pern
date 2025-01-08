import { sampleEmail, samplePassword } from '@/utils/test.utils.js';
import { loginUserSchema } from '@/zod-schemas/user.js';
import { NextFunction, Request, Response } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import validateData from './validateData.middlewares.js';

describe('validateData Middleware Function', () => {
	const req = {
		body: {
			email: sampleEmail,
			password: samplePassword,
		},
	};

	const res = {
		status: vi.fn().mockReturnThis(),
		json: vi.fn(),
	};

	const next = vi.fn() as NextFunction;

	const callTestFn = () => {
		const middleware = validateData(loginUserSchema);
		middleware(req as unknown as Request, res as unknown as Response, next);
	};

	beforeEach(() => {
		req.body.email = sampleEmail;
		req.body.password = samplePassword;
	});

	afterAll(() => {
		vi.resetAllMocks();
	});

	it('should call next when the data validation passes', () => {
		callTestFn();

		expect(next).toHaveBeenCalled();
	});

	it('should handle ZodError with HTTP 400 and message when data validation fails', () => {
		req.body.email = 'testemail.com';
		req.body.password = '';

		callTestFn();

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			error: expect.arrayContaining([
				'email: Email must be valid',
				'password: Password is required',
			]) as string[],
		});
	});

	it('should throw any non ZodErrors', () => {
		const error = new Error('Some random error');
		vi.spyOn(loginUserSchema, 'parse').mockImplementation(() => {
			throw error;
		});

		expect(() => {
			callTestFn();
		}).toThrow(error);
	});
});
