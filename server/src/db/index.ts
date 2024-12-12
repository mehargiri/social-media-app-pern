import * as schema from '@/db/schema/index.js';
import env from '@/env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const connection = postgres(env.DATABASE_URL, {
	...((env.DB_MIGRATING || env.DB_SEEDING) && { max: 1 }),
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	...(env.DB_SEEDING && { onnotice: () => {} }),
});

export const db = drizzle(connection, {
	schema,
	logger: true,
	casing: 'snake_case',
});

export type db = typeof db;
