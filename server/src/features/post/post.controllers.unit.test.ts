import { sampleSUUID } from '@/utils/test.utils.js';
import { Request, Response } from 'express';
import { generate, SUUID } from 'short-uuid';
import { describe, expect, it, Mock, vi } from 'vitest';
import {
	createPost,
	deletePost,
	getPosts,
	updatePost,
} from './post.controllers.js';
import {
	deletePostById,
	findPosts,
	makePost,
	postExists,
	updatePostById,
} from './post.services.js';
import { PostType } from './post.zod.schemas.js';

const testPosts = Array.from({ length: 5 }).map((_item, index) => ({
	content: 'A random sentence',
	asset: 'pictureUrl',
	postCreatedAt: new Date(Date.now() + index * 24 * 60 * 60 * 1000),
}));

const lastDate = testPosts[testPosts.length - 1]?.postCreatedAt.toISOString();

const nextCursor = lastDate
	? Buffer.from(lastDate).toString('base64url')
	: null;

describe('Post Controller Functions', () => {
	const req = {
		params: { id: sampleSUUID },
	};

	const res = {
		sendStatus: vi.fn(),
		json: vi.fn(),
	};

	vi.mock('./post.services.ts', () => ({
		makePost: vi.fn(),
		postExists: vi.fn(),
		updatePostById: vi.fn(),
		deletePostById: vi.fn(),
		findPosts: vi.fn(),
	}));

	describe('getPosts function', () => {
		it('should call res.json with the posts and a nextCursor value on success', async () => {
			(findPosts as Mock).mockResolvedValue(testPosts);
			await getPosts(
				req as Request<
					never,
					never,
					never,
					{ cursor?: string; user?: 'me' | SUUID }
				>,
				res as unknown as Response<{
					posts: Awaited<ReturnType<typeof findPosts>>;
					nextCursor: string | null;
				}>
			);

			expect(nextCursor).not.toBeNull();
			expect(res.json).toHaveBeenCalledWith({ posts: testPosts, nextCursor });
		});
	});

	describe('createPost function', () => {
		it('should call makePost and res.sendStatus with HTTP 201 on success', async () => {
			(makePost as Mock).mockResolvedValue({ id: sampleSUUID });

			await createPost(
				req as unknown as Request<never, never, PostType>,
				res as unknown as Response
			);

			expect(res.sendStatus).toHaveBeenLastCalledWith(201);
		});
	});

	describe('updatePost function', () => {
		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await updatePost(
				req as unknown as Request<{ id: SUUID }, never, PostType>,
				res as unknown as Response
			);
		};

		it('should throw Error when invalid id is provided in the request params', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required', { cause: 400 })
			);
		});

		it('should throw Error when post with given id in request params does not exist', async () => {
			await expect(callTestFn(generate())).rejects.toThrowError(
				Error('Post does not exist', { cause: 404 })
			);
		});

		it('should call res.json with the same id present in request params on success', async () => {
			(postExists as Mock).mockResolvedValue(true);
			(updatePostById as Mock).mockResolvedValue({ id: sampleSUUID });
			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({ id: sampleSUUID });
		});
	});

	describe('deletePost function', () => {
		const callTestFn = async (id: SUUID) => {
			req.params.id = id;
			await deletePost(
				req as unknown as Request<{ id: SUUID }>,
				res as unknown as Response
			);
		};

		it('should throw Error when invalid id is provided in the request params', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required', { cause: 400 })
			);
		});

		it('should throw Error when post with given id in request params does not exist', async () => {
			await expect(callTestFn('random-id' as SUUID)).rejects.toThrowError(
				Error('Valid id is required', { cause: 400 })
			);
		});

		it('should call res.json with a message on success', async () => {
			(postExists as Mock).mockResolvedValue(true);
			(deletePostById as Mock).mockResolvedValue({ id: sampleSUUID });
			await callTestFn(sampleSUUID);
			expect(res.json).toHaveBeenCalledWith({
				message: 'Post deleted successfully',
			});
		});
	});
});
