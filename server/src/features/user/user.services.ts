import { db } from '@/db/index.js';
import { user } from '@/db/schema/index.js';
import { LoginUserType } from '@/features/auth/auth.zod.schemas.js';
import { convertToSUUID, convertToUUID } from '@/utils/general.utils.js';
import { eq, ilike, sql } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import { UserType } from './user.zod.schemas.js';

// Read User
export const findUserById = async (data: { id: SUUID }) => {
	const foundUser = await db.query.user.findFirst({
		columns: {
			password: false,
			confirmedEmail: false,
			firstName: false,
			lastName: false,
			refreshToken: false,
			createdAt: false,
			updatedAt: false,
		},
		where: eq(user.id, convertToUUID(data.id)),
		with: {
			friends: {
				columns: {
					status: true,
				},
				with: {
					friend: {
						columns: {
							id: true,
							fullName: true,
							profilePic: true,
						},
					},
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

	let foundUserWithSUUID;

	if (foundUser) {
		const { college, work, highSchool, friends, ...user } = foundUser;

		foundUserWithSUUID = {
			...user,
			id: convertToSUUID(user.id),
			college: college ? { ...college, id: convertToSUUID(college.id) } : null,
			work: work ? { ...work, id: convertToSUUID(work.id) } : null,
			highSchool: highSchool
				? { ...highSchool, id: convertToSUUID(highSchool.id) }
				: null,
			friends: friends.map((friendItem) => ({
				...friendItem,
				friend: {
					...friendItem.friend,
					id: convertToSUUID(friendItem.friend.id),
				},
			})),
		};
	}
	return foundUserWithSUUID;
};

export const findUsersByName = async (data: { name: string }) => {
	const foundUsers = await db
		.select({
			id: user.id,
			fullName: user.fullName,
			profilePic: user.profilePic,
		})
		.from(user)
		.where(ilike(user.fullName, `${data.name}%`))
		.limit(5)
		.orderBy(user.fullName);

	const foundUsersWithSUUID = foundUsers.map((user) => ({
		...user,
		id: convertToSUUID(user.id),
	}));

	return foundUsersWithSUUID;
};

// Create User
export const createUser = async (data: UserType) => {
	const newUser = await db.insert(user).values(data).returning({ id: user.id });

	const newUserWithSUUID = newUser.map((user) => ({
		...user,
		id: convertToSUUID(user.id),
	}));

	return newUserWithSUUID[0];
};

// Update User
export const updateUserById = async (
	data: Partial<UserType> & {
		id: SUUID;
		updatedAt?: Date;
		refreshToken?: string[];
	}
) => {
	const { id: userId, ...goodData } = data;
	const updatedUser = await db
		.update(user)
		.set(goodData)
		.where(eq(user.id, convertToUUID(userId)))
		.returning({ id: user.id });

	const updatedUserWithSUUID = updatedUser.map((user) => ({
		...user,
		id: convertToSUUID(user.id),
	}));
	return updatedUserWithSUUID[0];
};

// Delete User
export const deleteUserById = async (data: { id: SUUID }) => {
	const deletedUser = await db
		.delete(user)
		.where(eq(user.id, convertToUUID(data.id)))
		.returning({ id: user.id });

	const deletedUserWithSUUID = deletedUser.map((user) => ({
		...user,
		id: convertToSUUID(user.id),
	}));

	return deletedUserWithSUUID[0];
};

// User Confirmation for Update Action
export const userExists = async (data: { id: SUUID }) => {
	const isUser = await db.query.user.findFirst({
		where: eq(user.id, convertToUUID(data.id)),
		columns: { id: true },
	});

	let userWithSUUID;
	if (isUser) userWithSUUID = { ...isUser, id: convertToSUUID(isUser.id) };

	return userWithSUUID;
};

// User Data for Login Action
export const getUserDataForLogin = async (
	data: Omit<LoginUserType, 'password'>
) => {
	const foundUser = await db.query.user.findFirst({
		where: eq(user.email, data.email),
		columns: { password: true, id: true, refreshToken: true },
	});

	let foundUserWithSUUID;
	if (foundUser) {
		foundUserWithSUUID = { ...foundUser, id: convertToSUUID(foundUser.id) };
	}

	return foundUserWithSUUID;
};

// User Token Confirmation for Login Action
export const userTokenExists = async (data: { refreshToken: string }) => {
	const token = await db
		.select({ id: user.id, refreshToken: user.refreshToken })
		.from(user)
		.where(sql`${data.refreshToken} = ANY(${user.refreshToken})`)
		.limit(1);

	const tokenWithGoodId = token.map((item) => ({
		...item,
		id: convertToSUUID(item.id),
	}));

	return tokenWithGoodId[0];
};
