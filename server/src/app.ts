import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import env from './env.js';
import errorHandler from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
	console.info(`Server is running at port ${env.PORT}`);
});
