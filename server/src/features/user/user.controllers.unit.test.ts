import {
	createTestCollege,
	createTestFile,
	createTestHighSchool,
	createTestUser,
	createTestWork,
	samplePassword,
	sampleSUUID,
} from '@/utils/test.utils.js';
import { Request, Response } from 'express';
import { SUUID } from 'short-uuid';
import { afterAll, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
	CustomUserFiles,
	deleteUser,
	getMe,
	getUser,
	getUsersByName,
	registerUser,
	updateUser,
} from './user.controllers.js';
import {
	createUser,
	deleteUserById,
	findUserById,
	findUsersByName,
	updateUserById,
	userExists,
} from './user.services.js';
import { UserType } from './user.zod.schemas.js';

const testUser = createTestUser();
testUser.password = samplePassword;
const testCollege = createTestCollege();
const testWork = createTestWork();
const testHighSchool = createTestHighSchool();

const mockUser = {
	...testUser,
	id: sampleSUUID,
	profilePic: 'localhost:8000/sampleImage',
	coverPic: 'localhost:8000/sampleImage',
	friends: Array.from({ length: 3 }, () => ({
		status: 'unfriend',
		friend: {
			id: sampleSUUID,
			fullName: 'Jane Doe',
			profilePic: 'localhost:8000/sampleImage',
		},
	})),
	college: { ...testCollege, id: sampleSUUID },
	work: { ...testWork, id: sampleSUUID },
	highSchool: { ...testHighSchool, id: sampleSUUID },
};

const mockUsers = Array.from({ length: 2 }, () => ({ ...mockUser }));

const testFiles: CustomUserFiles = {
	profileImage: [createTestFile('profileImage')],
	coverImage: [createTestFile('coverImage')],
};

describe('User Controller Functions', () => {
	const req = {
		params: {
			id: mockUser.id,
		},
		query: {
			name: `${mockUser.firstName} ${mockUser.lastName}` as string | null,
		},
		body: {
			email: mockUser.email,
			password: samplePassword,
		},
		files: testFiles,
	};

	const res = {
		status: vi.fn().mockReturnThis(),
		json: vi.fn(),
		sendStatus: vi.fn(),
	};

	vi.mock('@/utils/general.utils.js', () => ({
		validateSUUID: vi.fn().mockImplementation(() => true),
	}));

	vi.mock('./user.services.js', () => ({
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
		const callTestFn = async () => {
			await getUser(
				req as unknown as Request<{ id: SUUID }>,
				res as unknown as Response
			);
		};

		it('should throw Error when user is not found', async () => {
			(findUserById as Mock).mockResolvedValue(undefined);

			await expect(callTestFn()).rejects.toThrowError(
				Error('User does not exist', { cause: 404 })
			);
		});

		it('should call res.json when user exists', async () => {
			(findUserById as Mock).mockResolvedValue(mockUser);

			await callTestFn();

			expect(res.json).toHaveBeenCalledWith(mockUser);
		});
	});

	describe('getMe function', () => {
		const callTestFn = async () => {
			await getMe(req as unknown as Request, res as unknown as Response);
		};

		it('should throw Error when user is not found', async () => {
			(findUserById as Mock).mockResolvedValue(undefined);

			await expect(callTestFn()).rejects.toThrowError(
				Error('User does not exist', { cause: 404 })
			);
		});

		it('should call res.json when user exists', async () => {
			(findUserById as Mock).mockResolvedValue(mockUser);

			await callTestFn();

			expect(res.json).toHaveBeenCalledWith(mockUser);
		});
	});

	describe('getUsersByName function', () => {
		const callTestFn = async () => {
			await getUsersByName(
				req as unknown as Request<never, never, never, { name: string }>,
				res as unknown as Response
			);
		};

		beforeEach(() => {
			req.query.name = `${mockUser.firstName} ${mockUser.lastName}`;
		});

		it('should throw Error when name is missing', async () => {
			req.query.name = null;
			await expect(callTestFn()).rejects.toThrowError(
				Error('Name is required', { cause: 400 })
			);
		});

		it('should throw Error when user with the name does not exist', async () => {
			(findUsersByName as Mock).mockResolvedValue([]);
			await expect(callTestFn()).rejects.toThrowError(
				Error('No user with the name exists', { cause: 404 })
			);
		});

		it('should call res.json with array of users on success', async () => {
			(findUsersByName as Mock).mockResolvedValue(mockUsers);

			await callTestFn();

			expect(res.json).toHaveBeenCalledWith(mockUsers);
		});
	});

	describe('registerUser function', () => {
		const callTestFn = async () => {
			await registerUser(
				req as unknown as Request<never, never, UserType>,
				res as unknown as Response
			);
		};

		it('should call res.status with HTTP 201 and res.json with id of user on success', async () => {
			(createUser as Mock).mockResolvedValue({ id: mockUser.id });

			await callTestFn();

			expect(res.sendStatus).toHaveBeenCalledWith(201);
		});
	});

	describe('deleteUser function', () => {
		const callTestFn = async () => {
			await deleteUser(
				req as unknown as Request<{ id: SUUID }>,
				res as unknown as Response
			);
		};

		it('should throw Error when user deletion fails due to incorrect id', async () => {
			(deleteUserById as Mock).mockResolvedValue(undefined);

			await expect(callTestFn()).rejects.toThrowError(
				Error('User does not exist', { cause: 404 })
			);
		});

		it('should call res.json with a message on success', async () => {
			(deleteUserById as Mock).mockResolvedValue({ id: mockUser.id });

			await callTestFn();

			expect(res.json).toHaveBeenCalledWith({
				message: 'User deleted successfully',
			});
		});
	});

	describe('updateUser function', () => {
		const callTestFn = async () => {
			await updateUser(
				req as unknown as Request<{ id: SUUID }, never, UserType>,
				res as unknown as Response
			);
		};

		it('should throw Error when the user with given id does not exist', async () => {
			(userExists as Mock).mockResolvedValue(undefined);

			await expect(callTestFn()).rejects.toThrowError(
				Error('User does not exist', { cause: 404 })
			);
		});

		it('should call res.json on success', async () => {
			(userExists as Mock).mockResolvedValue({ id: mockUser.id });
			(updateUserById as Mock).mockResolvedValue({ id: mockUser.id });

			await callTestFn();

			expect(res.json).toHaveBeenCalledWith({ id: mockUser.id });
		});
	});
});
