// @ts-check

import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['dist/', 'node_modules/', 'drizzle.config.ts'] },
	{
		rules: {
			'@typescript-eslint/no-misused-promises': 'off',
		},
	},
	eslint.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	prettier,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{ files: ['**/*.js'], ...tseslint.configs.disableTypeChecked }
);
