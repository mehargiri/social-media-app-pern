import { user } from '@/db/schema/index.js';
import { createInsertSchema } from 'drizzle-zod';
import { email } from 'zod/v4';

const passwordRegex =
	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[^\s]{8,}$/;

// Main Schema
export const insertUserSchema = createInsertSchema(user, {
	firstName: (schema) =>
		schema
			.min(1, 'First Name is required')
			.max(260, 'First Name cannot be more than 260 characters')
			.trim(),
	lastName: (schema) =>
		schema
			.min(1, 'Last Name is required')
			.max(260, 'Last Name cannot be more than 260 characters')
			.trim(),
	email: () => email('Email must be valid').min(1, 'Email is required').trim(),
	// schema.min(1, 'Email is required').email('Email must be valid').trim(),
	password: (schema) =>
		schema
			.min(8, 'Password is required and must be minimum of 8 characters')
			.regex(
				passwordRegex,
				'Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces'
			)
			.trim(),
	phone: (schema) =>
		schema.regex(
			/^\d{3}-\d{3}-\d{4}$/,
			'Phone number must be in format XXX-XXX-XXXX'
		),
	birthday: (schema) =>
		schema
			.regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday must be in YYYY-MM-DD format')
			.refine(
				(value) => !isNaN(new Date(value).getTime()),
				'Birthday must be valid date in YYYY-MM-DD format'
			),
	bio: (schema) =>
		schema.max(1000, 'Bio cannot be more than 1000 characters').trim(),
	currentCity: (schema) =>
		schema.max(260, 'Current city cannot be more than 260 characters'),
	hometown: (schema) =>
		schema.max(260, 'Hometown cannot be more than 260 characters'),
}).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	refreshToken: true,
	confirmedEmail: true,
});

export type UserType = typeof insertUserSchema._output;
