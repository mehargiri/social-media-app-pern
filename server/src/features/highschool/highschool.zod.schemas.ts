import { highschool } from '@/db/schema/index.js';
import { createInsertSchema } from 'drizzle-zod';
import { SUUID } from 'short-uuid';

export const createHighschoolSchema = createInsertSchema(highschool, {
	name: (schema) =>
		schema.max(260, 'Name cannot be more than 260 characters').trim(),
	description: (schema) =>
		schema.max(1000, 'Description cannot be more than 1000 characters'),
	startYear: (schema) =>
		schema
			.min(1900, 'Start Year cannot be less than 1900')
			.max(9998, 'Start Year cannot be more than 9998'),
	endYear: (schema) =>
		schema
			.min(1901, 'End Year cannot be less than 1901')
			.max(9999, 'End Year cannot be more than 9999'),
}).omit({
	id: true,
	userId: true,
	createdAt: true,
	updatedAt: true,
});

export type CreateHighschoolType = typeof createHighschoolSchema._type & {
	userId: SUUID;
};

export type UpdateHighschoolType = typeof createHighschoolSchema._type & {
	updatedAt: Date;
	userId: SUUID;
	id: SUUID;
};
