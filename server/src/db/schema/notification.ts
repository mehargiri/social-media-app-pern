import { relations, sql } from 'drizzle-orm';
import { boolean, check, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';
import { comment, notificationReceiver, post, reply, user } from './index.js';

export const notificationTypeEnum = pgEnum('notification_type', [
	'friendRequest',
	'like',
	'comment',
	'reply',
	'post',
]);

export const notification = pgTable(
	'notification',
	{
		id: uuid().primaryKey().defaultRandom(),
		receiverId: uuid().references(() => user.id, { onDelete: 'cascade' }),
		senderId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		postId: uuid().references(() => post.id, { onDelete: 'cascade' }),
		commentId: uuid().references(() => comment.id, { onDelete: 'cascade' }),
		replyId: uuid().references(() => reply.id, { onDelete: 'cascade' }),
		type: notificationTypeEnum(),
		isBroadcast: boolean().default(false),
		...timestamps,
	},
	(table) => [
		check(
			'notify_at_least_one_entity',
			sql`${table.receiverId} IS NOT NULL OR ${table.postId} IS NOT NULL OR ${table.commentId} IS NOT NULL OR ${table.replyId} IS NOT NULL`
		),
	]
);

export const notificationRelations = relations(
	notification,
	({ one, many }) => ({
		post: one(post, {
			fields: [notification.postId],
			references: [post.id],
		}),
		comment: one(comment, {
			fields: [notification.commentId],
			references: [comment.id],
		}),
		reply: one(reply, {
			fields: [notification.replyId],
			references: [reply.id],
		}),
		receivers: many(notificationReceiver),
	})
);
