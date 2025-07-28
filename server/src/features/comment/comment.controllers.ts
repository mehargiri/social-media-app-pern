import {
	getCursorPaginatedData,
	validateSUUID,
} from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	deleteCommentById,
	findComments,
	findReplies,
	makeComment,
	updateCommentById,
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
	validateSUUID(postId, 'post');
	const { cursor } = req.query;

	const { data: comments, nextCursor } = await getCursorPaginatedData(
		findComments,
		{ postId },
		cursor
	);

	return void res.json({ comments, nextCursor });
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

	const { data: replies, nextCursor } = await getCursorPaginatedData(
		findReplies,
		{ parentCommentId },
		cursor
	);

	return void res.json({ replies, nextCursor });
};

// Create Comment
export const createComment = async (
	req: Request<never, never, CommentType>,
	res: Response
) => {
	const { parentCommentId, commentLevel, ...goodData } = req.body;

	await makeComment({
		...goodData,
		parentCommentId,
		commentLevel,
		userId: req.userId as SUUID,
	});

	return void res.sendStatus(201);
};

// Update Comment
export const updateComment = async (
	req: Request<{ id: SUUID }, never, UpdateCommentType>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'comment');

	const updatedComment = await updateCommentById({
		...req.body,
		id,
		userId: req.userId as SUUID,
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

	const result = await deleteCommentById({ id, userId: req.userId as SUUID });

	if (result?.isReply) {
		return void res.json({ message: 'Reply deleted successfully' });
	}

	return void res.json({ message: 'Comment deleted successfully' });
};
