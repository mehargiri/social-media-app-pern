import { relations } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { asset } from './asset.js';
import { timestamps } from './columns.helpers.js';
import { user } from './index.js';

export const post = pgTable('post', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	content: text(),
	assetId: uuid()
		.notNull()
		.references(() => asset.id),
	...timestamps,
});

export const postRelations = relations(post, ({ one }) => ({
	author: one(user, {
		fields: [post.userId],
		references: [user.id],
	}),
	asset: one(asset, {
		fields: [post.assetId],
		references: [asset.id],
	}),
}));
