import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	deleteHighschoolById,
	makeHighschool,
	updateHighschoolById,
} from './highschool.services.js';
import { HighschoolType } from './highschool.zod.schemas.js';

export const createHighschool = async (
	req: Request<never, never, HighschoolType>,
	res: Response
) => {
	await makeHighschool({
		...req.body,
		userId: req.userId as SUUID,
	});
	return void res.sendStatus(201);
};

export const updateHighschool = async (
	req: Request<{ id: SUUID }, never, HighschoolType>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'highschool');

	const updatedHighschool = await updateHighschoolById({
		...req.body,
		id,
		userId: req.userId as SUUID,
	});

	return void res.json(updatedHighschool);
};

export const deleteHighschool = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'highschool');

	await deleteHighschoolById({ id, userId: req.userId as SUUID });
	return void res.json({ message: 'Highschool deleted successfully' });
};
