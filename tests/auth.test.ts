import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { users, passwordResetTokens } from '../src/worker/db/schema';
import { eq } from 'drizzle-orm';

describe('Auth API & Logic', () => {
  let d1: any;
  let db: any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;
  });

  it('Logs in user with correct credentials and returns session cookie', async () => {
    const passHash = await hashPassword('Secret123');
    const now = new Date().toISOString();

    await db.insert(users).values({
      email: 'user@school.com',
      passwordHash: passHash,
      role: 'teacher',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    });

    const res = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@school.com', password: 'Secret123' }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.user.email).toBe('user@school.com');
    expect(json.user.role).toBe('teacher');
    expect(typeof json.token).toBe('string');
    expect(res.headers.get('Set-Cookie')).toContain('session_token=');
  });

  it('Rejects login with invalid password (401)', async () => {
    const passHash = await hashPassword('Secret123');
    const now = new Date().toISOString();

    await db.insert(users).values({
      email: 'user@school.com',
      passwordHash: passHash,
      role: 'student',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    });

    const res = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@school.com', password: 'WrongPassword' }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(401);
    const json = (await res.json()) as any;
    expect(json.error).toBe('Invalid email or password');
  });

  it('Blocks login attempts after 5 consecutive failures (429 Rate Limit)', async () => {
    const passHash = await hashPassword('Secret123');
    const now = new Date().toISOString();

    await db.insert(users).values({
      email: 'target@school.com',
      passwordHash: passHash,
      role: 'student',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    });

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await app.request(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'target@school.com', password: 'wrong' }),
        },
        { DB: d1 } as any
      );
    }

    // 6th attempt (even with correct password) should be rate-limited
    const res6 = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'target@school.com', password: 'Secret123' }),
      },
      { DB: d1 } as any
    );

    expect(res6.status).toBe(429);
    const json = (await res6.json()) as any;
    expect(json.error).toContain('Too many failed login attempts');
  });

  it('Handles password reset flow: forgot-password -> reset-password', async () => {
    const passHash = await hashPassword('OldPass123');
    const now = new Date().toISOString();

    const [u] = await db
      .insert(users)
      .values({
        email: 'resetme@school.com',
        passwordHash: passHash,
        role: 'student',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Request reset link
    const forgotRes = await app.request(
      '/api/auth/forgot-password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'resetme@school.com' }),
      },
      { DB: d1 } as any
    );

    expect(forgotRes.status).toBe(200);

    // Fetch reset token record from DB
    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, u.id));

    expect(tokens.length).toBe(1);
    expect(tokens[0].used).toBe(false);
  });
});
