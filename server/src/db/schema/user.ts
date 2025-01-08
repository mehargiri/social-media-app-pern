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
import { timestamps } from './columns.helpers.js';
import {
	college,
	friendship,
	highSchool,
	notificationUser,
	post,
	work,
} from './index.js';

export const userGenderEnum = pgEnum('gender', ['male', 'female', 'other']);

export const user = pgTable(
	'user_',
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
		email: text().notNull().unique(),
		password: text().notNull(),
		profilePic: text(),
		coverPic: text(),
		bio: text(),
		currentCity: text(),
		hometown: text(),
		confirmedEmail: boolean().notNull().default(false),
		refreshToken: text().array(),
		...timestamps,
	},
	(table) => [index('full_name_index').on(table.fullName)]
);

export const userRelations = relations(user, ({ many, one }) => ({
	friends: many(friendship, { relationName: 'friends' }),
	friendsOf: many(friendship, { relationName: 'friendsOf' }),
	posts: many(post),
	work: one(work),
	college: one(college),
	highSchool: one(highSchool),
	notifications: many(notificationUser),
}));
