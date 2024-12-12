import { relations, sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { comment, post, reply, user } from './index.js';

export const likeTypesEnum = pgEnum('like_type', ['like', 'love', 'happy']);

export const like = pgTable(
	'like',
	{
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		commentId: uuid().references(() => comment.id, { onDelete: 'cascade' }),
		replyId: uuid().references(() => reply.id, { onDelete: 'cascade' }),
		type: likeTypesEnum().default('like'),
	},
	(table) => [
		primaryKey({
			columns: [table.userId, table.postId, table.commentId, table.replyId],
		}),
		check(
			'valid_like_check',
			sql`(${table.postId} IS NOT NULL AND ${table.commentId} IS NULL AND ${table.replyId} IS NULL) OR 
			(${table.postId} IS NOT NULL AND ${table.commentId} IS NOT NULL AND ${table.replyId} IS NULL) OR 
			(${table.postId} IS NOT NULL AND ${table.commentId} IS NOT NULL AND ${table.replyId} IS NOT NULL)`
		),
	]
);

export const likeRelations = relations(like, ({ one }) => ({
	user: one(user, {
		fields: [like.userId],
		references: [user.id],
	}),
	post: one(post, {
		fields: [like.postId],
		references: [post.id],
	}),
	comment: one(comment, {
		fields: [like.commentId],
		references: [comment.id],
	}),
}));
