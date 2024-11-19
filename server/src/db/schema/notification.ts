import { relations } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { comment } from './comment';
import { post } from './post';
import { reply } from './reply';
import { user } from './user';

export const notificationTypeEnum = pgEnum('notification_type', [
	'friendRequest',
	'like',
	'comment',
	'reply',
	'post',
]);

export const notification = pgTable('notification', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	postId: uuid().references(() => post.id, { onDelete: 'cascade' }),
	commentId: uuid().references(() => comment.id, { onDelete: 'cascade' }),
	replyId: uuid().references(() => reply.id, { onDelete: 'cascade' }),
	read: boolean().default(false),
	type: notificationTypeEnum(),
	...timestamps,
});

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
		receivers: many(user),
	})
);
