import { db } from '@/db';
import { user } from '@/db/schema';
import {
	DeleteUserType,
	RegisterUserType,
	UpdateUserType,
} from '@/zod-schemas/user';
import { eq, ilike } from 'drizzle-orm';

// Read User
export const getUser = async (userId: string) => {
	const foundUser = await db.query.user.findFirst({
		columns: {
			password: false,
			confirmedEmail: false,
			firstName: false,
			lastName: false,
		},
		where: eq(user.id, userId),
		with: {
			friends: {
				columns: {
					userId: false,
					friendId: false,
				},
				with: {
					friend: {
						columns: {
							id: true,
							fullName: true,
							username: true,
							profilePic: true,
						},
					},
				},
			},
			posts: {
				columns: {
					userId: false,
				},
			},
			work: {
				columns: {
					userId: false,
				},
			},
			college: {
				columns: {
					userId: false,
				},
			},
			highSchool: {
				columns: { userId: false },
			},
		},
	});

	return foundUser;
};

export const getUsersByName = async (name: string) => {
	const foundUsers = await db.query.user.findMany({
		columns: {
			id: true,
			fullName: true,
			username: true,
			profilePic: true,
		},
		where: ilike(user.fullName, name),
	});

	return foundUsers;
};

// Create User
export const createUser = async (data: RegisterUserType) => {
	const newUser = await db
		.insert(user)
		.values({ ...data, username: data.email })
		.returning({ id: user.id });
	return newUser[0];
};

// Update User
export const updateUser = async (data: UpdateUserType) => {
	const updatedUser = await db
		.update(user)
		.set(data)
		.where(eq(user.id, data.id))
		.returning({ id: user.id });
	return updatedUser[0];
};

// Delete User
export const deleteUser = async (data: DeleteUserType) => {
	const deletedUser = await db
		.delete(user)
		.where(eq(user.id, data.id))
		.returning({ id: user.id });

	return deletedUser[0];
};
