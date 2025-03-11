import { relations } from 'drizzle-orm';
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';
import { like, user } from './index.js';
import { likeTypesEnum } from './like.js';

export const post = pgTable('post', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	content: text().notNull(),
	assets: text().array(),
	topLikeType1: likeTypesEnum(),
	topLikeType2: likeTypesEnum(),
	commentsCount: integer().default(0).notNull(),
	likesCount: integer().default(0).notNull(),
	...timestamps,
});

export const postRelations = relations(post, ({ one, many }) => ({
	author: one(user, {
		fields: [post.userId],
		references: [user.id],
	}),
	likes: many(like),
}));
