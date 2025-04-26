import { db } from '@/db/index.js';
import { comment, like, post, user } from '@/db/schema/index.js';
import {
	convertToSUUID,
	convertToUUID,
	TransactionType,
} from '@/utils/general.utils.js';
import { and, count, desc, eq, lt } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { LikeType } from './like.zod.schemas.js';

// Get likes
export const getDetailedLikes = async (data: {
	id: SUUID;
	entity: 'post' | 'comment';
	cursor?: string;
}) => {
	const { id, entity, cursor } = data;
	const entityCondition =
		entity === 'post'
			? eq(like.postId, convertToUUID(id))
			: eq(like.commentId, convertToUUID(id));

	const detailedLikes = await db
		.select({
			...(entity === 'post' && { postId: like.postId }),
			...(entity === 'comment' && { commentId: like.commentId }),
			type: like.type,
			fullName: user.fullName,
			profilePic: user.profilePic,
			userId: like.userId,
		})
		.from(like)
		.leftJoin(user, eq(like.userId, user.id))
		.where(
			and(
				entityCondition,
				cursor ? lt(like.createdAt, new Date(cursor)) : undefined
			)
		)
		.orderBy(desc(like.createdAt))
		.limit(5);

	const detailedLikesWithSUUID = detailedLikes.map((like) => ({
		...like,
		userId: convertToSUUID(like.userId),
		...(like.postId && { postId: convertToSUUID(like.postId) }),
		...(like.commentId && { commentId: convertToSUUID(like.commentId) }),
	}));

	return detailedLikesWithSUUID;
};

// Create likes
export const makeLike = async (
	data: Omit<LikeType, 'postId' | 'commentId'> & {
		id: SUUID;
		entity: 'post' | 'comment';
		forceError?: boolean;
	}
) => {
	const { id, userId, entity, forceError, ...goodData } = data;

	const newLike = await db.transaction(async (tx) => {
		const newLike = await tx
			.insert(like)
			.values({
				...goodData,
				userId: convertToUUID(userId),
				postId: entity === 'post' ? convertToUUID(id) : null,
				commentId: entity === 'comment' ? convertToUUID(id) : null,
			})
			.returning({ id: like.id });

		if (forceError)
			throw Error('Forced transaction error for like creation', { cause: 500 });

		// Update total likes count of entity
		await updateEntityLikeCount({ id, entity, type: 'increase' }, tx);

		// Update top likes type of entity
		await updateEntityTopLikes({ id, entity }, tx);

		return newLike;
	});

	const newLikeWithSUUID = newLike.map((like) => ({
		...like,
		id: convertToSUUID(like.id),
	}));

	return newLikeWithSUUID[0];
};

// Update Likes
export const updateLikeById = async (
	data: Omit<LikeType, 'postId' | 'commentId'> & {
		id: SUUID;
		entity: 'post' | 'comment';
	}
) => {
	const { id, entity, userId, ...goodData } = data;
	const entityCondition =
		entity === 'post'
			? eq(like.postId, convertToUUID(id))
			: eq(like.commentId, convertToUUID(id));

	const updatedLike = await db.transaction(async (tx) => {
		const updatedLike = await tx
			.update(like)
			.set(goodData)
			.where(and(eq(like.userId, convertToUUID(userId)), entityCondition))
			.returning({ id: like.id });

		// Update top likes type of entity
		await updateEntityTopLikes({ id, entity }, tx);

		return updatedLike;
	});

	const updatedLikeWithSUUID = updatedLike.map((like) => ({
		...like,
		id: convertToSUUID(like.id),
	}));
	return updatedLikeWithSUUID[0];
};

// Delete likes
export const deleteLikeById = async (data: {
	id: SUUID;
	userId: SUUID;
	entity: 'post' | 'comment';
	forceError?: boolean;
}) => {
	const { id, userId, entity, forceError } = data;
	const entityCondition =
		entity === 'post'
			? eq(like.postId, convertToUUID(id))
			: eq(like.commentId, convertToUUID(id));

	const deletedLike = await db.transaction(async (tx) => {
		const deletedLike = await tx
			.delete(like)
			.where(and(eq(like.userId, convertToUUID(userId)), entityCondition))
			.returning({ id: like.id });

		if (forceError)
			throw Error('Forced transaction error for like deletion', { cause: 500 });

		// Update total likes count of entity
		await updateEntityLikeCount({ id, entity, type: 'decrease' }, tx);

		// Update top likes type of entity
		await updateEntityTopLikes({ id, entity }, tx);
		return deletedLike;
	});

	const deletedLikeWithSUUID = deletedLike.map((like) => ({
		...like,
		id: convertToSUUID(like.id),
	}));
	return deletedLikeWithSUUID[0];
};

export const likeExists = async (data: {
	id: SUUID;
	entity: 'post' | 'comment';
}) => {
	const { id, entity } = data;
	const entityCondition =
		entity === 'post'
			? eq(like.postId, convertToUUID(id))
			: eq(like.commentId, convertToUUID(id));

	const isLike = await db
		.select({ type: like.type })
		.from(like)
		.where(entityCondition);

	return isLike;
};

export const updateEntityLikeCount = async (
	data: {
		id: SUUID;
		entity: 'post' | 'comment';
		type: 'increase' | 'decrease';
	},
	txDb: TransactionType
) => {
	const { id, entity, type } = data;
	const currentEntityLikeCount = await getCurrentEntityLikeCount(
		{ id, entity },
		txDb
	);
	const table = entity === 'post' ? post : comment;

	if (currentEntityLikeCount) {
		await txDb
			.update(table)
			.set({
				likesCount:
					type === 'increase'
						? currentEntityLikeCount.likesCount + 1
						: currentEntityLikeCount.likesCount - 1,
			})
			.where(eq(table.id, convertToUUID(id)));
	}
};

export const updateEntityTopLikes = async (
	data: { id: SUUID; entity: 'post' | 'comment' },
	txDb: TransactionType
) => {
	const { id, entity } = data;
	const table = entity === 'post' ? post : comment;
	const currentTopLikes = await getCurrentEntityTop2Likes({ id, entity }, txDb);

	if (currentTopLikes.length > 0) {
		await txDb
			.update(table)
			.set({
				topLikeType1: currentTopLikes[0] ? currentTopLikes[0].type : null,
				topLikeType2: currentTopLikes[1] ? currentTopLikes[1]?.type : null,
			})
			.where(eq(table.id, convertToUUID(id)));
	}
};

export const getCurrentEntityLikeCount = async (
	data: {
		id: SUUID;
		entity: 'post' | 'comment';
	},
	txDb?: TransactionType
) => {
	const { id, entity } = data;
	const idWithUUID = convertToUUID(id);
	const table = entity === 'post' ? post : comment;

	const [selectedEntity] = await (txDb ?? db)
		.select({
			likesCount: table.likesCount,
		})
		.from(table)
		.where(eq(table.id, idWithUUID));

	return selectedEntity;
};

export const getCurrentEntityTop2Likes = async (
	data: { id: SUUID; entity: 'post' | 'comment' },
	txDb?: TransactionType
) => {
	const { id, entity } = data;
	const entityId = entity === 'post' ? like.postId : like.commentId;

	const topLikes = await (txDb ?? db)
		.select({ type: like.type, count: count() })
		.from(like)
		.where(eq(entityId, convertToUUID(id)))
		.groupBy(like.type)
		.orderBy(desc(count()))
		.limit(2);

	return topLikes;
};
