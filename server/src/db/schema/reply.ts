import { relations, sql } from 'drizzle-orm';
import {
	AnyPgColumn,
	check,
	integer,
	pgTable,
	text,
	uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { comment } from './comment';
import { like } from './like';
import { user } from './user';

export const reply = pgTable(
	'reply',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		repliedUserId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		commentId: uuid()
			.notNull()
			.references(() => comment.id, { onDelete: 'cascade' }),
		replyId: uuid().references((): AnyPgColumn => reply.id, {
			onDelete: 'cascade',
		}),
		content: text(),
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
	repliedUser: one(user, {
		fields: [reply.repliedUserId],
		references: [user.id],
	}),
	comment: one(comment, {
		fields: [reply.commentId],
		references: [comment.id],
	}),
	repliedReply: one(reply, {
		fields: [reply.replyId],
		references: [reply.id],
	}),
	likes: many(like),
}));
