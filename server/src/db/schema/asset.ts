import { pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers.js';

export const assetTypeEnum = pgEnum('asset_type', ['image']);

export const asset = pgTable('asset', {
	id: uuid().primaryKey().defaultRandom(),
	type: assetTypeEnum().notNull(),
	...timestamps,
});
