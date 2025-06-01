import { work } from '@/db/schema/index.js';
import { createInsertSchema } from 'drizzle-zod';

export const createWorkSchema = createInsertSchema(work, {
	company: (schema) =>
		schema.max(260, 'Company cannot be more than 260 characters').trim(),
	position: (schema) =>
		schema.max(260, 'Position cannot be more than 260 characters').trim(),
	city: (schema) =>
		schema.max(260, 'City cannot be more than 260 characters').trim(),
	description: (schema) =>
		schema.max(500, 'Description cannot be more than 500 characters').trim(),
	startYear: (schema) =>
		schema
			.min(1900, 'Start Year cannot be less than 1900')
			.max(9998, 'Start Year cannot be more than 9998'),
	endYear: (schema) =>
		schema
			.min(1901, 'End Year cannot be less than 1901')
			.max(9999, 'End Year cannot be more than 9999'),
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export type WorkType = typeof createWorkSchema._output;
