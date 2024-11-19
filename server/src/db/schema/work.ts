import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { user } from './user';

export const work = pgTable('work', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	company: text(),
	position: text(),
	city: text(),
	description: text(),
	startYear: integer(),
	endYear: integer(),
	workingNow: boolean().default(false),
});

export const workRelations = relations(work, ({ one }) => ({
	user: one(user, {
		fields: [work.userId],
		references: [user.id],
	}),
}));
