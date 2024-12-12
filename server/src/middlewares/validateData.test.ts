/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { loginUserSchema } from '@/zod-schemas/user.js';
import { NextFunction, Request, Response } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import validateData from './validateData.js';

describe('validateData Middleware Function', () => {
	const testEmail = 'test@email.com';
	const testPassword = 'Password123!';

	const req = {
		body: {
			email: testEmail,
			password: testPassword,
		},
	};

	const res = {
		status: vi.fn().mockReturnThis(),
		json: vi.fn(),
	};

	const next = vi.fn() as NextFunction;

	beforeEach(() => {
		req.body.email = testEmail;
		req.body.password = testPassword;
	});

	afterAll(() => {
		vi.resetAllMocks();
	});

	it('should call next when the data validation passes', () => {
		const middleware = validateData(loginUserSchema);
		middleware(req as unknown as Request, res as unknown as Response, next);

		expect(next).toHaveBeenCalled();
	});

	it('should handle ZodError with HTTP 400 and message when data validation fails', () => {
		req.body.email = 'testemail.com';
		req.body.password = '';

		const middleware = validateData(loginUserSchema);
		middleware(req as unknown as Request, res as unknown as Response, next);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			error: expect.arrayContaining([
				'email: Email must be valid',
				'password: Password is required',
			]),
		});
	});

	it('should throw any non ZodErrors', () => {
		const error = new Error('Some random error');
		vi.spyOn(loginUserSchema, 'parse').mockImplementation(() => {
			throw error;
		});

		const middleware = validateData(loginUserSchema);
		expect(() => {
			middleware(req as unknown as Request, res as unknown as Response, next);
		}).toThrow(error);
	});
});
