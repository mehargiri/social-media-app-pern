import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';

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
		case 422:
			res.status(err.cause).json({ error: err.message });
			return;
	}

	if (err instanceof MulterError) {
		if (err.code === 'LIMIT_UNEXPECTED_FILE') {
			res.status(400).json({
				error: `Invalid file type. Allowed: png and jpg/jpeg. ${
					err.field ? `Invalid file in ${err.field}` : ''
				}`,
			});
			return;
		}

		if (err.code === 'LIMIT_FILE_SIZE') {
			res
				.status(400)
				.json({ error: 'File size exceeds the limit. Allowed max: 10MB' });
			return;
		}
	}

	console.error(err);
	res.status(500).json({ error: 'Something went wrong. Try again later!' });
	return;
}
