import { db } from '@/db/index.js';
import { college } from '@/db/schema/college.js';
import { convertToUUID } from '@/utils/general.utils.js';
import { eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';

export const collegeExists = async (data: { id: SUUID }) => {
	const collegeData = await db
		.select({ name: college.name })
		.from(college)
		.where(eq(college.id, convertToUUID(data.id)));

	return collegeData[0] ? true : false;
};
