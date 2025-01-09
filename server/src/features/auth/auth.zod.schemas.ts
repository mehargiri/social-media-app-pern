import { user } from '@/db/schema/index.js';
import { createSelectSchema } from 'drizzle-zod';

export const loginUserSchema = createSelectSchema(user, {
	email: (schema) =>
		schema.min(1, 'Email is required').email('Email must be valid'),
	password: (schema) => schema.min(1, 'Password is required'),
}).pick({
	email: true,
	password: true,
});

export type LoginUserType = typeof loginUserSchema._type;
