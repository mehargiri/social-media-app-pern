import { relations } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';
import { like, user } from './index.js';

export const post = pgTable('post', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	content: text().notNull(),
	assets: text().array(),
	...timestamps,
});

export const postRelations = relations(post, ({ one, many }) => ({
	author: one(user, {
		fields: [post.userId],
		references: [user.id],
	}),
	likes: many(like),
}));
