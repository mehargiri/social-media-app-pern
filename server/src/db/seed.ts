import * as schema from '@/db/schema/index.js';
import { seed } from 'drizzle-seed';
import { connection, db } from './index.js';

await seed(db, { users: schema.user }).refine((f) => ({
	users: {
		count: 5,
		columns: {
			firstName: f.firstName(),
			phone: f.phoneNumber({ template: '###-###-###' }),
			bio: f.loremIpsum({ sentencesCount: 2 }),
			currentCity: f.city(),
			hometown: f.city(),
		},
	},
}));

await connection.end();
