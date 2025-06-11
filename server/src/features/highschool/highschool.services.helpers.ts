import { db } from '@/db/index.js';
import { highschool } from '@/db/schema/highschool.js';
import { convertToUUID } from '@/utils/general.utils.js';
import { eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';

export const highschoolExists = async (data: { id: SUUID }) => {
	const school = await db
		.select({ name: highschool.name })
		.from(highschool)
		.where(eq(highschool.id, convertToUUID(data.id)));

	return school[0] ? true : false;
};
