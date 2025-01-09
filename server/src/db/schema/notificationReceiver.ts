import { relations } from 'drizzle-orm';
import { boolean, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';
import { notification, user } from './index.js';

export const notificationReceiver = pgTable(
	'notification_receiver',
	{
		userId: uuid()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		notificationId: uuid()
			.notNull()
			.references(() => notification.id, { onDelete: 'cascade' }),
		isRead: boolean().default(false),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.userId, table.notificationId] })]
);

export const notificationReceiverRelations = relations(
	notificationReceiver,
	({ one }) => ({
		user: one(user, {
			fields: [notificationReceiver.userId],
			references: [user.id],
		}),
		notification: one(notification, {
			fields: [notificationReceiver.notificationId],
			references: [notification.id],
		}),
	})
);
