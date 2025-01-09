import { CustomPayload } from '@/features/auth/auth.controllers.js';
import { TOKEN_CONFIG } from '@/features/auth/auth.utils.js';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export default function (req: Request, _res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		throw Error('', { cause: 401 });
	}

	const token = authHeader.split(' ')[1];

	if (!token) {
		throw Error('', { cause: 401 });
	}

	jwt.verify(token, TOKEN_CONFIG.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			throw Error('', { cause: 403 });
		}

		req.userId = (decoded as CustomPayload).acc;
		next();
	});
}
