import env from '@/env.js';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: `${
		process.env['NODE_ENV'] === 'production'
			? './src/db/schema/index.js'
			: './src/db/schema/index.ts'
	}`,
	out: './src/db/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: env.DATABASE_URL,
	},
	verbose: true,
	strict: true,
	casing: 'snake_case',
});
