import { user } from '@/db/schema';
import { createInsertSchema } from 'drizzle-zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

export const insertUserSchema = createInsertSchema(user, {
	firstName: (schema) =>
		schema.firstName
			.min(1, 'First Name is required')
			.max(500, 'First Name cannot be more than 500 characters')
			.trim(),
	lastName: (schema) =>
		schema.lastName
			.min(1, 'Last Name is required')
			.max(500, 'Last Name cannot be more than 500 characters')
			.trim(),
	email: (schema) => schema.email.email('Email must be valid').trim(),
	username: (schema) =>
		schema.username
			.min(1, 'Username is required')
			.max(100, 'Username cannot be more than 100 characters')
			.trim(),
	password: (schema) =>
		schema.password
			.min(8, 'Password is required and must be minimum of 8 characters')
			.regex(
				passwordRegex,
				'Stronger password is required. The password must have one uppercase, one lowercase, one number and one special character and no spaces'
			),
	phone: (schema) =>
		schema.phone.regex(
			/^\d{3}-\d{3}-\d{4}$/,
			'Phone number must be in format XXX-XXX-XXXX'
		),
	birthday: (schema) =>
		schema.birthday.refine(
			(value) => !isNaN(new Date(value).getTime()),
			'Birthday must be valid date in YYYY-MM-DD format'
		),
}).omit({ createdAt: true, updatedAt: true });

export const deleteUserSchema = insertUserSchema.pick({ id: true }).required();

export const loginUserSchema = insertUserSchema
	.pick({ username: true, email: true, password: true })
	.partial({ username: true });

export const registerUserSchema = insertUserSchema.omit({
	id: true,
	fullName: true,
	confirmedEmail: true,
});

export const updateUserSchema = insertUserSchema
	.omit({ fullName: true })
	.partial()
	.required({ id: true });

export type RegisterUserType = typeof registerUserSchema._type;

export type LoginUserType = typeof loginUserSchema._type;

export type DeleteUserType = typeof deleteUserSchema._type;

export type UpdateUserType = typeof updateUserSchema._type;
