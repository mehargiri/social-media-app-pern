import { createAccessToken } from '@/features/auth/auth.utils.js';
import { sampleSUUID } from '@/utils/test.utils.js';
import { NextFunction, Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import { describe, expect, it, vi } from 'vitest';
import tokenHandler from './tokenHandler.middlewares.js';

describe('tokenHandler Middleware Function', () => {
	let req: Request;
	const res = {
		sendStatus: vi.fn(),
	};
	const next = vi.fn() as NextFunction;

	const callTestFn = () => {
		tokenHandler(req, res as unknown as Response, next);
	};

	it.each([
		['is missing', ''],
		['does not start with "Bearer"', 'random-token'],
		['does not have a token after "Bearer"', 'Bearer '],
	])(
		'should throw Error with 401 as the cause when the authorization header %s, token:%s',
		(_message, token) => {
			req = {
				headers: {
					authorization: token === '' ? undefined : token,
				},
			} as unknown as Request;

			expect(() => {
				callTestFn();
			}).toThrowError(Error('', { cause: 401 }));
		}
	);

	it('should throw Error with 403 as the cause if token verification fails', () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const token = createAccessToken('invalid-id' as SUUID);

		vi.advanceTimersByTime(2 * 60 * 1000);

		req = {
			headers: {
				authorization: `Bearer ${token}`,
			},
		} as unknown as Request;

		expect(() => {
			callTestFn();
		}).toThrowError(Error('', { cause: 403 }));

		expect(next).not.toHaveBeenCalled();

		vi.useRealTimers();
	});

	it('should set req.userId and call next if token verification succeeds', () => {
		const token = createAccessToken(sampleSUUID);
		req = {
			headers: {
				authorization: `Bearer ${token}`,
			},
		} as unknown as Request;

		callTestFn();
		expect(next).toHaveBeenCalled();
	});
});
