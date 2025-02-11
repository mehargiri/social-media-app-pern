import { Request } from 'express';
import { mkdirSync } from 'fs';
import multer, { FileFilterCallback, MulterError } from 'multer';
import path from 'path';
import short, { SUUID } from 'short-uuid';

// UUID Conversions
const translator = short();

export const validateSUUID = (id: string | SUUID) => {
	const validId = translator.validate(id, true);
	if (!validId) throw Error('Valid id is required', { cause: 400 });
};

export const convertToUUID = (id: string | SUUID) => {
	return translator.toUUID(id);
};

export const convertToSUUID = (id: string) => {
	return translator.fromUUID(id);
};

// Multer
export const maxFileSize = 1 * 1024 * 1024; // 1 MB
export const allowedFileTypes = ['image/png', 'image/jpg']; // only png and jpg allowed
export const imageFieldNames = ['profilePic', 'coverPic'];

export type DestinationCallback = (
	error: Error | null,
	destination: string
) => void;

export type FileNameCallBack = (error: Error | null, filename: string) => void;

export type CustomFileFilterCallBack = (
	error: Error | null,
	acceptFile?: boolean
) => void;

export const diskStorageDestination = (
	_req: Request,
	file: Express.Multer.File,
	callback: DestinationCallback
) => {
	const baseDir = path.join(__dirname, '../assets');
	const sanitizedFieldName = file.fieldname.replace(/[^a-zA-Z0-9]/g, '');
	const subDir = imageFieldNames.includes(sanitizedFieldName)
		? `${sanitizedFieldName}s`
		: '';

	const uploadPath = path.join(baseDir, subDir);
	mkdirSync(uploadPath, { recursive: true });
	callback(null, uploadPath);
};

export const diskStorageFilename = (
	_req: Request,
	file: Express.Multer.File,
	callback: FileNameCallBack
) => {
	const extension = file.mimetype.split('/')[1] ?? '';
	const sanitizedOriginalFilename = file.originalname
		.replace(/[^a-zA-Z0-9-_. ]/g, '')
		.split('.')[0];
	callback(
		null,
		`${file.fieldname}-${sanitizedOriginalFilename ?? ''}.${extension}`
	);
};

export const fileStorage = multer.diskStorage({
	destination: diskStorageDestination,
	filename: diskStorageFilename,
});

export const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	callback: FileFilterCallback
) => {
	if (!allowedFileTypes.includes(file.mimetype)) {
		callback(new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
	}

	callback(null, true);
};
