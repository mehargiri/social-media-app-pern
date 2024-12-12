/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	convertToSUUID,
	convertToUUID,
	diskStorageDestination,
	diskStorageFilename,
	fileFilter,
	validateSUUID,
} from '@/utils/general.utils.js';
import { Request } from 'express';
import { mkdirSync } from 'fs';
import { MulterError } from 'multer';
import path from 'path';
import short, { SUUID } from 'short-uuid';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('General Helper Functions', () => {
	vi.mock('@/utils/general.utils.ts', { spy: true });
	vi.mock('fs', () => ({
		mkdirSync: vi.fn().mockImplementation((_path, _options) => true),
	}));

	afterAll(() => {
		vi.resetAllMocks();
	});

	describe('UUID Functions', () => {
		const translator = short();
		const testSUUID = '8orMfY6H7xXNZA7V7Z5EFq' as SUUID;
		const testUUID = translator.toUUID(testSUUID);

		describe('validateSUUID', () => {
			it('should accept a valid SUUID', () => {
				expect(() => {
					validateSUUID(testSUUID);
				}).not.toThrow();
			});
			it('should throw Error for invalid SUUID', () => {
				expect(() => {
					validateSUUID('hello');
				}).toThrow(Error('Valid id is required', { cause: 400 }));
			});
		});

		describe('convertToUUID', () => {
			it('should convert SUUID to UUID', () => {
				const convertedToUUID = convertToUUID(testSUUID);
				expect(convertToUUID).toHaveBeenCalledWith(testSUUID);
				expect(convertedToUUID).toStrictEqual(testUUID);
			});
		});

		describe('convertToSUUID', () => {
			it('should convert UUID to SUUID', () => {
				const convertedToSUUID = convertToSUUID(testUUID);
				expect(convertToSUUID).toHaveBeenCalledWith(testUUID);
				expect(convertedToSUUID).toStrictEqual(testSUUID);
			});
		});
	});

	describe('Multer Functions', () => {
		const mockCallback = vi.fn();
		const mockFile = {
			filename: 'test-file',
			fieldname: 'profileImage',
			mimetype: 'image/jpeg',
		} as unknown as Express.Multer.File;
		const req = {} as Request;

		beforeEach(() => {
			vi.clearAllMocks();
		});

		describe("fileStorage's destination test function", () => {
			it.each([
				['profileImage'],
				['coverImage'],
				['postImage'],
				['commentImage'],
				['replyImage'],
			])('should create directories for image field name: %s', (name) => {
				diskStorageDestination(
					req,
					{ ...mockFile, fieldname: name },
					mockCallback
				);

				const expectedPath = path.join(
					__dirname,
					`../../public/${name ? `${name}s` : ''}`
				);

				expect(mkdirSync).toHaveBeenCalledWith(expectedPath, {
					recursive: true,
				});
				expect(mockCallback).toHaveBeenCalledWith(null, expectedPath);
			});
			it('should use empty subdirectory of public for unknown file name', () => {
				diskStorageDestination(
					req,
					{ ...mockFile, fieldname: 'test-field' },
					mockCallback
				);

				const expectedPath = path.join(__dirname, '../../public');

				expect(mkdirSync).toHaveBeenCalledWith(expectedPath, {
					recursive: true,
				});
				expect(mockCallback).toHaveBeenCalledWith(null, expectedPath);
			});
		});

		describe("fileStorage's filename function", () => {
			const mockCallbackFilename = vi.fn();

			beforeEach(() => {
				vi.clearAllMocks();
			});

			it.each([
				['profileImage', 'image/png'],
				['profileImage', 'image/jpg'],
				['coverImage', 'image/png'],
				['coverImage', 'image/jpg'],
				['postImage', 'image/png'],
				['postImage', 'image/jpg'],
				['commentImage', 'image/png'],
				['commentImage', 'image/jpg'],
				['replyImage', 'image/png'],
				['replyImage', 'image/jpg'],
			])(
				'should generate filename for fieldname: %s and mimetype: %s',
				(name, mime) => {
					diskStorageFilename(
						req,
						{ ...mockFile, fieldname: name, mimetype: mime },
						mockCallbackFilename
					);

					const extension = mime.split('/')[1] ?? '';
					expect(mockCallbackFilename).toHaveBeenLastCalledWith(
						null,
						`${name}-${mockFile.filename}.${extension}`
					);
				}
			);
		});

		describe("fileStorage's filefilter function", () => {
			const mockCallbackFileFilter = vi.fn();

			beforeEach(() => {
				vi.clearAllMocks();
			});

			it.each([['image/png'], ['image/jpg']])(
				'should allow file with mimetype: %s',
				(mime) => {
					fileFilter(
						req,
						{ ...mockFile, mimetype: mime },
						mockCallbackFileFilter
					);

					expect(mockCallbackFileFilter).toHaveBeenCalledWith(null, true);
				}
			);

			it('should throw MulterError for invalid mimetype', () => {
				fileFilter(
					req,
					{ ...mockFile, mimetype: 'test-mime-type' },
					mockCallbackFileFilter
				);

				expect(mockCallbackFileFilter).toHaveBeenCalledWith(
					new MulterError('LIMIT_UNEXPECTED_FILE', mockFile.fieldname)
				);
			});

			it.each([[0.9 * 1024 * 1024], [1 * 1024 * 1024]])(
				'should allow file with size <= 1 MB, size:%i',
				(fileSize) => {
					fileFilter(
						req,
						{ ...mockFile, size: fileSize },
						mockCallbackFileFilter
					);

					expect(mockCallbackFileFilter).toHaveBeenCalledWith(null, true);
				}
			);

			it('should throw Multer Error with size >= 1 MB, size: 2MB', () => {
				fileFilter(
					req,
					{ ...mockFile, size: 2 * 1024 * 1024 },
					mockCallbackFileFilter
				);

				expect(mockCallbackFileFilter).toHaveBeenCalledWith(
					new MulterError('LIMIT_FILE_SIZE', mockFile.fieldname)
				);
			});
		});
	});
});
