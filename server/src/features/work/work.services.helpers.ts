import { db } from '@/db/index.js';
import { work } from '@/db/schema/work.js';
import { convertToUUID } from '@/utils/general.utils.js';
import { eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';

export const workExists = async (data: { id: SUUID }) => {
	const workData = await db
		.select({ company: work.company })
		.from(work)
		.where(eq(work.id, convertToUUID(data.id)));

	return workData[0] ? true : false;
};
