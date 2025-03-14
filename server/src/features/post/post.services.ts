import { db } from '@/db/index.js';
import { post, user } from '@/db/schema/index.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { and, desc, eq, lt } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { PostType } from './post.zod.schemas.js';

// Get Posts
export const findPosts = async (data: { cursor?: string; userId?: SUUID }) => {
	const { cursor, userId } = data;

	const posts = await db
		.select({
			fullName: user.fullName,
			profilePic: user.profilePic,
			userId: user.id,
			id: post.id,
			content: post.content,
			postAssets: post.assets,
			postCreatedAt: post.createdAt,
			postUpdatedAt: post.updatedAt,
		})
		.from(post)
		.leftJoin(user, eq(post.userId, user.id))
		.where(
			and(
				userId ? eq(post.userId, convertToUUID(userId)) : undefined,
				cursor ? lt(post.createdAt, new Date(cursor)) : undefined
			)
		)
		.orderBy(desc(post.createdAt))
		.limit(5);

	const postsWithSUUID = posts.map((post) => ({
		...post,
		id: convertToSUUID(post.id),
		...(post.userId && { userId: convertToSUUID(post.userId) }),
		...(post.userId && { fullName: post.fullName }),
		...(post.userId && { profilePic: post.profilePic }),
	}));

	return postsWithSUUID;
};

// Create Posts
export const makePost = async (data: PostType & { userId: SUUID }) => {
	const { userId, ...goodData } = data;
	const newPost = await db
		.insert(post)
		.values({ ...goodData, userId: convertToUUID(userId) })
		.returning({ id: post.id });

	const newPostWithSUUID = newPost.map((post) => ({
		...post,
		id: convertToSUUID(post.id),
	}));

	return newPostWithSUUID[0];
};

// Update Posts
export const updatePostById = async (
	data: PostType & { id: SUUID; userId: SUUID; updatedAt: Date }
) => {
	const { id, userId, ...goodData } = data;
	const updatedPost = await db
		.update(post)
		.set(goodData)
		.where(
			and(
				eq(post.id, convertToUUID(id)),
				eq(post.userId, convertToUUID(userId))
			)
		)
		.returning({ id: post.id });

	const updatedPostWithSUUID = updatedPost.map((post) => ({
		...post,
		id: convertToSUUID(post.id),
	}));
	return updatedPostWithSUUID[0];
};

// Delete Posts
export const deletePostById = async (data: { id: SUUID; userId: SUUID }) => {
	const { id, userId } = data;
	const deletedPost = await db
		.delete(post)
		.where(
			and(
				eq(post.id, convertToUUID(id)),
				eq(post.userId, convertToUUID(userId))
			)
		)
		.returning({ id: post.id });

	const deletedPostWithSUUID = deletedPost.map((post) => ({
		...post,
		id: convertToSUUID(post.id),
	}));
	return deletedPostWithSUUID[0];
};

export const postExists = async (data: { id: SUUID }) => {
	const isPost = await db
		.select({ content: post.content })
		.from(post)
		.where(eq(post.id, convertToUUID(data.id)));

	return isPost[0] ? true : false;
};
