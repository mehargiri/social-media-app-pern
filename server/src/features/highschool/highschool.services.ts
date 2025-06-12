import { db } from '@/db/index.js';
import { highschool } from '@/db/schema/index.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { highschoolExists } from './highschool.services.helpers.js';
import { HighschoolType } from './highschool.zod.schemas.js';

export const makeHighschool = async (
	data: HighschoolType & { userId: SUUID }
) => {
	const { userId, ...goodData } = data;
	const newHighschool = await db
		.insert(highschool)
		.values({ ...goodData, userId: convertToUUID(userId) })
		.returning({ id: highschool.id });

	const [newHighschoolWithSUUID] = newHighschool.map((school) => ({
		...school,
		id: convertToSUUID(school.id),
	}));

	return newHighschoolWithSUUID;
};

export const updateHighschoolById = async (
	data: HighschoolType & { id: SUUID; userId: SUUID }
) => {
	const { id, userId, ...goodData } = data;

	const isHighschool = await highschoolExists({ id });
	if (!isHighschool) throw Error('Highschool does not exist', { cause: 404 });

	const updatedHighschool = await db
		.update(highschool)
		.set({ ...goodData, updatedAt: new Date() })
		.where(
			and(
				eq(highschool.id, convertToUUID(id)),
				eq(highschool.userId, convertToUUID(userId))
			)
		)
		.returning({ id: highschool.id });

	const [updatedHighschoolWithSUUID] = updatedHighschool.map((school) => ({
		...school,
		id: convertToSUUID(school.id),
	}));

	return updatedHighschoolWithSUUID;
};

export const deleteHighschoolById = async (data: {
	id: SUUID;
	userId: SUUID;
}) => {
	const { id, userId } = data;

	const isHighschool = await highschoolExists({ id });
	if (!isHighschool) throw Error('Highschool does not exist', { cause: 404 });

	const deletedHighschool = await db
		.delete(highschool)
		.where(
			and(
				eq(highschool.id, convertToUUID(id)),
				eq(highschool.userId, convertToUUID(userId))
			)
		)
		.returning({ id: highschool.id });

	const [deletedHighschoolWithSUUID] = deletedHighschool.map((school) => ({
		...school,
		id: convertToSUUID(school.id),
	}));

	return deletedHighschoolWithSUUID;
};
