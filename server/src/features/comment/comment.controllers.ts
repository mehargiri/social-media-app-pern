import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	commentExists,
	deleteCommentById,
	findComments,
	findReplies,
	makeComment,
	updateCommentById,
	updateParentCommentReplyCount,
} from './comment.services.js';
import { CommentType, UpdateCommentType } from './comment.zod.schemas.js';

// Read Comments
export const getComments = async (
	req: Request<{ postId: SUUID }, never, never, { cursor?: string }>,
	res: Response<{
		comments: Awaited<ReturnType<typeof findComments>>;
		nextCursor: string | null;
	}>
) => {
	const { postId } = req.params;
	const { cursor } = req.query;
	validateSUUID(postId, 'post');

	const decodedCursor = cursor
		? Buffer.from(cursor, 'base64url').toString()
		: undefined;

	const totalComments = await findComments({ postId, cursor: decodedCursor });

	const lastCommentDate =
		totalComments[totalComments.length - 1]?.createdAt.toISOString();

	const nextCursor = lastCommentDate
		? Buffer.from(lastCommentDate).toString('base64url')
		: null;

	return void res.json({ comments: totalComments, nextCursor });
};

export const getReplies = async (
	req: Request<{ parentCommentId: SUUID }, never, never, { cursor?: string }>,
	res: Response<{
		replies: Awaited<ReturnType<typeof findReplies>>;
		nextCursor: string | null;
	}>
) => {
	const { parentCommentId } = req.params;
	const { cursor } = req.query;
	validateSUUID(parentCommentId, 'parent comment');

	const decodedCursor = cursor
		? Buffer.from(cursor, 'base64url').toString()
		: undefined;

	const totalReplies = await findReplies({
		parentCommentId,
		cursor: decodedCursor,
	});

	const lastReplyDate =
		totalReplies[totalReplies.length - 1]?.createdAt.toISOString();

	const nextCursor = lastReplyDate
		? Buffer.from(lastReplyDate).toString('base64url')
		: null;

	return void res.json({ replies: totalReplies, nextCursor });
};

// Create Comment
export const createComment = async (
	req: Request<never, never, CommentType>,
	res: Response
) => {
	const { parentCommentId, commentLevel, ...goodData } = req.body;
	if (parentCommentId && commentLevel === 0) {
		throw Error(
			'Comment level has to be greater than 0 if parent comment id is present',
			{ cause: 400 }
		);
	}

	await makeComment({
		...goodData,
		parentCommentId,
		commentLevel,
		userId: req.userId as SUUID,
	});

	// Reply is created if parentCommentId is present
	// Otherwise top level comment is created
	if (parentCommentId) {
		// Need to update the replies count of the parent comment
		await updateParentCommentReplyCount({
			id: parentCommentId,
			type: 'increase',
		});
	}

	return void res.sendStatus(201);
};

// Update Comment
export const updateComment = async (
	req: Request<{ id: SUUID }, never, UpdateCommentType>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'comment');

	const isComment = await commentExists({ id });
	if (!isComment) throw Error('Comment does not exist', { cause: 404 });

	const updatedComment = await updateCommentById({
		...req.body,
		id,
		userId: req.userId as SUUID,
		updatedAt: new Date(),
	});

	return void res.json(updatedComment);
};

// Delete Comment
export const deleteComment = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'comment');

	const isComment = await commentExists({ id });
	if (!isComment) throw Error('Comment does not exist', { cause: 404 });

	await deleteCommentById({ id, userId: req.userId as SUUID });

	if (isComment.parentCommentId) {
		await updateParentCommentReplyCount({
			id: isComment.parentCommentId,
			type: 'decrease',
		});
	}

	return void res.json({ message: 'Comment deleted successfully' });
};
