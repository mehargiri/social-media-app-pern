import { comment } from '@/db/schema/index.js';
import { createInsertSchema } from 'drizzle-zod';
import short, { SUUID } from 'short-uuid';

const translator = short();

export const createCommentSchema = createInsertSchema(comment, {
	content: (schema) =>
		schema
			.min(1, 'Content is required')
			.max(10000, 'Content cannot be more than 10,000 characters')
			.trim(),
	postId: (schema) =>
		schema
			.min(1, 'Post id is required')
			.refine(
				(value) => translator.validate(value),
				'Valid post id is required'
			),
	commentLevel: (schema) =>
		schema
			.min(0, 'Comment level cannot be less than 0')
			.max(2, 'Comment level cannot be more than 2'),
	parentCommentId: (schema) =>
		schema.refine(
			(value) => translator.validate(value),
			'Valid parent comment id is required'
		),
}).omit({
	id: true,
	userId: true,
	createdAt: true,
	updatedAt: true,
});

export type CommentType = Omit<
	typeof createCommentSchema._type,
	'postId' | 'parentCommentId'
> & {
	postId: SUUID;
	parentCommentId: SUUID | null;
};
