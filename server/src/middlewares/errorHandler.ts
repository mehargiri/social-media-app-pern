import { NextFunction, Request, Response } from 'express';

export default function (
	err: Error,
	_req: Request,
	res: Response,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_next: NextFunction
) {
	switch (err.cause) {
		case 401:
		case 404:
		case 400:
			res.status(err.cause).json({ error: err.message });
			return;
	}

	if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
		res.status(401).json({ error: 'Invalid token' });
		return;
	} else {
		console.error(err);
		res.status(500).json({ error: 'Something went wrong. Try again later!' });
		return;
	}
}
