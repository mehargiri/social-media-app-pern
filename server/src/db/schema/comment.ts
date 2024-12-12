import { relations } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';
import { post, reply, user } from './index.js';

export const comment = pgTable('comment', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	postId: uuid()
		.notNull()
		.references(() => post.id, { onDelete: 'cascade' }),
	content: text(),
	...timestamps,
});

export const commentRelations = relations(comment, ({ one, many }) => ({
	author: one(user, {
		fields: [comment.userId],
		references: [user.id],
	}),
	post: one(post, {
		fields: [comment.postId],
		references: [post.id],
	}),
	replies: many(reply),
}));
