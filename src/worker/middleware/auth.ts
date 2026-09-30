import { MiddlewareHandler } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { Env, Variables } from '../types';
import { getSessionTokenFromRequest, validateSessionToken } from '../lib/auth';

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next
) => {
  const token = getSessionTokenFromRequest(c);
  if (!token) {
    return c.json({ error: 'Unauthorized: missing session token' }, 401);
  }

  const db = drizzle(c.env.DB);
  const authData = await validateSessionToken(db, token);

  if (!authData) {
    return c.json({ error: 'Unauthorized: invalid or expired session' }, 401);
  }

  c.set('user', authData.user);
  c.set('sessionToken', token);

  await next();
};
