import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { count } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { users } from '../db/schema';
import { hashPassword } from '../lib/crypto';

const seedRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

seedRouter.post('/admin', async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select({ total: count() }).from(users);
  const totalUsers = result[0]?.total ?? 0;

  if (totalUsers > 0) {
    return c.json({ error: 'Database is already initialized' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || 'admin@school.com').toLowerCase();
  const password = body.password || 'Admin@12345';

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const [adminUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
    });

  return c.json(
    {
      message: 'Admin account initialized successfully',
      user: adminUser,
      initialPassword: password,
    },
    201
  );
});

export default seedRouter;
