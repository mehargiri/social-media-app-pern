import { comment } from '@/db/schema/index.js';
import { createInsertSchema } from 'drizzle-zod';

export const createCommentSchema = createInsertSchema(comment, {
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
	postId: true,
	parentCommentId: true,
	commentLevel: true,
});

export type CommentType = typeof createCommentSchema._type;
