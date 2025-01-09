import authRoutes from '@/features/auth/auth.routes.js';
import userRoutes from '@/features/user/user.routes.js';
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

app.use(errorHandler);

export default app;
