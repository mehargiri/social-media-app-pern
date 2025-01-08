import app from './app.js';
import env from './env.js';

app.listen(env.PORT, () => {
	console.info(`Server is running at port ${env.PORT}`);
});
