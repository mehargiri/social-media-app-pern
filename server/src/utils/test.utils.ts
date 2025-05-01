import { db } from '@/db/index.js';
import { collegeTypeEnum } from '@/db/schema/college.js';
import { likeTypesEnum } from '@/db/schema/like.js';
import { user, userGenderEnum } from '@/db/schema/user.js';
import { CollegeType } from '@/features/college/college.zod.schemas.js';
import { CommentType } from '@/features/comment/comment.zod.schemas.js';
import { HighschoolType } from '@/features/highschool/highschool.zod.schemas.js';
import { LikeType } from '@/features/like/like.zod.schemas.js';
import { PostType } from '@/features/post/post.zod.schemas.js';
import { UserType } from '@/features/user/user.zod.schemas.js';
import { WorkType } from '@/features/work/work.zod.schemas.js';
import { faker } from '@faker-js/faker';
import { hash } from 'argon2';
import { eq } from 'drizzle-orm';
import { Response as ExpressResponse } from 'express';
import { SUUID } from 'short-uuid';
import type { Readable } from 'stream';
import type { Response } from 'supertest';
import { convertToSUUID, convertToUUID } from './general.utils.js';

export type SuperTestResponse<T> = Omit<Response, 'body'> & { body: T };
export type ResponseWithError = SuperTestResponse<{ error: string }>;
export type LoginResponseWithSuccess = SuperTestResponse<{
	accessToken: string;
}>;

export type HTTPError400TestsType<T> = [
	test_description: string,
	property: keyof T,
	obj: Partial<Record<keyof T, T[keyof T]>>,
	errMessage: string
];

export type ExtractResponseBody<T> = T extends ExpressResponse<infer ResBody>
	? ResBody
	: never;

export const randomUserId = async (testEmails: string[], email?: string) => {
	const userEmails = email
		? testEmails.filter((testEmail) => testEmail !== email)
		: testEmails;

	return convertToUUID(
		await getTestUserId(faker.helpers.arrayElement(userEmails))
	);
};

export const getTestUserId = async (email: string) => {
	const result = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email));
	return convertToSUUID(result[0]?.id ?? '');
};

export const samplePassword = 'Password123!';
export const sampleEmail = 'test@email.com';

export const sampleSUUID = '73WakrfVbNJBaAmhQtEeDv' as SUUID;

export const testUser = {
	firstName: 'John',
	lastName: 'Doe',
	email: sampleEmail,
	password: await hash(samplePassword),
};

export const createTestUser = (): UserType => ({
	firstName: testUser.firstName,
	lastName: faker.person.lastName(),
	phone: faker.phone.number(),
	gender: faker.helpers.arrayElement(userGenderEnum.enumValues),
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	birthday: faker.date.birthdate().toISOString().split('T')[0]!,
	email: testUser.email,
	password: testUser.password,
	bio: faker.person.bio(),
	currentCity: faker.location.city(),
	hometown: faker.location.city(),
	profilePic: faker.image.urlPicsumPhotos(),
	coverPic: faker.image.urlPicsumPhotos(),
});

export const createTestCollege = (): CollegeType & { userId: string } => ({
	userId: '',
	type: faker.helpers.arrayElement(collegeTypeEnum.enumValues),
	name: faker.company.name(),
	startYear: faker.date.past().getFullYear(),
	endYear: faker.date.future().getFullYear(),
	description: faker.company.catchPhrase(),
	degree: faker.lorem.words(3),
	major1: faker.lorem.words(3),
	major2: faker.lorem.words(3),
	major3: faker.lorem.words(3),
});

export const createTestWork = (): WorkType & { userId: string } => ({
	userId: '',
	company: faker.company.name(),
	startYear: faker.date.past().getFullYear(),
	endYear: faker.date.future().getFullYear(),
	description: faker.company.catchPhrase(),
	position: faker.person.jobTitle(),
	city: faker.location.city(),
	workingNow: faker.datatype.boolean(),
});

export const createTestHighSchool = (): HighschoolType & {
	userId: string;
} => ({
	userId: '',
	name: faker.company.name(),
	startYear: faker.date.past().getFullYear(),
	endYear: faker.date.future().getFullYear(),
	description: faker.company.catchPhrase(),
	graduated: faker.datatype.boolean(),
});

export const createTestFile = (fieldName: 'coverPic' | 'profilePic') => ({
	originalname: fieldName.split('I')[0] ?? '',
	fieldname: fieldName,
	mimetype: 'image/png',
	size: 0.8 * 1024 * 1024,
	destination: `/server/src/assets/${fieldName}`,
	path: `/server/public/${fieldName}/mockFilename`,
	encoding: 'deprecated',
	stream: 'mockStream' as unknown as Readable,
	buffer: 'mockBuffer' as unknown as Buffer,
	filename: 'mockFilename',
});

export const createTestPost = (): PostType & { userId: string } => ({
	userId: '',
	content: faker.word.words({ count: { min: 10, max: 20 } }),
	assets: [faker.image.urlPicsumPhotos()],
});

export const createTestComment = (): Omit<CommentType, 'commentLevel'> & {
	userId: string;
} => ({
	content: faker.word.words({ count: { min: 10, max: 20 } }),
	postId: '' as SUUID,
	parentCommentId: null,
	userId: '',
});

export const createTestReply = (data: {
	commentLevel: number;
}): CommentType & { userId: string } => ({
	content: faker.word.words({ count: { min: 10, max: 20 } }),
	commentLevel: data.commentLevel,
	postId: '' as SUUID,
	parentCommentId: '' as SUUID,
	userId: '',
});

export const createTestLike = (): LikeType & { userId: string } => ({
	type: faker.helpers.arrayElement(likeTypesEnum.enumValues),
	postId: faker.datatype.boolean() ? sampleSUUID : null,
	commentId: faker.datatype.boolean() ? sampleSUUID : null,
	userId: '',
});
