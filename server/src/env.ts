import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { coerce, infer as infer_, object, string, ZodError } from 'zod/v4';

const stringBoolean = coerce
	.string()
	.transform((val) => {
		return val === 'true';
	})
	.prefault('false');

const envSchema = object({
	DB_HOST: string(),
	DB_USER: string(),
	DB_PASSWORD: string(),
	DB_NAME: string(),
	DB_PORT: string(),
	DATABASE_URL: string(),
	PORT: string(),
	ACCESS_TOKEN_SECRET: string(),
	REFRESH_TOKEN_SECRET: string(),
	DB_MIGRATING: stringBoolean,
	DB_SEEDING: stringBoolean,
	NODE_ENV: coerce.string(),
});

export type envSchema = infer_<typeof envSchema>;

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
