import { relations } from 'drizzle-orm';
import { boolean, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';
import { notification, user } from './index.js';

export const notificationUser = pgTable(
	'notification_user',
	{
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		notificationId: uuid()
			.notNull()
			.references(() => notification.id, { onDelete: 'cascade' }),
		read: boolean().default(false),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.userId, table.notificationId] })]
);

export const notificationUserRelations = relations(
	notificationUser,
	({ one }) => ({
		user: one(user, {
			fields: [notificationUser.userId],
			references: [user.id],
		}),
		notification: one(notification, {
			fields: [notificationUser.notificationId],
			references: [notification.id],
		}),
	})
);
