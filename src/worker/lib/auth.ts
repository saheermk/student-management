import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gt, count } from 'drizzle-orm';
import { Context } from 'hono';
import { users, sessions, loginAttempts } from '../db/schema';
import { generateRandomToken, hashToken } from './crypto';
import { UserDTO } from '../../shared/types';

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(
  db: ReturnType<typeof drizzle>,
  userId: number
): Promise<{ token: string; expiresAt: string }> {
  const token = generateRandomToken(32);
  const tokenHash = await hashToken(token);
  const sessionId = generateRandomToken(16);
  const expiresAtDate = new Date(Date.now() + SESSION_DURATION_MS);
  const expiresAt = expiresAtDate.toISOString();
  const createdAt = new Date().toISOString();

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash,
    expiresAt,
    createdAt,
  });

  return { token, expiresAt };
}

export async function validateSessionToken(
  db: ReturnType<typeof drizzle>,
  token: string
): Promise<{ user: UserDTO; session: typeof sessions.$inferSelect } | null> {
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();

  const results = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));

  if (results.length === 0) {
    return null;
  }

  const { session, user } = results[0];

  if (!user.isActive) {
    // Revoke session if user has been deactivated
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  const userDTO: UserDTO = {
    id: user.id,
    email: user.email,
    role: user.role as any,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return { user: userDTO, session };
}

export async function invalidateSession(
  db: ReturnType<typeof drizzle>,
  token: string
): Promise<void> {
  const tokenHash = await hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function invalidateUserSessions(
  db: ReturnType<typeof drizzle>,
  userId: number
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionCookie(c: Context, token: string): void {
  const isSecure = c.req.url.startsWith('https://');
  const cookieValue = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${
    isSecure ? '; Secure' : ''
  }`;
  c.header('Set-Cookie', cookieValue, { append: true });
}

export function clearSessionCookie(c: Context): void {
  const isSecure = c.req.url.startsWith('https://');
  const cookieValue = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
    isSecure ? '; Secure' : ''
  }`;
  c.header('Set-Cookie', cookieValue, { append: true });
}

export function getSessionTokenFromRequest(c: Context): string | null {
  // Check cookie
  const cookieHeader = c.req.header('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    if (cookies[SESSION_COOKIE_NAME]) {
      return cookies[SESSION_COOKIE_NAME];
    }
  }

  // Check Authorization header (Bearer token)
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export async function checkRateLimit(
  db: ReturnType<typeof drizzle>,
  identifier: string,
  maxAttempts = 5,
  windowMinutes = 15
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const result = await db
    .select({ total: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.identifier, identifier),
        eq(loginAttempts.success, false),
        gt(loginAttempts.attemptedAt, windowStart)
      )
    );

  const failedCount = result[0]?.total ?? 0;
  return failedCount < maxAttempts;
}

export async function recordLoginAttempt(
  db: ReturnType<typeof drizzle>,
  identifier: string,
  success: boolean
): Promise<void> {
  await db.insert(loginAttempts).values({
    identifier,
    attemptedAt: new Date().toISOString(),
    success,
  });
}
