import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	deleteHighschoolById,
	highschoolExists,
	makeHighschool,
	updateHighschoolById,
} from './highschool.services.js';
import {
	CreateHighschoolType,
	UpdateHighschoolType,
} from './highschool.zod.schemas.js';

export const createHighschool = async (
	req: Request<never, never, CreateHighschoolType>,
	res: Response
) => {
	await makeHighschool({
		...req.body,
		userId: req.userId as SUUID,
	});
	return void res.sendStatus(201);
};

export const updateHighschool = async (
	req: Request<{ id: SUUID }, never, UpdateHighschoolType>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	const isHighschool = await highschoolExists({ id });
	if (!isHighschool) throw Error('Highschool does not exist', { cause: 404 });

	const updatedHighschool = await updateHighschoolById({
		...req.body,
		userId: req.userId as SUUID,
		id,
		updatedAt: new Date(),
	});

	return void res.json(updatedHighschool);
};

export const deleteHighschool = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	const isHighschool = await highschoolExists({ id });
	if (!isHighschool) throw Error('Highschool does not exist', { cause: 404 });

	await deleteHighschoolById({ id, userId: req.userId as SUUID });
	return void res.json({ message: 'Highschool deleted successfully' });
};
