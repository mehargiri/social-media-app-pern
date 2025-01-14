import { db } from '@/db/index.js';
import { highschool } from '@/db/schema/index.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import {
	CreateHighschoolType,
	UpdateHighschoolType,
} from './highschool.zod.schemas.js';

export const makeHighschool = async (data: CreateHighschoolType) => {
	const newHighschool = await db
		.insert(highschool)
		.values({ ...data, userId: convertToUUID(data.userId) })
		.returning({ id: highschool.id });

	const newHighschoolWithSUUID = newHighschool.map((school) => ({
		...school,
		id: convertToSUUID(school.id),
	}));

	return newHighschoolWithSUUID[0];
};

export const updateHighschoolById = async (data: UpdateHighschoolType) => {
	const { id, userId, ...goodData } = data;
	const updatedHighschool = await db
		.update(highschool)
		.set(goodData)
		.where(
			and(
				eq(highschool.id, convertToUUID(id)),
				eq(highschool.userId, convertToUUID(userId))
			)
		)
		.returning({ id: highschool.id });

	const updatedHighschoolWithSUUID = updatedHighschool.map((school) => ({
		...school,
		id: convertToSUUID(school.id),
	}));

	return updatedHighschoolWithSUUID[0];
};

export const deleteHighschoolById = async (data: {
	id: SUUID;
	userId: SUUID;
}) => {
	const { id, userId } = data;

	const deletedHighschool = await db
		.delete(highschool)
		.where(
			and(
				eq(highschool.id, convertToUUID(id)),
				eq(highschool.userId, convertToUUID(userId))
			)
		)
		.returning({ id: highschool.id });

	const deletedHighschoolWithSUUID = deletedHighschool.map((school) => ({
		...school,
		id: convertToSUUID(school.id),
	}));

	return deletedHighschoolWithSUUID[0];
};
