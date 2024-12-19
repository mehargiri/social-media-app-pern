import {
	createUser,
	deleteUserById,
	findUserById,
	findUsersByName,
	updateUserById,
	userExists,
} from '@/services/user.services.js';
import { RegisterUserType, UpdateUserType } from '@/zod-schemas/user.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import { Readable } from 'stream';
import { afterAll, describe, expect, it, Mock, vi } from 'vitest';
import {
	CustomUserFiles,
	deleteUser,
	getMe,
	getUser,
	getUsersByName,
	registerUser,
	updateUser,
} from './user.controllers.js';

const mockUser: Awaited<ReturnType<typeof findUserById>> = {
	id: 'id-SUUID' as SUUID,
	fullName: 'John Doe',
	phone: '123-456-7581',
	gender: 'other',
	birthday: '2010-01-01',
	email: 'sample@email.com',
	profilePic: 'localhost:8000/sampleImage',
	coverPic: 'localhost:8000/sampleImage',
	bio: 'person amazing bio',
	currentCity: 'some city',
	hometown: 'some city',
	friends: Array.from({ length: 3 }, () => ({
		status: 'unfriend',
		friend: {
			id: 'id-SUUID' as SUUID,
			fullName: 'Jane Doe',
			profilePic: 'localhost:8000/sampleImage',
		},
	})),
	college: {
		id: 'id-SUUID' as SUUID,
		name: 'some great name',
		type: 'college',
		startYear: 2015,
		endYear: 2020,
		description: 'random sentences',
		major1: 'some other random sentences',
		major2: 'some other random sentences',
		major3: 'some other random sentences',
		degree: 'some other random sentences',
	},
	work: {
		id: 'id-SUUID' as SUUID,
		company: 'some great name',
		position: 'some position',
		description: 'some other description',
		city: 'some random city',
		startYear: 2015,
		endYear: 2020,
		workingNow: true,
	},
	highSchool: {
		id: 'id-SUUID' as SUUID,
		name: 'some great name',
		description: 'random sentences',
		startYear: 2015,
		endYear: 2020,
		graduated: true,
	},
};

const mockUsers = Array.from({ length: 2 }, () => ({ ...mockUser }));

const testFiles: CustomUserFiles = {
	profileImage: [
		{
			originalname: 'profile',
			fieldname: 'profileImage',
			mimetype: 'image/png',
			size: 0.8 * 1024 * 1024,
			destination: '/server/public/profileImage',
			path: '/server/public/profileImage/mockFilename',
			encoding: 'deprecated',
			stream: 'mockStream' as unknown as Readable,
			buffer: 'mockBuffer' as unknown as Buffer,
			filename: 'mockFilename',
		},
	],
	coverImage: [
		{
			originalname: 'cover',
			fieldname: 'coverImage',
			mimetype: 'image/png',
			size: 0.8 * 1024 * 1024,
			destination: '/server/public/coverImage',
			path: '/server/public/coverImage/mockFilename',
			encoding: 'deprecated',
			stream: 'mockStream' as unknown as Readable,
			buffer: 'mockBuffer' as unknown as Buffer,
			filename: 'mockFilename',
		},
	],
};

describe('User Controller Functions', () => {
	const req = {
		params: {
			id: mockUser.id,
			name: mockUser.fullName,
		},
		body: {
			email: mockUser.email,
			password: 'random-password',
		},
		files: testFiles,
	};

	const res = {
		status: vi.fn().mockReturnThis(),
		json: vi.fn(),
	};

	vi.mock('@/utils/general.utils.js', () => ({
		validateSUUID: vi.fn().mockImplementation(() => true),
	}));

	vi.mock('@/services/user.services.js', () => ({
		findUserById: vi.fn(),
		findUsersByName: vi.fn(),
		createUser: vi.fn(),
		deleteUserById: vi.fn(),
		userExists: vi.fn(),
		updateUserById: vi.fn(),
	}));

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('getUser function', () => {
		it('should throw Error when user is not found', async () => {
			(findUserById as Mock).mockResolvedValue(undefined);

			await expect(
				getUser(
					req as unknown as Request<{ id: SUUID }>,
					res as unknown as Response
				)
			).rejects.toThrow(Error('User does not exist', { cause: 404 }));
		});

		it('should call res.json when user exists', async () => {
			(findUserById as Mock).mockResolvedValue(mockUser);

			await getUser(
				req as unknown as Request<{ id: SUUID }>,
				res as unknown as Response
			);

			expect(res.json).toHaveBeenCalledWith(mockUser);
		});
	});
	describe('getMe function', () => {
		it('should throw Error when user is not found', async () => {
			(findUserById as Mock).mockResolvedValue(undefined);

			await expect(
				getMe(req as unknown as Request, res as unknown as Response)
			).rejects.toThrow(Error('User does not exist', { cause: 404 }));
		});

		it('should call res.json when user exists', async () => {
			(findUserById as Mock).mockResolvedValue(mockUser);

			await getMe(req as unknown as Request, res as unknown as Response);

			expect(res.json).toHaveBeenCalledWith(mockUser);
		});
	});

	describe('getUsersByName function', () => {
		it('should throw Error when name is missing', async () => {
			req.params.name = null;
			await expect(
				getUsersByName(
					req as unknown as Request<{ name: string }>,
					res as unknown as Response
				)
			).rejects.toThrow(Error('Name is required', { cause: 400 }));
		});

		it('should throw Error when user with the name does not exist', async () => {
			req.params.name = mockUser.fullName;
			(findUsersByName as Mock).mockResolvedValue([]);
			await expect(
				getUsersByName(
					req as unknown as Request<{ name: string }>,
					res as unknown as Response
				)
			).rejects.toThrow(Error('No user with the name exists', { cause: 404 }));
		});

		it('should call res.json with array of users on success', async () => {
			(findUsersByName as Mock).mockResolvedValue(mockUsers);

			await getUsersByName(
				req as unknown as Request<{ name: string }>,
				res as unknown as Response
			);

			expect(res.json).toHaveBeenCalledWith(mockUsers);
		});
	});

	describe('registerUser function', () => {
		it('should throw Error when user creation fails due to bad input', async () => {
			(createUser as Mock).mockResolvedValue(undefined);

			await expect(
				registerUser(
					req as unknown as Request<never, never, RegisterUserType>,
					res as unknown as Response
				)
			).rejects.toThrow(Error('Registration failed', { cause: 409 }));
		});

		it('should call res.status with HTTP 201 and res.json with id of ser on success', async () => {
			(createUser as Mock).mockResolvedValue({ id: mockUser.id });

			await registerUser(
				req as unknown as Request<never, never, RegisterUserType>,
				res as unknown as Response
			);

			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({ id: mockUser.id });
		});
	});

	describe('deleteUser function', () => {
		it('should throw Error if user deletion fails due to incorrect id', async () => {
			(deleteUserById as Mock).mockResolvedValue(undefined);

			await expect(
				deleteUser(
					req as unknown as Request<{ id: SUUID }>,
					res as unknown as Response
				)
			).rejects.toThrow(Error('User does not exist', { cause: 404 }));
		});

		it('should call res.json with a message on success', async () => {
			(deleteUserById as Mock).mockResolvedValue({ id: mockUser.id });

			await deleteUser(
				req as unknown as Request<{ id: SUUID }>,
				res as unknown as Response
			);

			expect(res.json).toHaveBeenCalledWith({
				message: 'User deleted successfully',
			});
		});
	});

	describe('updateUser function', () => {
		it('should throw Error when the user with given id does not exist', async () => {
			(userExists as Mock).mockResolvedValue(undefined);

			await expect(
				updateUser(
					req as unknown as Request<{ id: SUUID }, never, UpdateUserType>,
					res as unknown as Response
				)
			).rejects.toThrow(Error('User does not exist', { cause: 404 }));
		});

		it('should throw Error when updating user fails', async () => {
			(userExists as Mock).mockResolvedValue({ id: mockUser.id });
			(updateUserById as Mock).mockResolvedValue(undefined);

			await expect(
				updateUser(
					req as unknown as Request<{ id: SUUID }, never, UpdateUserType>,
					res as unknown as Response
				)
			).rejects.toThrow(Error('User update failed', { cause: 422 }));
		});

		it('should call res.json on success', async () => {
			(userExists as Mock).mockResolvedValue({ id: mockUser.id });
			(updateUserById as Mock).mockResolvedValue({ id: mockUser.id });

			await updateUser(
				req as unknown as Request<{ id: SUUID }, never, UpdateUserType>,
				res as unknown as Response
			);

			expect(res.json).toHaveBeenCalledWith({ id: mockUser.id });
		});
	});
});
