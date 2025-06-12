import { db } from '@/db/index.js';
import { work } from '@/db/schema/index.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { workExists } from './work.services.helpers.js';
import { WorkType } from './work.zod.schemas.js';

export const makeWork = async (data: WorkType & { userId: SUUID }) => {
	const { userId, ...goodData } = data;
	const newWork = await db
		.insert(work)
		.values({ ...goodData, userId: convertToUUID(userId) })
		.returning({ id: work.id });

	const [newWorkWithSUUID] = newWork.map((work) => ({
		...work,
		id: convertToSUUID(work.id),
	}));

	return newWorkWithSUUID;
};

export const updateWorkById = async (
	data: WorkType & { id: SUUID; userId: SUUID }
) => {
	const { id, userId, ...goodData } = data;

	const isWork = await workExists({ id });
	if (!isWork) throw Error('Work does not exist', { cause: 404 });

	const updatedWork = await db
		.update(work)
		.set({ ...goodData, updatedAt: new Date() })
		.where(
			and(
				eq(work.id, convertToUUID(id)),
				eq(work.userId, convertToUUID(userId))
			)
		)
		.returning({ id: work.id });

	const [updatedWorkWithSUUID] = updatedWork.map((work) => ({
		...work,
		id: convertToSUUID(work.id),
	}));
	return updatedWorkWithSUUID;
};

export const deleteWorkById = async (data: { id: SUUID; userId: SUUID }) => {
	const { id, userId } = data;

	const isWork = await workExists({ id });
	if (!isWork) throw Error('Work does not exist', { cause: 404 });

	const deletedWork = await db
		.delete(work)
		.where(
			and(
				eq(work.id, convertToUUID(id)),
				eq(work.userId, convertToUUID(userId))
			)
		)
		.returning({ id: work.id });

	const [deletedWorkWithSUUID] = deletedWork.map((work) => ({
		...work,
		id: convertToSUUID(work.id),
	}));

	return deletedWorkWithSUUID;
};
