import { relations, sql, SQL } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	pgEnum,
	pgTable,
	text,
	uuid,
} from 'drizzle-orm/pg-core';

import { college } from './college';
import { timestamps } from './columns.helpers';
import { friendship } from './friendship';
import { highSchool } from './highSchool';
import { post } from './post';
import { work } from './work';

export const userGenderEnum = pgEnum('gender', ['male', 'female', 'other']);

export const user = pgTable(
	'user',
	{
		id: uuid().primaryKey().defaultRandom(),
		firstName: text().notNull(),
		lastName: text().notNull(),
		fullName: text().generatedAlwaysAs(
			(): SQL => sql`${user.firstName} || ' ' || ${user.lastName}`
		),
		phone: text(),
		gender: userGenderEnum(),
		birthday: date(),
		username: text().notNull().unique(),
		email: text().notNull().unique(),
		password: text().notNull(),
		profilePic: text(),
		coverPic: text(),
		bio: text(),
		currentCity: text(),
		hometown: text(),
		confirmedEmail: boolean().notNull().default(false),
		...timestamps,
	},
	(table) => [index('full_name_index').on(table.fullName)]
);

export const userRelations = relations(user, ({ many, one }) => ({
	friends: many(friendship),
	posts: many(post),
	work: one(work),
	college: one(college),
	highSchool: one(highSchool),
}));
