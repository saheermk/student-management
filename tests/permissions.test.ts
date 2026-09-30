import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users } from '../src/worker/db/schema';

describe('Permissions & Security Middleware', () => {
  let d1: any;
  let db: any;
  let mf: any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;
    mf = testDb.mf;
  });

  it('Denies access to unauthenticated requests on protected routes (401)', async () => {
    const resAdmin = await app.request('/api/admin/users', {}, { DB: d1 } as any);
    expect(resAdmin.status).toBe(401);

    const resMe = await app.request('/api/auth/me', {}, { DB: d1 } as any);
    expect(resMe.status).toBe(401);
  });

  it('Denies access to Student attempting Admin routes (403)', async () => {
    const passHash = await hashPassword('password123');
    const now = new Date().toISOString();

    const [studentUser] = await db
      .insert(users)
      .values({
        email: 'student@school.com',
        passwordHash: passHash,
        role: 'student',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const session = await createSession(db, studentUser.id);

    const res = await app.request(
      '/api/admin/users',
      {
        headers: {
          Cookie: `session_token=${session.token}`,
        },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('Forbidden');
  });

  it('Denies access to Teacher attempting Admin routes (403)', async () => {
    const passHash = await hashPassword('password123');
    const now = new Date().toISOString();

    const [teacherUser] = await db
      .insert(users)
      .values({
        email: 'teacher@school.com',
        passwordHash: passHash,
        role: 'teacher',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const session = await createSession(db, teacherUser.id);

    const res = await app.request(
      '/api/admin/users',
      {
        headers: {
          Cookie: `session_token=${session.token}`,
        },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });

  it('Allows access to Admin for Admin routes (200)', async () => {
    const passHash = await hashPassword('admin12345');
    const now = new Date().toISOString();

    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@school.com',
        passwordHash: passHash,
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const session = await createSession(db, adminUser.id);

    const res = await app.request(
      '/api/admin/users',
      {
        headers: {
          Cookie: `session_token=${session.token}`,
        },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { users: any[] };
    expect(Array.isArray(json.users)).toBe(true);
  });

  it('Revokes access immediately if user is deactivated', async () => {
    const passHash = await hashPassword('password123');
    const now = new Date().toISOString();

    const [teacherUser] = await db
      .insert(users)
      .values({
        email: 'deactivated@school.com',
        passwordHash: passHash,
        role: 'teacher',
        isActive: false, // Deactivated
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const session = await createSession(db, teacherUser.id);

    const res = await app.request(
      '/api/auth/me',
      {
        headers: {
          Cookie: `session_token=${session.token}`,
        },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(401);
  });
});
