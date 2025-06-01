import { post } from '@/db/schema/index.js';
import { createInsertSchema } from 'drizzle-zod';

export const createPostSchema = createInsertSchema(post, {
	content: (schema) =>
		schema
			.min(1, 'Content is required')
			.max(10000, 'Content cannot be more than 10,000 characters')
			.trim(),
}).omit({
	id: true,
	userId: true,
	createdAt: true,
	updatedAt: true,
	topLikeType1: true,
	topLikeType2: true,
	commentsCount: true,
	likesCount: true,
});

export type PostType = typeof createPostSchema._output;
