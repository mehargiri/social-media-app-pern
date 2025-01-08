import { user } from '@/db/schema/user.js';
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from 'drizzle-zod';
import { SUUID } from 'short-uuid';

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
	email: (schema) =>
		schema.email('Email must be valid').min(1, 'Email is required').trim(),
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
			.regex(
				/^\d{4}-\d{2}-\d{2}$/,
				'Birthday must be valid date in YYYY-MM-DD format'
			)
			.refine(
				(value) => !isNaN(new Date(value).getTime()),
				'Birthday must be valid date in YYYY-MM-DD format'
			),
}).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	refreshToken: true,
	confirmedEmail: true,
});

// Schemas for different CRUD actions
export const loginUserSchema = createSelectSchema(user, {
	email: (schema) =>
		schema.min(1, 'Email is required').email('Email must be valid'),
	password: (schema) => schema.min(1, 'Password is required'),
}).pick({
	email: true,
	password: true,
});

export const registerUserSchema = insertUserSchema;

export const updateUserSchema = createUpdateSchema(user).omit({
	id: true,
	createdAt: true,
});

// Types for different CRUD actions
export type RegisterUserType = typeof registerUserSchema._type;

export type LoginUserType = typeof loginUserSchema._type;

export type UpdateUserType = typeof updateUserSchema._type & { id: SUUID };
