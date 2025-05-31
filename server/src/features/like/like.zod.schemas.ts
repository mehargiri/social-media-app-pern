import { like } from '@/db/schema/like.js';
import { createInsertSchema } from 'drizzle-zod';
import short, { SUUID } from 'short-uuid';
import { string } from 'zod';

const translator = short();

export const createLikeSchema = createInsertSchema(like, {
	postId: () =>
		string()
			.refine(
				(value) => translator.validate(value),
				'Valid id is required for post'
			)
			.optional(),
	commentId: () =>
		string()
			.refine(
				(value) => translator.validate(value),
				'Valid id is required for comment'
			)
			.optional(),
})
	.omit({
		id: true,
		userId: true,
		createdAt: true,
		updatedAt: true,
	})
	.refine((data) => (data.postId ? 1 : 0) + (data.commentId ? 1 : 0) === 1, {
		message: 'Exactly one of postId or commentId must be provided',
		path: ['postId', 'commentId'],
	});

export type LikeType = Omit<
	typeof createLikeSchema._type,
	'postId' | 'commentId'
> & {
	postId: SUUID | null;
	commentId: SUUID | null;
};
