import { db } from '@/db/index.js';
import { comment, post, user } from '@/db/schema/index.js';
import env from '@/env.js';
import {
	CommentType,
	UpdateCommentType,
} from '@/features/comment/comment.zod.schemas.js';
import {
	convertToSUUID,
	convertToUUID,
	TransactionType,
} from '@/utils/general.utils.js';
import { and, desc, eq, lt } from 'drizzle-orm';
import { SUUID } from 'short-uuid';

// Read Comments
export const findComments = async (data: {
	postId: SUUID;
	cursor?: string;
}) => {
	const { postId, cursor } = data;
	const isTest = env.NODE_ENV === 'test';

	const comments = await db
		.select({
			id: comment.id,
			...(isTest ? { commentLevel: comment.commentLevel } : {}),
			postId: comment.postId,
			content: comment.content,
			likesCount: comment.likesCount,
			topLikeType1: comment.topLikeType1,
			topLikeType2: comment.topLikeType2,
			repliesCount: comment.repliesCount,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			fullName: user.fullName,
			profilePic: user.profilePic,
			userId: user.id,
		})
		.from(comment)
		.leftJoin(user, eq(comment.userId, user.id))
		.where(
			and(
				eq(comment.postId, convertToUUID(postId)),
				eq(comment.commentLevel, 0),
				cursor ? lt(comment.createdAt, new Date(cursor)) : undefined
			)
		)
		.orderBy(desc(comment.createdAt))
		.limit(5);

	const commentsWithSUUID = comments.map((comment) => ({
		...comment,
		id: convertToSUUID(comment.id),
		postId: convertToSUUID(comment.postId),
		...(comment.userId && { userId: convertToSUUID(comment.userId) }),
		...(comment.userId && { fullName: comment.fullName }),
		...(comment.userId && { profilePic: comment.profilePic }),
	}));

	return commentsWithSUUID;
};

export const findReplies = async (data: {
	parentCommentId: SUUID;
	cursor?: string;
}) => {
	const { parentCommentId, cursor } = data;

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
			repliesCount: comment.repliesCount,
			commentLevel: comment.commentLevel,
			fullName: user.fullName,
			profilePic: user.profilePic,
			userId: user.id,
		})
		.from(comment)
		.leftJoin(user, eq(comment.userId, user.id))
		.where(
			and(
				eq(comment.parentCommentId, convertToUUID(parentCommentId)),
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
		...(reply.userId && { userId: convertToSUUID(reply.userId) }),
		...(reply.userId && { fullName: reply.fullName }),
		...(reply.userId && { profilePic: reply.profilePic }),
		...(reply.parentCommentId && {
			parentCommentId: convertToSUUID(reply.parentCommentId),
		}),
	}));

	return repliesWithSUUID;
};

// Create Comment
export const makeComment = async (
	data: CommentType & { userId: SUUID; forceError?: boolean }
) => {
	const { userId, postId, parentCommentId, forceError, ...goodData } = data;

	const newComment = await db.transaction(async (tx) => {
		const newComment = await tx
			.insert(comment)
			.values({
				...goodData,
				userId: convertToUUID(userId),
				postId: convertToUUID(postId),
				parentCommentId: parentCommentId
					? convertToUUID(parentCommentId)
					: null,
			})
			.returning({ id: comment.id });

		if (forceError)
			throw Error('Forced transaction error for comment creation', {
				cause: 500,
			});

		await updatePostCommentCount({ id: postId, type: 'increase' }, tx);

		// Reply is created if parentCommentId is present
		// Otherwise top level comment is created
		if (parentCommentId) {
			await updateParentCommentReplyCount(
				{
					id: parentCommentId,
					type: 'increase',
				},
				tx
			);
		}

		return newComment;
	});

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
export const deleteCommentById = async (data: {
	id: SUUID;
	userId: SUUID;
	postId: SUUID;
	parentCommentId?: SUUID;
	forceError?: boolean;
}) => {
	const { id, userId, postId, parentCommentId, forceError } = data;

	const deletedComment = await db.transaction(async (tx) => {
		const deletedComment = await tx
			.delete(comment)
			.where(
				and(
					eq(comment.id, convertToUUID(id)),
					eq(comment.userId, convertToUUID(userId))
				)
			)
			.returning({ id: comment.id });

		if (forceError)
			throw Error('Forced transaction error for comment deletion', {
				cause: 500,
			});

		await updatePostCommentCount({ id: postId, type: 'decrease' }, tx);

		if (parentCommentId)
			await updateParentCommentReplyCount(
				{ id: parentCommentId, type: 'decrease' },
				tx
			);

		return deletedComment;
	});

	const deletedCommentWithSUUID = deletedComment.map((comment) => ({
		...comment,
		id: convertToSUUID(comment.id),
	}));

	return deletedCommentWithSUUID[0];
};

export const commentExists = async (data: { id: SUUID }) => {
	const isComment = await db
		.select({
			postId: comment.postId,
			parentCommentId: comment.parentCommentId,
		})
		.from(comment)
		.where(eq(comment.id, convertToUUID(data.id)));

	const [isCommentWithSUUID] = isComment.map((comment) => ({
		...comment,
		postId: convertToSUUID(comment.postId),
		parentCommentId: comment.parentCommentId
			? convertToSUUID(comment.parentCommentId)
			: undefined,
	}));
	return isCommentWithSUUID;
};

export const updateParentCommentReplyCount = async (
	data: {
		id: SUUID;
		type: 'increase' | 'decrease';
	},
	txDb: TransactionType
) => {
	const { id, type } = data;
	const currentParentCommentReplyCount = await getParentCommentReplyCount(
		{
			id,
		},
		txDb
	);

	if (currentParentCommentReplyCount) {
		await txDb
			.update(comment)
			.set({
				repliesCount:
					type === 'increase'
						? currentParentCommentReplyCount.repliesCount + 1
						: currentParentCommentReplyCount.repliesCount - 1,
			})
			.where(eq(comment.id, convertToUUID(id)));
	}
};

export const getParentCommentReplyCount = async (
	data: { id: SUUID },
	txDb?: TransactionType
) => {
	const { id } = data;
	const [selectedComment] = await (txDb ?? db)
		.select({ repliesCount: comment.repliesCount })
		.from(comment)
		.where(eq(comment.id, convertToUUID(id)));

	return selectedComment;
};

export const updatePostCommentCount = async (
	data: {
		id: SUUID;
		type: 'increase' | 'decrease';
	},
	txDb: TransactionType
) => {
	const { id, type } = data;
	const currentPostCommentCount = await getPostCommentsCount({ id }, txDb);

	if (currentPostCommentCount) {
		await txDb
			.update(post)
			.set({
				commentsCount:
					type === 'increase'
						? currentPostCommentCount.commentsCount + 1
						: currentPostCommentCount.commentsCount - 1,
			})
			.where(eq(post.id, convertToUUID(id)));
	}
};

export const getPostCommentsCount = async (
	data: { id: SUUID },
	txDb?: TransactionType
) => {
	const { id } = data;
	const idWithUUID = convertToUUID(id);

	const [selectedPost] = await (txDb ?? db)
		.select({
			commentsCount: post.commentsCount,
		})
		.from(post)
		.where(eq(post.id, idWithUUID));

	return selectedPost;
};
