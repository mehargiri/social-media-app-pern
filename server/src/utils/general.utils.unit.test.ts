import { Request } from 'express';
import { mkdirSync } from 'fs';
import path from 'path';
import short, { SUUID } from 'short-uuid';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	allowedFileTypes,
	convertToSUUID,
	convertToUUID,
	diskStorageDestination,
	diskStorageFilename,
	fileFilter,
	imageFieldNames,
	validateSUUID,
} from './general.utils.js';

describe('General Utils Functions', () => {
	vi.mock('fs', () => ({
		mkdirSync: vi.fn().mockImplementation(() => true),
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
					validateSUUID(testSUUID, '');
				}).not.toThrow();
			});

			// The idName for the test below is set to test which does not make sense (but needed for the test). Elsewhere in the codebase, actual idName like post, comment should be used
			it('should throw Error for invalid SUUID', () => {
				expect(() => {
					validateSUUID('hello', 'test');
				}).toThrow(Error('Valid id is required for test', { cause: 400 }));
			});
		});

		describe('convertToUUID', () => {
			it('should convert SUUID to UUID', () => {
				const convertedToUUID = convertToUUID(testSUUID);
				expect(convertedToUUID).toStrictEqual(testUUID);
			});
		});

		describe('convertToSUUID', () => {
			it('should convert UUID to SUUID', () => {
				const convertedToSUUID = convertToSUUID(testUUID);
				expect(convertedToSUUID).toStrictEqual(testSUUID);
			});
		});
	});

	describe('Multer Functions', () => {
		const mockCallback = vi.fn();
		const mockFile = {
			originalname: 'test-file',
			fieldname: 'profileImage',
			mimetype: 'image/jpeg',
		} as unknown as Express.Multer.File;
		const req = {} as Request;

		beforeEach(() => {
			vi.clearAllMocks();
		});

		describe("fileStorage's destination test function", () => {
			imageFieldNames.forEach((name) => {
				it(`should create directories for image field name: ${name}`, () => {
					diskStorageDestination(
						req,
						{ ...mockFile, fieldname: name },
						mockCallback
					);

					const expectedPath = path.join(
						__dirname,
						`../assets/${name ? `${name}s` : ''}`
					);

					expect(mkdirSync).toHaveBeenCalledWith(expectedPath, {
						recursive: true,
					});
					expect(mockCallback).toHaveBeenCalledWith(null, expectedPath);
				});
			});

			it.each([
				['empty', ''],
				['malicious', '../malicious'],
				['random', 'random'],
			])(
				'should use empty subdirectory of public for %s field name: %s',
				(_description, fieldname) => {
					diskStorageDestination(req, { ...mockFile, fieldname }, mockCallback);

					const expectedPath = path.join(__dirname, '../assets');

					expect(mkdirSync).toHaveBeenCalledWith(expectedPath, {
						recursive: true,
					});
					expect(mockCallback).toHaveBeenCalledWith(null, expectedPath);
				}
			);
		});

		describe("fileStorage's filename function", () => {
			const mockCallbackFilename = vi.fn();

			beforeEach(() => {
				vi.clearAllMocks();
			});

			imageFieldNames.forEach((name) => {
				allowedFileTypes.forEach((mime) => {
					it(`should generate filename for fieldnames: ${name} and mimetype: ${mime}`, () => {
						diskStorageFilename(
							req,
							{ ...mockFile, fieldname: name, mimetype: mime },
							mockCallbackFilename
						);

						const extension = mime.split('/')[1] ?? '';
						expect(mockCallbackFilename).toHaveBeenLastCalledWith(
							null,
							`${name}-${mockFile.originalname}.${extension}`
						);
					});
				});
			});
		});

		describe("fileStorage's filefilter function", () => {
			const mockCallbackFileFilter = vi.fn();

			beforeEach(() => {
				vi.clearAllMocks();
			});

			allowedFileTypes.forEach((mime) => {
				it(`should allow file with mimetype: ${mime}`, () => {
					fileFilter(
						req,
						{ ...mockFile, mimetype: mime },
						mockCallbackFileFilter
					);

					expect(mockCallbackFileFilter).toHaveBeenCalledWith(null, true);
				});
			});

			it('should throw MulterError for invalid mimetype', () => {
				fileFilter(
					req,
					{ ...mockFile, mimetype: 'test-mime-type' },
					mockCallbackFileFilter
				);

				expect(mockCallbackFileFilter).toHaveBeenCalledWith(
					expect.objectContaining({
						code: 'LIMIT_UNEXPECTED_FILE',
						field: mockFile.fieldname,
					})
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
					expect.objectContaining({
						code: 'LIMIT_FILE_SIZE',
						field: mockFile.fieldname,
					})
				);
			});
		});
	});
});
