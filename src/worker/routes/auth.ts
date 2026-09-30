import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gt } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { users, passwordResetTokens } from '../db/schema';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../shared/schemas';
import {
  createSession,
  invalidateSession,
  invalidateUserSessions,
  setSessionCookie,
  clearSessionCookie,
  getSessionTokenFromRequest,
  checkRateLimit,
  recordLoginAttempt,
} from '../lib/auth';
import { hashPassword, verifyPassword, generateRandomToken, hashToken } from '../lib/crypto';
import { sendPasswordResetEmail } from '../lib/email';
import { authMiddleware } from '../middleware/auth';

const authRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Login
authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = loginSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { email, password } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Check rate limiting
  const isAllowed = await checkRateLimit(db, email.toLowerCase());
  if (!isAllowed) {
    return c.json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' }, 429);
  }

  // Find user
  const userResults = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (userResults.length === 0) {
    await recordLoginAttempt(db, email.toLowerCase(), false);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const user = userResults[0];

  if (!user.isActive) {
    await recordLoginAttempt(db, email.toLowerCase(), false);
    return c.json({ error: 'Account is deactivated. Please contact an administrator.' }, 401);
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    await recordLoginAttempt(db, email.toLowerCase(), false);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Record successful login
  await recordLoginAttempt(db, email.toLowerCase(), true);

  // Create session
  const session = await createSession(db, user.id);
  setSessionCookie(c, session.token);

  const userDTO = {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return c.json({
    user: userDTO,
    token: session.token,
    message: 'Logged in successfully',
  });
});

// Logout
authRouter.post('/logout', async (c) => {
  const token = getSessionTokenFromRequest(c);
  if (token) {
    const db = drizzle(c.env.DB);
    await invalidateSession(db, token);
  }
  clearSessionCookie(c);
  return c.json({ message: 'Logged out successfully' });
});

// Get current logged in user profile
authRouter.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ user });
});

// Forgot password
authRouter.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = forgotPasswordSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { email } = parseResult.data;
  const db = drizzle(c.env.DB);

  const userResults = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (userResults.length > 0 && userResults[0].isActive) {
    const user = userResults[0];
    const resetToken = generateRandomToken(32);
    const tokenHash = await hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });

    const origin = new URL(c.req.url).origin;
    await sendPasswordResetEmail(user.email, resetToken, origin, c.env.RESEND_API_KEY);
  }

  return c.json({
    message: 'If that email address exists in our system, we have sent a password reset link.',
  });
});

// Reset password with token
authRouter.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = resetPasswordSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { token, newPassword } = parseResult.data;
  const db = drizzle(c.env.DB);
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();

  const tokenResults = await db
    .select({
      tokenRecord: passwordResetTokens,
      user: users,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        eq(passwordResetTokens.used, false),
        gt(passwordResetTokens.expiresAt, now)
      )
    );

  if (tokenResults.length === 0) {
    return c.json({ error: 'Invalid or expired password reset token' }, 400);
  }

  const { tokenRecord, user } = tokenResults[0];
  const newPasswordHash = await hashPassword(newPassword);
  const updatedAt = new Date().toISOString();

  // Update password & clear mustChangePassword
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      updatedAt,
    })
    .where(eq(users.id, user.id));

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.id, tokenRecord.id));

  // Invalidate all active sessions for security
  await invalidateUserSessions(db, user.id);

  return c.json({ message: 'Password reset successfully. Please log in with your new password.' });
});

// Change password (logged-in user)
authRouter.post('/change-password', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = changePasswordSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { currentPassword, newPassword } = parseResult.data;
  const currentUser = c.get('user');
  const db = drizzle(c.env.DB);

  const userResults = await db
    .select()
    .from(users)
    .where(eq(users.id, currentUser.id));

  if (userResults.length === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user = userResults[0];
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return c.json({ error: 'Current password is incorrect' }, 400);
  }

  const newHash = await hashPassword(newPassword);
  const updatedAt = new Date().toISOString();

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt,
    })
    .where(eq(users.id, user.id));

  return c.json({ message: 'Password changed successfully' });
});

export default authRouter;
