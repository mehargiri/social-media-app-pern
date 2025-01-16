import { db } from '@/db/index.js';
import { collegeTypeEnum } from '@/db/schema/college.js';
import { user, userGenderEnum } from '@/db/schema/user.js';
import { faker } from '@faker-js/faker';
import { hash } from 'argon2';
import { eq } from 'drizzle-orm';
import { SUUID } from 'short-uuid';
import type { Readable } from 'stream';
import type { Response } from 'supertest';
import { convertToSUUID, convertToUUID } from './general.utils.js';

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

export const createTestUser = () => ({
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
});

export const createTestCollege = () => ({
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

export const createTestWork = () => ({
	userId: '',
	company: faker.company.name(),
	startYear: faker.date.past().getFullYear(),
	endYear: faker.date.future().getFullYear(),
	description: faker.company.catchPhrase(),
	position: faker.person.jobTitle(),
	city: faker.location.city(),
	workingNow: faker.datatype.boolean(),
});

export const createTestHighSchool = () => ({
	userId: '',
	name: faker.company.name(),
	startYear: faker.date.past().getFullYear(),
	endYear: faker.date.future().getFullYear(),
	description: faker.company.catchPhrase(),
	graduated: faker.datatype.boolean(),
});

export const createTestFile = (fieldName: 'coverImage' | 'profileImage') => ({
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

export type SuperTestResponse<T> = Omit<Response, 'body'> & { body: T };
export type ResponseWithError = SuperTestResponse<{ error: string }>;
export type LoginResponseWithSuccess = SuperTestResponse<{
	accessToken: string;
}>;
