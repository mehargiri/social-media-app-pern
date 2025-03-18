import { validateSUUID } from '@/utils/general.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	deletePostById,
	findPost,
	findPosts,
	makePost,
	postExists,
	updatePostById,
} from './post.services.js';
import { PostType } from './post.zod.schemas.js';

export const getPosts = async (
	req: Request<never, never, never, { cursor?: string; user?: 'me' | SUUID }>,
	res: Response<{
		posts: Awaited<ReturnType<typeof findPosts>>;
		nextCursor: string | null;
	}>
) => {
	const { cursor, user } = { ...req.query };

	const decodedCursor = cursor
		? Buffer.from(cursor, 'base64url').toString()
		: undefined;

	const userId = user === 'me' ? (req.userId as SUUID) : user;

	if (userId) validateSUUID(userId, 'user');

	const totalPosts = await findPosts({ cursor: decodedCursor, userId });

	const lastPostDate =
		totalPosts[totalPosts.length - 1]?.postCreatedAt.toISOString();

	const nextCursor = lastPostDate
		? Buffer.from(lastPostDate).toString('base64url')
		: null;

	return void res.json({ posts: totalPosts, nextCursor });
};

export const getPost = async (
	req: Request<{ id: SUUID }>,
	res: Response<{ post: Awaited<ReturnType<typeof findPost>> }>
) => {
	const { id } = req.params;
	validateSUUID(id, 'post');
	const singlePost = await findPost({ postId: id });
	return void res.json({ post: singlePost });
};

export const createPost = async (
	req: Request<never, never, PostType>,
	res: Response
) => {
	const attachedFiles = req.files as Express.Multer.File[] | undefined;

	const assetPaths = attachedFiles?.map((item) => item.path);

	await makePost({
		...req.body,
		assets: assetPaths,
		userId: req.userId as SUUID,
	});

	return void res.sendStatus(201);
};

export const updatePost = async (
	req: Request<{ id: SUUID }, never, PostType>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'post');

	const attachedFiles = req.files as Express.Multer.File[] | undefined;

	const assetPaths = attachedFiles?.map((item) => item.path);

	const isPost = await postExists({ id });
	if (!isPost) throw Error('Post does not exist', { cause: 404 });

	const updatedPost = await updatePostById({
		...req.body,
		assets: assetPaths,
		id,
		userId: req.userId as SUUID,
		updatedAt: new Date(),
	});

	return void res.json(updatedPost);
};

export const deletePost = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id, 'post');

	const isPost = await postExists({ id });
	if (!isPost) throw Error('Post does not exist', { cause: 404 });

	await deletePostById({ id, userId: req.userId as SUUID });

	return void res.json({ message: 'Post deleted successfully' });
};
