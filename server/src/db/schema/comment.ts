import { relations, sql } from 'drizzle-orm';
import {
	AnyPgColumn,
	check,
	integer,
	pgTable,
	text,
	uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';
import { like, post, user } from './index.js';

export const comment = pgTable(
	'comment',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		parentCommentId: uuid().references((): AnyPgColumn => comment.id, {
			onDelete: 'cascade',
		}),
		content: text().notNull(),
		commentLevel: integer().default(0).notNull(),
		...timestamps,
	},
	(table) => [
		check(
			'comment_level_check',
			sql`${table.commentLevel} >= 0 AND ${table.commentLevel} <= 2`
		),
	]
);

export const commentRelations = relations(comment, ({ one, many }) => ({
	author: one(user, {
		fields: [comment.userId],
		references: [user.id],
	}),
	post: one(post, {
		fields: [comment.postId],
		references: [post.id],
	}),
	parentComment: one(comment, {
		fields: [comment.parentCommentId],
		references: [comment.id],
		relationName: 'replies',
	}),
	replies: many(comment, {
		relationName: 'replies',
	}),
	likes: many(like),
}));
