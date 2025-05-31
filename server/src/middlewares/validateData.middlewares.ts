import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

export default function (schema: ZodTypeAny) {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			schema.parse(req.body);
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const message = error.issues.map(
					(issue) =>
						`${
							Array.isArray(issue.path) &&
							issue.path.every((path) => typeof path === 'string')
								? issue.path.join(', ')
								: 'Unknown-path'
						}: ${issue.message}`
				);
				return void res.status(400).json({ error: message });
			} else {
				throw error;
			}
		}
	};
}
