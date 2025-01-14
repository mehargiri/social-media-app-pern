declare namespace Express {
	export interface Request {
		userId: string; // userId is actually of type SUUID when extracted from auth header
	}
}
