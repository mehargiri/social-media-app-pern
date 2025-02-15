import { db } from '@/db/index.js';
import { comment, user } from '@/db/schema/index.js';
import {
	CommentType,
	UpdateCommentType,
} from '@/features/comment/comment.zod.schemas.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, desc, eq, lt } from 'drizzle-orm';
import { SUUID } from 'short-uuid';

// Read Comments
export const findComments = async (data: {
	postId: SUUID;
	cursor?: string;
}) => {
	const { cursor } = data;
	const comments = await db
		.select({
			id: comment.id,
			postId: comment.postId,
			content: comment.content,
			likesCount: comment.likesCount,
			topLikeType1: comment.topLikeType1,
			topLikeType2: comment.topLikeType2,
			repliesCount: comment.repliesCount,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			author: {
				fullName: user.fullName,
				profilePic: user.profilePic,
			},
		})
		.from(comment)
		.leftJoin(user, eq(comment.userId, user.id))
		.where(cursor ? lt(comment.createdAt, new Date(cursor)) : undefined)
		.orderBy(desc(comment.createdAt))
		.limit(5);

	const commentsWithSUUID = comments.map((comment) => ({
		...comment,
		id: convertToSUUID(comment.id),
		postId: convertToSUUID(comment.postId),
	}));

	return commentsWithSUUID;
};

export const findReplies = async (data: {
	parentCommentId: SUUID;
	commentLevel?: number;
	cursor?: string;
}) => {
	const { parentCommentId, commentLevel = 0, cursor } = data;

	const replies = await db
		.select({
			id: comment.id,
			postId: comment.postId,
			parentCommentId: comment.parentCommentId,
			content: comment.content,
			likesCount: comment.likesCount,
			topLikeType1: comment.topLikeType1,
			topLikeType2: comment.topLikeType2,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			...(commentLevel < 2 ? { repliesCount: comment.repliesCount } : {}),
			...(commentLevel < 2 ? { commentLevel: comment.commentLevel } : {}),
			author: {
				fullName: user.fullName,
				profilePic: user.profilePic,
			},
		})
		.from(comment)
		.leftJoin(user, eq(comment.userId, user.id))
		.where(
			and(
				eq(comment.parentCommentId, convertToUUID(parentCommentId)),
				eq(comment.commentLevel, commentLevel + 1),
				cursor ? lt(comment.createdAt, new Date(cursor)) : undefined
			)
		)
		.orderBy(desc(comment.createdAt))
		.limit(5);

	// Even though typescript intellisense show that parentCommentId inside repliesWithSUUID is "string", it is actually SUUID
	const repliesWithSUUID = replies.map((reply) => ({
		...reply,
		id: convertToSUUID(reply.id),
		postId: convertToSUUID(reply.postId),
		...(reply.parentCommentId
			? { parentCommentId: convertToSUUID(reply.parentCommentId) }
			: {}),
	}));

	return repliesWithSUUID;
};

// Create Comment
export const makeComment = async (data: CommentType & { userId: SUUID }) => {
	const { userId, postId, parentCommentId, ...goodData } = data;

	const newComment = await db
		.insert(comment)
		.values({
			...goodData,
			userId: convertToUUID(userId),
			postId: convertToUUID(postId),
			parentCommentId: parentCommentId ? convertToUUID(parentCommentId) : null,
		})
		.returning({ id: comment.id });

	const newCommentWithSUUID = newComment.map((comment) => ({
		...comment,
		id: convertToSUUID(comment.id),
	}));

	return newCommentWithSUUID[0];
};

// Update Comment
export const updateCommentById = async (
	data: UpdateCommentType & { id: SUUID; userId: SUUID; updatedAt: Date }
) => {
	const { id, userId, ...goodData } = data;
	const updatedComment = await db
		.update(comment)
		.set(goodData)
		.where(
			and(
				eq(comment.id, convertToUUID(id)),
				eq(comment.userId, convertToUUID(userId))
			)
		)
		.returning({ id: comment.id });

	const updatedCommentWithSUUID = updatedComment.map((comment) => ({
		...comment,
		id: convertToSUUID(comment.id),
	}));

	return updatedCommentWithSUUID[0];
};

// Delete Comment
export const deleteCommentById = async (data: { id: SUUID; userId: SUUID }) => {
	const { id, userId } = data;
	const deletedComment = await db
		.delete(comment)
		.where(
			and(
				eq(comment.id, convertToUUID(id)),
				eq(comment.userId, convertToUUID(userId))
			)
		)
		.returning({ id: comment.id });

	const deletedCommentWithSUUID = deletedComment.map((comment) => ({
		...comment,
		id: convertToSUUID(comment.id),
	}));

	return deletedCommentWithSUUID[0];
};

export const commentExists = async (data: { id: SUUID }) => {
	const isComment = await db
		.select({ content: comment.content })
		.from(comment)
		.where(eq(comment.id, convertToUUID(data.id)));

	return isComment[0] ? true : false;
};
