import * as schema from '@/db/schema/index.js';
import env from '@/env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const connection = postgres(env.DATABASE_URL, {
	...(env.DB_MIGRATING && { max: 1 }),
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	...((env.DB_SEEDING || env.NODE_ENV === 'test') && { onnotice: () => {} }),
});

export const db = drizzle(connection, {
	schema,
	logger: env.NODE_ENV === 'test' ? false : true,
	casing: 'snake_case',
});

export const connectDB = async () => {
	try {
		await connection`SELECT 1`;
		console.info('Connected to the database');
	} catch (error) {
		console.error('Failed to connect to the database');
		throw error;
	}
};

export type db = typeof db;
