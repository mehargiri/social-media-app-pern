import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		watch: false,
		coverage: {
			reporter: ['text'],
			include: ['**/features/**', '**/middlewares/**', '**/utils/**'],
			exclude: [
				'**/*.services.ts',
				'**/*.zod.schemas.ts',
				'**/*.test.ts',
				'**/test.utils.ts',
				'**/dist/**',
			],
		},
		// reporters: 'verbose',
	},
});
