import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { user } from './user';

export const highSchool = pgTable('high_school', {
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

export const highSchoolRelations = relations(highSchool, ({ one }) => ({
	user: one(user, {
		fields: [highSchool.userId],
		references: [user.id],
	}),
}));
