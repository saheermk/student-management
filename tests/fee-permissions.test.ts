import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, teachers, students, academicYears, classes, classTeachers } from '../src/worker/db/schema';

describe('Fee Register Permission Tests (FR-F6, FR-F7)', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;
  let student1Token: string;

  let class1Id: number;
  let student1Id: number;
  let student2Id: number;
  let ayId: number;

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

    const [teacherProfile] = await db
      .insert(teachers)
      .values({ userId: teacherUser.id, name: 'Staff Teacher', phone: '1234567890', createdAt: now, updatedAt: now })
      .returning();

    // 3. Create Academic Year and Class
    const [ay] = await db
      .insert(academicYears)
      .values({ name: '2025-2026', isCurrent: true, createdAt: now, updatedAt: now })
      .returning();
    ayId = ay.id;

    const [c1] = await db
      .insert(classes)
      .values({ name: 'Class 10A', academicYearId: ay.id, createdAt: now, updatedAt: now })
      .returning();
    class1Id = c1.id;

    await db.insert(classTeachers).values({ classId: class1Id, teacherId: teacherProfile.id, createdAt: now, updatedAt: now });

    // 4. Create Student 1 & Student 2
    const [s1User] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    student1Token = (await createSession(db, s1User.id)).token;

    const [s1] = await db
      .insert(students)
      .values({ userId: s1User.id, admissionNo: 'ADM-101', name: 'Student One', classId: class1Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = s1.id;

    const [s2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();

    const [s2] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'ADM-102', name: 'Student Two', classId: class1Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;
  });

  it('Denies unauthenticated requests to fee endpoints (401)', async () => {
    const res = await app.request('/api/fees', {}, { DB: d1 } as any);
    expect(res.status).toBe(401);
  });

  it('PROVES TEACHER GETS 403 FORBIDDEN ON ALL READ FEE ENDPOINTS (FR-F7)', async () => {
    // GET /api/fees (dues list)
    const listRes = await app.request(
      '/api/fees',
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    expect(listRes.status).toBe(403);

    // GET /api/fees/student/:studentId
    const studentFeeRes = await app.request(
      `/api/fees/student/${student1Id}`,
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    expect(studentFeeRes.status).toBe(403);

    // GET /api/fees/me
    const meRes = await app.request(
      '/api/fees/me',
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    expect(meRes.status).toBe(403);
  });

  it('PROVES TEACHER GETS 403 FORBIDDEN ON ALL WRITE FEE ENDPOINTS (FR-F7)', async () => {
    // POST /api/fees (Create fee item)
    const createRes = await app.request(
      '/api/fees',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          studentId: student1Id,
          title: 'Term 1 Fee',
          amount: 5000,
          dueDate: '2026-10-01',
          academicYearId: ayId,
        }),
      },
      { DB: d1 } as any
    );
    expect(createRes.status).toBe(403);

    // POST /api/fees/payments (Record payment)
    const paymentRes = await app.request(
      '/api/fees/payments',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          feeItemId: 1,
          studentId: student1Id,
          amountPaid: 2000,
          paymentDate: '2026-09-22',
          receiptNo: 'RCP-001',
        }),
      },
      { DB: d1 } as any
    );
    expect(paymentRes.status).toBe(403);
  });

  it('Student can read their own fee profile (200 - FR-F6)', async () => {
    const res = await app.request(
      '/api/fees/me',
      { headers: { Cookie: `session_token=${student1Token}` } },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.student.id).toBe(student1Id);
    expect(data.totals).toBeDefined();
  });

  it('Student CANNOT view another student fee summary (403 - FR-F6)', async () => {
    const res = await app.request(
      `/api/fees/student/${student2Id}`,
      { headers: { Cookie: `session_token=${student1Token}` } },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });

  it('Student CANNOT create fee items or record payments (403)', async () => {
    const createRes = await app.request(
      '/api/fees',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${student1Token}`,
        },
        body: JSON.stringify({
          studentId: student1Id,
          title: 'Unauthorized Fee',
          amount: 1000,
          dueDate: '2026-10-01',
          academicYearId: ayId,
        }),
      },
      { DB: d1 } as any
    );
    expect(createRes.status).toBe(403);
  });
});
