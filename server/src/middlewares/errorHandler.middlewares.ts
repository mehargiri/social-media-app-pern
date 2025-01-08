import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';

export default function (
	err: Error,
	_req: Request,
	res: Response,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_next: NextFunction
) {
	if ((err.cause as number) >= 400 && err.message !== '') {
		return void res.status(err.cause as number).json({ error: err.message });
	}

	if ((err.cause as number) >= 400) {
		return void res.sendStatus(err.cause as number);
	}

	if (!Number(err.cause) && err.message === 'Update') {
		console.error(err.cause);
		return void res.status(422).json({ error: err.message });
	}

	if (err instanceof MulterError) {
		switch (err.code) {
			case 'LIMIT_UNEXPECTED_FILE':
				return void res.status(400).json({
					error: `Invalid file type. Allowed: png and jpg/jpeg. ${
						err.field ? `Invalid file in ${err.field}` : ''
					}`,
				});
			case 'LIMIT_FILE_SIZE':
				return void res
					.status(400)
					.json({ error: 'File size exceeds the limit. Allowed max: 10MB' });
		}
	}

	console.error(err);
	return void res
		.status(500)
		.json({ error: 'Something went wrong. Try again later!' });
}
