import { validateSUUID } from '@/utils/general.utils.js';
import argon from 'argon2';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import {
	createUser,
	deleteUserById,
	findUserById,
	findUsersByName,
	updateUserById,
	userExists,
} from './user.services.js';
import { UserType } from './user.zod.schemas.js';

export type CustomUserFiles = Partial<
	Record<'profileImage' | 'coverImage', Express.Multer.File[]>
>;

// Read User
export const getMe = async (req: Request, res: Response) => {
	const { userId: id } = req;
	validateSUUID(id);
	const me = await findUserById({ id: id as SUUID });
	if (!me) throw Error('User does not exist', { cause: 404 });
	return void res.json(me);
};

export const getUser = async (req: Request<{ id: SUUID }>, res: Response) => {
	const { id } = req.params;
	validateSUUID(id);
	const user = await findUserById({ id });
	if (!user) throw Error('User does not exist', { cause: 404 });
	return void res.json(user);
};

export const getUsersByName = async (
	req: Request<never, never, never, { name: string }>,
	res: Response
) => {
	const { name } = req.query;
	if (!name) throw Error('Name is required', { cause: 400 });

	const users = await findUsersByName({ name });
	if (users.length === 0)
		throw Error('No user with the name exists', { cause: 404 });

	return void res.json(users);
};

// Create User
export const registerUser = async (
	req: Request<never, never, UserType>,
	res: Response
) => {
	const { password, ...data } = req.body;
	// Hash the password
	const hashedPassword = await argon.hash(password);

	await createUser({ ...data, password: hashedPassword });
	return void res.sendStatus(201);
};

// Update User
export const updateUser = async (
	req: Request<{ id: SUUID }, never, UserType> & {
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
		id,
		profilePic: profileImage ? profileImage[0]?.path : '',
		coverPic: coverImage ? coverImage[0]?.path : '',
		updatedAt: new Date(),
	});

	return void res.json(updatedUser);
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

	return void res.json({ message: 'User deleted successfully' });
};
