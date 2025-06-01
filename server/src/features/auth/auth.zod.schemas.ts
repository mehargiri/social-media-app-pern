import { user } from '@/db/schema/index.js';
import { createSelectSchema } from 'drizzle-zod';
import { email } from 'zod/v4';

export const loginUserSchema = createSelectSchema(user, {
	email: () => email('Email must be valid').min(1, 'Email is required').trim(),
	// schema.min(1, 'Email is required').email('Email must be valid'),
	password: (schema) => schema.min(1, 'Password is required').trim(),
}).pick({
	email: true,
	password: true,
});

export type LoginUserType = typeof loginUserSchema._output;
