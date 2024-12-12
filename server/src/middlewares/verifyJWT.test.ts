import { CustomPayload } from '@/controllers/auth.controllers.js';
import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, verify, VerifyCallback } from 'jsonwebtoken';
import { afterAll, describe, expect, it, Mock, vi } from 'vitest';
import verifyJWT from './verifyJWT.js';

describe('verifyJWT Middleware Function', () => {
	let req: Request;
	const res = {
		sendStatus: vi.fn(),
	};
	const next = vi.fn() as NextFunction;

	vi.mock(import('jsonwebtoken'), async (importOriginal) => {
		const actualModule = await importOriginal();
		return {
			...actualModule,
			verify: vi.fn(),
		};
	});

	afterAll(() => {
		vi.resetAllMocks();
	});

	it.each([
		['is missing', ''],
		['does not start with "Bearer"', 'random-token'],
		['does not have a token after "Bearer"', 'Bearer '],
	])(
		'should send status of HTTP 401 when the authorization header %s, token:%s',
		(_message, token) => {
			req = {
				headers: {
					authorization: token === '' ? undefined : token,
				},
			} as unknown as Request;

			verifyJWT(req, res as unknown as Response, next);
			expect(res.sendStatus).toHaveBeenCalledWith(401);
		}
	);

	it('should send status of HTTP 403 if token verification fails', () => {
		req = {
			headers: {
				authorization: 'Bearer invalidToken',
			},
		} as unknown as Request;

		(verify as Mock).mockImplementation(
			(_token, _secret, callback: VerifyCallback) => {
				callback(new Error('Invalid Token') as JsonWebTokenError, undefined);
			}
		);

		verifyJWT(req, res as unknown as Response, next);
		expect(res.sendStatus).toHaveBeenCalledWith(403);
		expect(next).not.toHaveBeenCalled();
	});

	it('should set req.userId and call next if token verification succeeds', () => {
		const payload = { acc: 'user-with-SUUID' } as CustomPayload;
		req = {
			headers: {
				authorization: 'Bearer goodToken',
			},
		} as unknown as Request;

		(verify as Mock).mockImplementation(
			(_token, _secret, callback: VerifyCallback) => {
				callback(null, payload.acc);
			}
		);

		verifyJWT(req, res as unknown as Response, next);
		expect(next).toHaveBeenCalled();
	});
});
