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
import { comment, like, user } from './index.js';

export const reply = pgTable(
	'reply',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		parentReplyId: uuid().references((): AnyPgColumn => reply.id, {
			onDelete: 'cascade',
		}),
		parentReplyUserId: uuid().references(() => user.id, {
			onDelete: 'cascade',
		}),
		commentId: uuid()
			.notNull()
			.references(() => comment.id, { onDelete: 'cascade' }),
		content: text().notNull(),
		replyLevel: integer().default(1),
		...timestamps,
	},
	(table) => [
		check(
			'reply_level_check',
			sql`${table.replyLevel} >= 1 AND ${table.replyLevel} <= 3`
		),
	]
);

export const replyRelations = relations(reply, ({ one, many }) => ({
	user: one(user, {
		fields: [reply.userId],
		references: [user.id],
	}),
	parentReplyUser: one(user, {
		fields: [reply.parentReplyUserId],
		references: [user.id],
	}),
	comment: one(comment, {
		fields: [reply.commentId],
		references: [comment.id],
	}),
	parentReply: one(reply, {
		fields: [reply.parentReplyId],
		references: [reply.id],
		relationName: 'childReplies',
	}),
	likes: many(like),
	childReplies: many(reply, {
		relationName: 'childReplies',
	}),
}));
