import { db } from '@/db/index.js';
import { college } from '@/db/schema/index.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { collegeExists } from './college.services.helpers.js';
import { CollegeType } from './college.zod.schemas.js';

export const makeCollege = async (data: CollegeType & { userId: SUUID }) => {
	const { userId, ...goodData } = data;
	const newCollege = await db
		.insert(college)
		.values({ ...goodData, userId: convertToUUID(userId) })
		.returning({ id: college.id });

	const [newCollegeWithSUUID] = newCollege.map((college) => ({
		...college,
		id: convertToSUUID(college.id),
	}));

	return newCollegeWithSUUID;
};

export const updateCollegeById = async (
	data: CollegeType & { id: SUUID; userId: SUUID }
) => {
	const { id, userId, ...goodData } = data;

	const isCollege = await collegeExists({ id });
	if (!isCollege) throw Error('College does not exist', { cause: 404 });

	const updatedCollege = await db
		.update(college)
		.set({ ...goodData, updatedAt: new Date() })
		.where(
			and(
				eq(college.id, convertToUUID(id)),
				eq(college.userId, convertToUUID(userId))
			)
		)
		.returning({ id: college.id });

	const [updatedCollegeWithSUUID] = updatedCollege.map((college) => ({
		...college,
		id: convertToSUUID(college.id),
	}));

	return updatedCollegeWithSUUID;
};

export const deleteCollegeById = async (data: { id: SUUID; userId: SUUID }) => {
	const { id, userId } = data;

	const isCollege = await collegeExists({ id });
	if (!isCollege) throw Error('College does not exist', { cause: 404 });

	const deletedCollege = await db
		.delete(college)
		.where(
			and(
				eq(college.id, convertToUUID(id)),
				eq(college.userId, convertToUUID(userId))
			)
		)
		.returning({ id: college.id });

	const [deletedCollegeWithSUUID] = deletedCollege.map((college) => ({
		...college,
		id: convertToSUUID(college.id),
	}));

	return deletedCollegeWithSUUID;
};
