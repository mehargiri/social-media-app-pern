import { db } from '@/db/index.js';
import { work } from '@/db/schema/index.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { WorkType } from './work.zod.schemas.js';

export const makeWork = async (data: WorkType & { userId: SUUID }) => {
	const { userId, ...goodData } = data;
	const newWork = await db
		.insert(work)
		.values({ ...goodData, userId: convertToUUID(userId) })
		.returning({ id: work.id });

	const newWorkWithSUUID = newWork.map((work) => ({
		...work,
		id: convertToSUUID(work.id),
	}));

	return newWorkWithSUUID[0];
};

export const updateWorkById = async (
	data: WorkType & { id: SUUID; userId: SUUID; updatedAt: Date }
) => {
	const { id, userId, ...goodData } = data;
	const updatedWork = await db
		.update(work)
		.set(goodData)
		.where(
			and(
				eq(work.id, convertToUUID(id)),
				eq(work.userId, convertToUUID(userId))
			)
		)
		.returning({ id: work.id });

	const updatedWorkWithSUUID = updatedWork.map((work) => ({
		...work,
		id: convertToSUUID(work.id),
	}));
	return updatedWorkWithSUUID[0];
};

export const deleteWorkById = async (data: { id: SUUID; userId: SUUID }) => {
	const { id, userId } = data;

	const deletedWork = await db
		.delete(work)
		.where(
			and(
				eq(work.id, convertToUUID(id)),
				eq(work.userId, convertToUUID(userId))
			)
		)
		.returning({ id: work.id });

	const deletedWorkWithSUUID = deletedWork.map((work) => ({
		...work,
		id: convertToSUUID(work.id),
	}));

	return deletedWorkWithSUUID[0];
};

export const workExists = async (data: { id: SUUID }) => {
	const workData = await db
		.select({ company: work.company })
		.from(work)
		.where(eq(work.id, convertToUUID(data.id)));

	return workData[0] ? true : false;
};
