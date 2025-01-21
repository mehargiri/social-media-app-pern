import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	collegeExists,
	deleteCollegeById,
	makeCollege,
	updateCollegeById,
} from './college.services.js';
import { CollegeType } from './college.zod.schemas.js';

export const createCollege = async (
	req: Request<never, never, CollegeType>,
	res: Response
) => {
	await makeCollege({ ...req.body, userId: req.userId as SUUID });
	return void res.sendStatus(201);
};

export const updateCollege = async (
	req: Request<{ id: SUUID }, never, CollegeType>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	const isCollege = await collegeExists({ id });
	if (!isCollege) throw Error('College does not exist', { cause: 404 });

	const updatedCollege = await updateCollegeById({
		...req.body,
		updatedAt: new Date(),
		id,
		userId: req.userId as SUUID,
	});

	return void res.json(updatedCollege);
};

export const deleteCollege = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	const isCollege = await collegeExists({ id });
	if (!isCollege) throw Error('College does not exist', { cause: 404 });

	await deleteCollegeById({ id, userId: req.userId as SUUID });

	return void res.json({ message: 'College deleted successfully!' });
};
