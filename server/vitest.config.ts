import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		watch: false,
		coverage: {
			reporter: ['text', 'json', 'html'],
		},
		// reporters: 'verbose',
		exclude: [
			'**/db-data/**',
			'**/node_modules/**',
			'**/public/**',
			'**/db/**',
			'**/{drizzle,eslint}.config.*',
			'**/docker-compose.yml',
		],
	},
});
