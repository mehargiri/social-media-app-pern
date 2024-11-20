import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export default function (schema: AnyZodObject) {
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
				res.status(400).json({ error: message });
				return;
			} else {
				throw error;
			}
		}
	};
}
