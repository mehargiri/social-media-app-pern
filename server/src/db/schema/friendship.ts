import { relations } from 'drizzle-orm';
import { pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { user } from './user';

export const friendStatusEnum = pgEnum('friend_status', [
	'unfriend',
	'pending',
	'friend',
]);

export const friendship = pgTable(
	'friendship',
	{
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		friendId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: friendStatusEnum().default('unfriend'),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.userId, table.friendId] })]
);

export const friendshipRelations = relations(friendship, ({ one }) => ({
	user: one(user, {
		fields: [friendship.userId],
		references: [user.id],
	}),
	friend: one(user, {
		fields: [friendship.friendId],
		references: [user.id],
	}),
}));
