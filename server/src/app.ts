import express from 'express';
import helmet from 'helmet';
import env from './env';

const app = express();

app.use(helmet());
app.use(express.json());

// Routes

app.listen(env.PORT, () => {
	console.info(`Server is running at port ${env.PORT}`);
});
