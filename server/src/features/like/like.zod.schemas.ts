import { like } from '@/db/schema/like.js';
import { createInsertSchema } from 'drizzle-zod';
import short, { SUUID } from 'short-uuid';
import { string } from 'zod';

const translator = short();

export const createLikeSchema = createInsertSchema(like, {
	userId: () =>
		string()
			.min(1, 'User id is required')
			.refine(
				(value) => translator.validate(value),
				'Valid user id is required'
			),
}).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const updateLikeSchema = createLikeSchema.pick({
	type: true,
});

export type LikeType = Omit<
	typeof createLikeSchema._type,
	'userId' | 'postId' | 'commentId'
> & {
	userId: SUUID;
	postId: SUUID | null;
	commentId: SUUID | null;
};
