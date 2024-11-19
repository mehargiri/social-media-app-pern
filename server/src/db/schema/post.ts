import { relations } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { user } from './user';

export const post = pgTable('post', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	content: text(),
	asset: text(),
	...timestamps,
});

export const postRelations = relations(post, ({ one }) => ({
	author: one(user, {
		fields: [post.userId],
		references: [user.id],
	}),
}));
