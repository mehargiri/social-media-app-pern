import config from '$/drizzle.config';
import env from '@/env';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { connection, db } from '.';

if (!env.DB_MIGRATING)
	throw Error('DB_MIGRATING must be set to "true" before migrations');

await migrate(db, { migrationsFolder: config.out ?? './src/db/migrations' });

await connection.end();
