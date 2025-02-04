import { db } from '@/db/index.js';
import { college } from '@/db/schema/index.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { CollegeType } from './college.zod.schemas.js';

export const makeCollege = async (data: CollegeType & { userId: SUUID }) => {
	const { userId, ...goodData } = data;
	const newCollege = await db
		.insert(college)
		.values({ ...goodData, userId: convertToUUID(userId) })
		.returning({ id: college.id });

	const newCollegeWithSUUID = newCollege.map((college) => ({
		...college,
		id: convertToSUUID(college.id),
	}));

	return newCollegeWithSUUID[0];
};

export const updateCollegeById = async (
	data: CollegeType & { id: SUUID; userId: SUUID; updatedAt: Date }
) => {
	const { id, userId, ...goodData } = data;
	const updatedCollege = await db
		.update(college)
		.set(goodData)
		.where(
			and(
				eq(college.id, convertToUUID(id)),
				eq(college.userId, convertToUUID(userId))
			)
		)
		.returning({ id: college.id });

	const updatedCollegeWithSUUID = updatedCollege.map((college) => ({
		...college,
		id: convertToSUUID(college.id),
	}));

	return updatedCollegeWithSUUID[0];
};

export const deleteCollegeById = async (data: { id: SUUID; userId: SUUID }) => {
	const { id, userId } = data;
	const deletedCollege = await db
		.delete(college)
		.where(
			and(
				eq(college.id, convertToUUID(id)),
				eq(college.userId, convertToUUID(userId))
			)
		)
		.returning({ id: college.id });

	const deletedCollegeWithSUUID = deletedCollege.map((college) => ({
		...college,
		id: convertToSUUID(college.id),
	}));

	return deletedCollegeWithSUUID[0];
};

export const collegeExists = async (data: { id: SUUID }) => {
	const collegeData = await db
		.select({ name: college.name })
		.from(college)
		.where(eq(college.id, convertToUUID(data.id)));

	return collegeData[0] ? true : false;
};
