import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { z, ZodError } from 'zod';

const stringBoolean = z.coerce
	.string()
	.transform((val) => {
		return val === 'true';
	})
	.default('false');

const envSchema = z.object({
	DB_HOST: z.string(),
	DB_USER: z.string(),
	DB_PASSWORD: z.string(),
	DB_NAME: z.string(),
	DB_PORT: z.string(),
	DATABASE_URL: z.string(),
	PORT: z.string(),
	ACCESS_TOKEN_SECRET: z.string(),
	REFRESH_TOKEN_SECRET: z.string(),
	DB_MIGRATING: stringBoolean,
	DB_SEEDING: stringBoolean,
});

export type envSchema = z.infer<typeof envSchema>;

expand(config());

try {
	envSchema.parse(process.env);
} catch (error) {
	if (error instanceof ZodError) {
		const message =
			'Missing required values in .env\n' +
			error.issues
				.map((issue) =>
					typeof issue.path[0] === 'string' ? issue.path[0] : '[Unknown Path]'
				)
				.join('\n');
		console.error(message);
		process.exit(1);
	}
}

export default envSchema.parse(process.env);
