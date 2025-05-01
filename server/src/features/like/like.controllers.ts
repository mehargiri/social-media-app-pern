import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	deleteLike,
	EntityType,
	findDetailedLikes,
	likeExists,
	upsertLike,
} from './like.services.js';
import { LikeType } from './like.zod.schemas.js';

const resolveEntity = (postId?: SUUID | null, commentId?: SUUID | null) => {
	if ((postId && commentId) || (!postId && !commentId)) {
		throw Error('Exactly one of postId or commentId must be provided', {
			cause: 400,
		});
	}

	let entity: EntityType | undefined;
	let id: SUUID | undefined;

	if (postId) {
		validateSUUID(postId, 'post');
		entity = 'post';
		id = postId;
	}

	if (commentId) {
		validateSUUID(commentId, 'comment');
		entity = 'comment';
		id = commentId;
	}
	return { entity, id };
};

// Read Likes
export const getDetailedLikes = async (
	req: Request<
		never,
		never,
		never,
		{ commentId?: SUUID; postId?: SUUID; cursor?: string }
	>,
	res: Response<{
		likes: Awaited<ReturnType<typeof findDetailedLikes>>;
		nextCursor: string | null;
	}>
) => {
	const { commentId, postId, cursor } = req.query;

	const { entity, id } = resolveEntity(postId, commentId);

	const decodedCursor = cursor
		? Buffer.from(cursor, 'base64url').toString()
		: undefined;

	const detailedLikes = await findDetailedLikes({
		id,
		entity,
		cursor: decodedCursor,
	});

	const lastLikeDate = detailedLikes
		?.at(detailedLikes.length - 1)
		?.createdAt.toISOString();

	const nextCursor = lastLikeDate
		? Buffer.from(lastLikeDate).toString('base64url')
		: null;

	return void res.json({ likes: detailedLikes, nextCursor });
};

export const likeController = async (
	req: Request<never, never, LikeType & { forceError?: boolean }>,
	res: Response
) => {
	const { commentId, postId, forceError, ...goodData } = req.body;
	const { entity, id } = resolveEntity(postId, commentId);

	const likePayload = {
		...goodData,
		id,
		entity,
		forceError,
		userId: req.userId as SUUID,
	};

	const likeResult = await upsertLike(likePayload);

	if (
		likeResult?.at(0)?.createdAt.getTime() ===
		likeResult?.at(0)?.updatedAt.getTime()
	) {
		return void res.sendStatus(201);
	}

	return void res.json({ id: likeResult?.at(0)?.id });
};

// Delete Likes
export const unlikeController = async (
	req: Request<
		never,
		never,
		never,
		{ commentId?: SUUID; postId?: SUUID; forceError?: boolean }
	>,
	res: Response
) => {
	const { commentId, postId, forceError } = req.query;
	const { entity, id } = resolveEntity(postId, commentId);

	const isLike = await likeExists({ id, entity });
	if (!isLike) throw Error('Like does not exist', { cause: 404 });

	await deleteLike({ id, entity, userId: req.userId as SUUID, forceError });

	return void res.json({ message: 'Like deleted successfully' });
};
