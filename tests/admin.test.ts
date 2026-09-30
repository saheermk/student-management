import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users } from '../src/worker/db/schema';
import { eq } from 'drizzle-orm';

describe('Admin User Management', () => {
  let d1: any;
  let db: any;
  let adminSessionToken: string;
  let adminUserId: number;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('AdminPass123');
    const now = new Date().toISOString();

    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'superadmin@school.com',
        passwordHash: passHash,
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    adminUserId = adminUser.id;
    const session = await createSession(db, adminUser.id);
    adminSessionToken = session.token;
  });

  it('Admin can list users and create new user', async () => {
    // List users
    const listRes = await app.request(
      '/api/admin/users',
      {
        headers: { Cookie: `session_token=${adminSessionToken}` },
      },
      { DB: d1 } as any
    );

    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as any;
    expect(listJson.users.length).toBe(1);

    // Create user
    const createRes = await app.request(
      '/api/admin/users',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({
          email: 'newteacher@school.com',
          role: 'teacher',
        }),
      },
      { DB: d1 } as any
    );

    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as any;
    expect(createJson.user.email).toBe('newteacher@school.com');
    expect(createJson.user.role).toBe('teacher');
    expect(createJson.user.mustChangePassword).toBe(true);
    expect(typeof createJson.temporaryPassword).toBe('string');
  });

  it('Admin can deactivate user and invalidates active session', async () => {
    const passHash = await hashPassword('Pass123');
    const now = new Date().toISOString();

    const [targetUser] = await db
      .insert(users)
      .values({
        email: 'targetteacher@school.com',
        passwordHash: passHash,
        role: 'teacher',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Target logs in and gets session
    const userSession = await createSession(db, targetUser.id);

    // Deactivate user
    const statusRes = await app.request(
      `/api/admin/users/${targetUser.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ isActive: false }),
      },
      { DB: d1 } as any
    );

    expect(statusRes.status).toBe(200);

    // Target attempts to access /api/auth/me with previous session token
    const meRes = await app.request(
      '/api/auth/me',
      {
        headers: { Cookie: `session_token=${userSession.token}` },
      },
      { DB: d1 } as any
    );

    expect(meRes.status).toBe(401);
  });

  it('Admin can reset a user password', async () => {
    const passHash = await hashPassword('OldPass123');
    const now = new Date().toISOString();

    const [targetUser] = await db
      .insert(users)
      .values({
        email: 'studenttoreset@school.com',
        passwordHash: passHash,
        role: 'student',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const resetRes = await app.request(
      `/api/admin/users/${targetUser.id}/reset-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ temporaryPassword: 'NewTempPassword123' }),
      },
      { DB: d1 } as any
    );

    expect(resetRes.status).toBe(200);
    const resetJson = (await resetRes.json()) as any;
    expect(resetJson.temporaryPassword).toBe('NewTempPassword123');

    // Verify user mustChangePassword set to true
    const updatedUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUser.id));

    expect(updatedUsers[0].mustChangePassword).toBe(true);
  });
});
