import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	deleteWorkById,
	makeWork,
	updateWorkById,
	workExists,
} from './work.services.js';
import { WorkType } from './work.zod.schemas.js';

export const createWork = async (
	req: Request<never, never, WorkType>,
	res: Response
) => {
	await makeWork({ ...req.body, userId: req.userId as SUUID });
	return void res.sendStatus(201);
};

export const updateWork = async (
	req: Request<{ id: SUUID }, never, WorkType>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'work');

	const isWork = await workExists({ id });
	if (!isWork) throw Error('Work does not exist', { cause: 404 });

	const updatedWork = await updateWorkById({
		...req.body,
		id,
		userId: req.userId as SUUID,
		updatedAt: new Date(),
	});

	return void res.json(updatedWork);
};

export const deleteWork = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'work');

	const isWork = await workExists({ id });
	if (!isWork) throw Error('Work does not exist', { cause: 404 });

	await deleteWorkById({ id, userId: req.userId as SUUID });

	return void res.json({ message: 'Work deleted successfully' });
};
