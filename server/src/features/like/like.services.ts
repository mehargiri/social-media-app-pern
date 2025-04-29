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

export type EntityType = 'post' | 'comment';

const getEntityCondition = (entity: EntityType, id: SUUID) => {
	return eq(
		entity === 'post' ? like.postId : like.commentId,
		convertToUUID(id)
	);
};

// Get likes
export const findDetailedLikes = async (data: {
	id?: SUUID;
	entity?: EntityType;
	cursor?: string;
}) => {
	const { id, entity, cursor } = data;
	if (!entity || !id) return;

	const detailedLikes = await db
		.select({
			...(entity === 'post' && { postId: like.postId }),
			...(entity === 'comment' && { commentId: like.commentId }),
			type: like.type,
			fullName: user.fullName,
			profilePic: user.profilePic,
			userId: like.userId,
			createdAt: like.createdAt,
		})
		.from(like)
		.leftJoin(user, eq(like.userId, user.id))
		.where(
			and(
				getEntityCondition(entity, id),
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

export const upsertLike = async (
	data: Omit<LikeType, 'postId' | 'commentId'> & {
		userId: SUUID;
		id?: SUUID;
		entity?: EntityType;
		forceError?: boolean;
	}
) => {
	const { id, userId, entity, forceError, ...goodData } = data;
	if (!id || !entity) return;

	const likeData = await db.transaction(async (tx) => {
		const likeData = await tx
			.insert(like)
			.values({
				...goodData,
				userId: convertToUUID(userId),
				postId: entity === 'post' ? convertToUUID(id) : null,
				commentId: entity === 'comment' ? convertToUUID(id) : null,
			})
			.onConflictDoUpdate({
				target: [like.userId, entity === 'post' ? like.postId : like.commentId],
				set: {
					...goodData,
					updatedAt: new Date(),
				},
			})
			.returning({
				id: like.id,
				createdAt: like.createdAt,
				updatedAt: like.updatedAt,
			});

		if (forceError) {
			throw Error('Forced transaction error for like upsert', { cause: 500 });
		}

		const isNewInsert =
			likeData[0]?.createdAt.getTime() === likeData[0]?.updatedAt.getTime();

		await Promise.all([
			// Update total likes count of entity
			isNewInsert
				? updateEntityLikeCount({ type: 'increase', id, entity }, tx)
				: Promise.resolve(),
			// Update top likes type of entity
			updateEntityTopLikes({ id, entity }, tx),
		]);

		return likeData;
	});

	const likeDataWithSUUID = likeData.map(({ id }) => ({
		id: convertToSUUID(id),
	}));

	return likeDataWithSUUID;
};

// Delete likes
export const deleteLike = async (data: {
	userId: SUUID;
	id?: SUUID;
	entity?: EntityType;
	forceError?: boolean;
}) => {
	const { id, userId, entity, forceError } = data;
	if (!entity || !id) return;

	const deletedLike = await db.transaction(async (tx) => {
		const deletedLike = await tx
			.delete(like)
			.where(
				and(
					eq(like.userId, convertToUUID(userId)),
					getEntityCondition(entity, id)
				)
			)
			.returning({ id: like.id });

		if (forceError)
			throw Error('Forced transaction error for like deletion', { cause: 500 });

		await Promise.all([
			// Update total likes count of entity
			updateEntityLikeCount({ id, entity, type: 'decrease' }, tx),

			// Update top likes type of entity
			updateEntityTopLikes({ id, entity }, tx),
		]);

		return deletedLike;
	});

	const deletedLikeWithSUUID = deletedLike.map(({ id }) => ({
		id: convertToSUUID(id),
	}));

	return deletedLikeWithSUUID[0];
};

export const likeExists = async (data: { id?: SUUID; entity?: EntityType }) => {
	const { id, entity } = data;
	if (!entity || !id) return;

	const isLike = await db
		.select({ type: like.type })
		.from(like)
		.where(getEntityCondition(entity, id));

	return isLike[0];
};

export const updateEntityLikeCount = async (
	data: {
		type: 'increase' | 'decrease';
		id: SUUID;
		entity: EntityType;
	},
	txDb: TransactionType
) => {
	const { id, entity, type } = data;
	const currentEntityLikeCount = await getCurrentEntityLikeCount(
		{ id, entity },
		txDb
	);
	const table = entity === 'post' ? post : comment;

	if (!currentEntityLikeCount) return;

	await txDb
		.update(table)
		.set({
			likesCount:
				type === 'increase'
					? currentEntityLikeCount.likesCount + 1
					: currentEntityLikeCount.likesCount - 1,
		})
		.where(eq(table.id, convertToUUID(id)));
};

export const updateEntityTopLikes = async (
	data: { id: SUUID; entity: EntityType },
	txDb: TransactionType
) => {
	const { id, entity } = data;

	const table = entity === 'post' ? post : comment;
	const currentTopLikes = await getCurrentEntityTop2Likes({ id, entity }, txDb);

	if (currentTopLikes.length <= 0) return;

	await txDb
		.update(table)
		.set({
			topLikeType1: currentTopLikes[0] ? currentTopLikes[0].type : null,
			topLikeType2: currentTopLikes[1] ? currentTopLikes[1]?.type : null,
		})
		.where(eq(table.id, convertToUUID(id)));
};

export const getCurrentEntityLikeCount = async (
	data: {
		id: SUUID;
		entity: EntityType;
	},
	txDb?: TransactionType
) => {
	const { id, entity } = data;

	const table = entity === 'post' ? post : comment;
	const selectedEntity = await (txDb ?? db)
		.select({ likesCount: table.likesCount })
		.from(table)
		.where(eq(table.id, convertToUUID(id)));

	return selectedEntity.at(0);
};

export const getCurrentEntityTop2Likes = async (
	data: { id: SUUID; entity: EntityType },
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
