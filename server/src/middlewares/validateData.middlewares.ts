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
							typeof issue.path[0] === 'string' ? issue.path[0] : 'Unknown-path'
						}: ${issue.message}`
				);
				return void res.status(400).json({ error: message });
			} else {
				throw error;
			}
		}
	};
}
