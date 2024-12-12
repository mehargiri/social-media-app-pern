import config from '$/drizzle.config.js';
import env from '@/env.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { connection, db } from './index.js';

if (!env.DB_MIGRATING)
	throw Error('DB_MIGRATING must be set to "true" before migrations');

await migrate(db, { migrationsFolder: config.out ?? './src/db/migrations' });

await connection.end();
