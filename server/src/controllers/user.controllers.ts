import {
	createUser,
	deleteUserById,
	findUserById,
	findUsersByName,
	updateUserById,
	userExists,
} from '@/services/user.services.js';
import { validateSUUID } from '@/utils/general.utils.js';
import { RegisterUserType, UpdateUserType } from '@/zod-schemas/user.js';
import argon from 'argon2';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';

export type CustomUserFiles = Partial<
	Record<'profileImage' | 'coverImage', Express.Multer.File[]>
>;

// export interface CustomUserUpdateRequest extends Request {
// 	params: { id: SUUID };
// 	body: UpdateUserType;
// 	files?: CustomUserFiles;
// }

// Read User
export const getUser = async (req: Request<{ id: SUUID }>, res: Response) => {
	const { id } = req.params;
	validateSUUID(id);
	const user = await findUserById({ id });
	if (!user) throw Error('User does not exist', { cause: 404 });
	res.json(user);
	return;
};

export const getUsersByName = async (
	req: Request<{ name: string }>,
	res: Response
) => {
	const { name } = req.params;
	if (!name) throw Error('Name is required', { cause: 400 });

	const users = await findUsersByName({ name });
	if (users.length === 0)
		throw Error('No user with the name exists', { cause: 404 });

	res.json(users);
	return;
};

// Create User
export const registerUser = async (
	req: Request<never, never, RegisterUserType>,
	res: Response
) => {
	const { password, ...data } = req.body;
	// Hash the password
	const hashedPassword = await argon.hash(password);

	const newUser = await createUser({ ...data, password: hashedPassword });
	if (!newUser) throw Error('Registration failed', { cause: 409 });
	res.status(201).json(newUser);
	return;
};

// Update User
export const updateUser = async (
	req: Request<{ id: SUUID }, never, UpdateUserType> & {
		files?: CustomUserFiles;
	},
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	// Later, multer will be replaced with CloudImage or Cloudinary

	const profileImage = req.files?.profileImage;
	const coverImage = req.files?.coverImage;

	const isUser = await userExists({ id });
	if (!isUser) throw Error('User does not exist', { cause: 404 });

	const updatedUser = await updateUserById({
		...req.body,
		profilePic: profileImage ? profileImage[0]?.path : '',
		coverPic: coverImage ? coverImage[0]?.path : '',
	});

	if (!updatedUser) throw Error('User update failed', { cause: 422 });

	res.json(updatedUser);
	return;
};

// Delete User
export const deleteUser = async (
	req: Request<{ id: SUUID }>,
	res: Response
) => {
	const { id } = req.params;
	validateSUUID(id);

	const user = await deleteUserById({ id });
	if (!user) throw Error('User does not exist', { cause: 404 });

	res.json({ message: 'User deleted successfully' });
	return;
};
