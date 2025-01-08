import { defineConfig } from 'drizzle-kit';
// import env from './dist/src/env.js';

export default defineConfig({
	schema: './dist/src/db/schema/index.js',
	out: './src/db/migrations',
	dialect: 'postgresql',
	// dbCredentials: {
	// 	url: env.DATABASE_URL,
	// },
	verbose: true,
	strict: true,
	casing: 'snake_case',
});
