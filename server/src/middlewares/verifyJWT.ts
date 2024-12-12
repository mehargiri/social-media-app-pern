import { CustomPayload } from '@/controllers/auth.controllers.js';
import { TOKEN_CONFIG } from '@/utils/auth.utils.js';
import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';

export default function (req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		res.sendStatus(401);
		return;
	}

	const token = authHeader.split(' ')[1];

	if (!token) {
		res.sendStatus(401);
		return;
	}

	verify(token, TOKEN_CONFIG.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			res.sendStatus(403);
			return;
		}

		const payload = decoded as CustomPayload;
		req.userId = payload.acc;
		next();
	});
}
