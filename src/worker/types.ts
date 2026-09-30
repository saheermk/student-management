import { UserDTO } from '../shared/types';

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT?: string;
  SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  ASSETS?: Fetcher;
}

export interface Variables {
  user: UserDTO;
  sessionToken: string;
}
