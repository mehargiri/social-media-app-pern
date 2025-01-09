import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { user } from './index.js';

export const highschool = pgTable('highschool', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text(),
	startYear: integer(),
	endYear: integer(),
	graduated: boolean().default(false),
	description: text(),
});

export const highschoolRelations = relations(highschool, ({ one }) => ({
	user: one(user, {
		fields: [highschool.userId],
		references: [user.id],
	}),
}));
