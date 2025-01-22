import { college, collegeTypeEnum } from '@/db/schema/index.js';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const createCollegeSchema = createInsertSchema(college, {
	name: (schema) =>
		schema.max(260, 'Name cannot be more than 260 characters').trim(),
	description: (schema) =>
		schema.max(500, 'Description cannot be more than 500 characters').trim(),
	major1: (schema) =>
		schema.max(260, 'Major1 cannot be more than 260 characters').trim(),
	major2: (schema) =>
		schema.max(260, 'Major2 cannot be more than 260 characters').trim(),
	major3: (schema) =>
		schema.max(260, 'Major3 cannot be more than 260 characters').trim(),
	degree: (schema) =>
		schema.max(260, 'Degree cannot be more than 260 characters').trim(),
	startYear: (schema) =>
		schema
			.min(1900, 'Start Year cannot be less than 1900')
			.max(9998, 'Start Year cannot be more than 9998'),
	endYear: (schema) =>
		schema
			.min(1901, 'End Year cannot be less than 1901')
			.max(9999, 'End Year cannot be more than 9999'),
	type: () =>
		z.enum(collegeTypeEnum.enumValues, {
			errorMap: () => ({
				message:
					'Invalid type provided. Accepted values are: college, graduate_school, university.',
			}),
		}),
}).omit({
	id: true,
	userId: true,
	createdAt: true,
	updatedAt: true,
});

export type CollegeType = typeof createCollegeSchema._type;
