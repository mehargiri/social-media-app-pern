import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	deletePostById,
	findPosts,
	makePost,
	postExists,
	updatePostById,
} from './post.services.js';
import { PostType } from './post.zod.schemas.js';

export type PostAssets = Partial<Record<'assets', Express.Multer.File[]>>;

export const getPosts = async (
	req: Request<never, never, never, { cursor?: string; user?: 'me' | SUUID }>,
	res: Response
) => {
	const { cursor, user } = { ...req.query };

	const decodedCursor = cursor
		? Buffer.from(cursor, 'base64url').toString()
		: undefined;

	const userId = user === 'me' ? (req.userId as SUUID) : user;

	const totalPosts = await findPosts({ cursor: decodedCursor, userId });

	const lastPostDate =
		totalPosts[totalPosts.length - 1]?.postCreatedAt.toISOString();

	const nextCursor = lastPostDate
		? Buffer.from(lastPostDate).toString('base64url')
		: null;

	return void res.json({ posts: totalPosts, nextCursor });
};

export const createPost = async (
	req: Request<never, never, PostType> & { files?: PostAssets },
	res: Response
) => {
	const assetPaths = req.files?.assets?.map((asset) => asset.path);

	await makePost({
		...req.body,
		asset: assetPaths,
		userId: req.userId as SUUID,
	});

	return void res.sendStatus(201);
};

export const updatePost = async (
	req: Request<{ id: SUUID }, never, PostType> & { files?: PostAssets },
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	const assetPaths = req.files?.assets?.map((asset) => asset.path);

	const isPost = await postExists({ id });
	if (!isPost) throw Error('Post does not exist', { cause: 404 });

	const updatedPost = await updatePostById({
		...req.body,
		asset: assetPaths,
		id,
		userId: req.userId as SUUID,
	});

	return void res.json(updatedPost);
};

export const deletePost = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	const isPost = await postExists({ id });
	if (!isPost) throw Error('Post does not exist', { cause: 404 });

	await deletePostById({ id, userId: req.userId as SUUID });

	return void res.json({ message: 'Post deleted successfully' });
};
