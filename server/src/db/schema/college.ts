import { relations } from 'drizzle-orm';
import { integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { user } from './user';

export const collegeTypeEnum = pgEnum('college_type', [
	'college, graduate_school',
	'university',
]);

export const college = pgTable('college', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text(),
	startYear: integer(),
	endYear: integer(),
	description: text(),
	major1: text('major_1'),
	major2: text('major_2'),
	major3: text('major_3'),
	degree: text(),
	type: collegeTypeEnum(),
});

export const collegeRelations = relations(college, ({ one }) => ({
	user: one(user, {
		fields: [college.userId],
		references: [user.id],
	}),
}));
