import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users } from '../src/worker/db/schema';

describe('Institution Settings API Tests', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('Password123!');
    const now = new Date().toISOString();

    // 1. Create Admin
    const [adminUser] = await db
      .insert(users)
      .values({ email: 'admin@school.com', passwordHash: passHash, role: 'admin', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    adminToken = (await createSession(db, adminUser.id)).token;

    // 2. Create Teacher
    const [teacherUser] = await db
      .insert(users)
      .values({ email: 'teacher@school.com', passwordHash: passHash, role: 'teacher', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    teacherToken = (await createSession(db, teacherUser.id)).token;

    // 3. Create Student
    const [studentUser] = await db
      .insert(users)
      .values({ email: 'student@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    studentToken = (await createSession(db, studentUser.id)).token;
  });

  it('GET /api/settings returns default settings for any authenticated user', async () => {
    const res = await app.request(
      '/api/settings',
      { headers: { Cookie: `session_token=${studentToken}` } },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.institutionName).toBe('Student Management System');
  });

  it('PUT /api/settings allows admin to update settings (200)', async () => {
    const res = await app.request(
      '/api/settings',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          institutionName: 'Al-Huda Academy',
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.message).toBe('Institution settings updated successfully');
    expect(data.settings.institutionName).toBe('Al-Huda Academy');

    // Verify GET /api/settings reflects the change
    const getRes = await app.request(
      '/api/settings',
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    const getData: any = await getRes.json();
    expect(getData.institutionName).toBe('Al-Huda Academy');
  });

  it('PUT /api/settings denies non-admin users (403)', async () => {
    const teacherRes = await app.request(
      '/api/settings',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({ institutionName: 'Hacked Name' }),
      },
      { DB: d1 } as any
    );
    expect(teacherRes.status).toBe(403);

    const studentRes = await app.request(
      '/api/settings',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${studentToken}`,
        },
        body: JSON.stringify({ institutionName: 'Hacked Name' }),
      },
      { DB: d1 } as any
    );
    expect(studentRes.status).toBe(403);
  });

  it('POST /api/settings/logo uploads logo to R2 and updates setting (Admin only)', async () => {
    const dummyBucket = {
      put: async (key: string, body: any, options: any) => {
        expect(key).toContain('institution/logo-');
        expect(options.httpMetadata.contentType).toBe('image/png');
        return {};
      },
    };

    const formData = new FormData();
    const file = new File(['fake-png-content'], 'logo.png', { type: 'image/png' });
    formData.append('logo', file);

    const res = await app.request(
      '/api/settings/logo',
      {
        method: 'POST',
        headers: { Cookie: `session_token=${adminToken}` },
        body: formData,
      },
      { DB: d1, BUCKET: dummyBucket } as any
    );

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.message).toBe('Institution logo uploaded successfully');
    expect(data.logoUrl).toContain('/api/settings/logo/file');
  });
});
