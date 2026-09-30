import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { users } from '../db/schema';
import {
  createUserSchema,
  updateUserStatusSchema,
  adminResetPasswordSchema,
} from '../../shared/schemas';
import { hashPassword, generateRandomToken } from '../lib/crypto';
import { invalidateUserSessions } from '../lib/auth';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const adminRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All admin routes require authentication and admin role
adminRouter.use('*', authMiddleware, requireRole('admin'));

// List all users
adminRouter.get('/users', async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return c.json({ users: result });
});

// Create new user
adminRouter.post('/users', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createUserSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { email, role, password, mustChangePassword } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (existing.length > 0) {
    return c.json({ error: 'User with this email address already exists' }, 409);
  }

  const generatedTempPassword = password || `Temp${generateRandomToken(4)}!`;
  const passwordHash = await hashPassword(generatedTempPassword);
  const now = new Date().toISOString();

  const [inserted] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: mustChangePassword ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return c.json(
    {
      user: inserted,
      temporaryPassword: password ? undefined : generatedTempPassword,
      message: 'User created successfully',
    },
    201
  );
});

// Activate or Deactivate user
adminRouter.patch('/users/:id/status', async (c) => {
  const userIdParam = c.req.param('id');
  const userId = parseInt(userIdParam, 10);
  if (isNaN(userId)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  const currentUser = c.get('user');
  if (currentUser.id === userId) {
    return c.json({ error: 'Admin cannot change their own account status' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateUserStatusSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { isActive } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const [updated] = await db
    .update(users)
    .set({
      isActive,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updated) {
    return c.json({ error: 'User not found' }, 404);
  }

  // If user was deactivated, revoke all active sessions
  if (!isActive) {
    await invalidateUserSessions(db, userId);
  }

  return c.json({
    user: updated,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
  });
});

// Admin reset user password
adminRouter.post('/users/:id/reset-password', async (c) => {
  const userIdParam = c.req.param('id');
  const userId = parseInt(userIdParam, 10);
  if (isNaN(userId)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = adminResetPasswordSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const temporaryPassword = parseResult.data.temporaryPassword || `Temp${generateRandomToken(4)}!`;
  const passwordHash = await hashPassword(temporaryPassword);
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const [updated] = await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
    });

  if (!updated) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Revoke active sessions for security
  await invalidateUserSessions(db, userId);

  return c.json({
    message: 'User password reset successfully',
    temporaryPassword,
  });
});

export default adminRouter;
