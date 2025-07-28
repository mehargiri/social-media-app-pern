import { db } from '@/db/index.js';
import { comment } from '@/db/schema/comment.js';
import {
	convertToSUUID,
	convertToUUID,
	TransactionType,
} from '@/utils/general.utils.js';
import { eq, sql } from 'drizzle-orm';
import { SUUID } from 'short-uuid';

export const commentExists = async (data: { id: SUUID }) => {
	const isComment = await db
		.select({
			parentCommentId: comment.parentCommentId,
		})
		.from(comment)
		.where(eq(comment.id, convertToUUID(data.id)));

	const [isCommentWithSUUID] = isComment.map((comment) => ({
		...comment,
		parentCommentId: comment.parentCommentId
			? convertToSUUID(comment.parentCommentId)
			: null,
	}));
	return isCommentWithSUUID;
};

export const updateParentCommentReplyCount = async (
	data: {
		id: SUUID;
		type: 'increase' | 'decrease';
	},
	txDb?: TransactionType
) => {
	const { id, type } = data;

	await (txDb ?? db)
		.update(comment)
		.set({
			repliesCount:
				type === 'increase'
					? sql`${comment.repliesCount} + 1`
					: sql`${comment.repliesCount} - 1`,
		})
		.where(eq(comment.id, convertToUUID(id)));
};
