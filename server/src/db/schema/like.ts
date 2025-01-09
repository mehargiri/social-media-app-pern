import { relations, sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';
import { comment, post, reply, user } from './index.js';

export const likeTypesEnum = pgEnum('like_type', ['like', 'love', 'happy']);

export const like = pgTable(
	'like',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: uuid().references(() => post.id, { onDelete: 'cascade' }),
		commentId: uuid().references(() => comment.id, { onDelete: 'cascade' }),
		replyId: uuid().references(() => reply.id, { onDelete: 'cascade' }),
		type: likeTypesEnum().default('like'),
	},
	(table) => [
		check(
			'like_at_least_one_entity',
			sql`${table.postId} IS NOT NULL OR ${table.commentId} IS NOT NULL OR ${table.replyId} IS NOT NULL`
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
	reply: one(reply, {
		fields: [like.replyId],
		references: [reply.id],
	}),
}));
