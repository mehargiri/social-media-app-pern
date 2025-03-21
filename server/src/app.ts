import authRoutes from '@/features/auth/auth.routes.js';
import collegeRoutes from '@/features/college/college.routes.js';
import commentRoutes from '@/features/comment/comment.routes.js';
import replyRoutes from '@/features/comment/reply.routes.js';
import highschoolRoutes from '@/features/highschool/highschool.routes.js';
import postRoutes from '@/features/post/post.routes.js';
import userRoutes from '@/features/user/user.routes.js';
import workRoutes from '@/features/work/work.routes.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './db/index.js';
import errorHandler from './middlewares/errorHandler.middlewares.js';

const app = express();

await connectDB();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('tiny'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/highschool', highschoolRoutes);
app.use('/api/college', collegeRoutes);
app.use('/api/work', workRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/replies', replyRoutes);

app.use(errorHandler);

export default app;
