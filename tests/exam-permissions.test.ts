import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, teachers, students, academicYears, classes, classTeachers } from '../src/worker/db/schema';

describe('Exams & Progress Card Permission Tests', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;
  let student1Token: string;

  let class1Id: number;
  let class2Id: number;
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

    // 3. Create Academic Year and 2 Classes
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

    const [c2] = await db
      .insert(classes)
      .values({ name: 'Class 10B', academicYearId: ay.id, createdAt: now, updatedAt: now })
      .returning();
    class2Id = c2.id;

    // 4. Assign Teacher ONLY to Class 10A (class1Id)
    await db.insert(classTeachers).values({ classId: class1Id, teacherId: teacherProfile.id, createdAt: now, updatedAt: now });

    // 5. Create Student 1 (in Class 10A)
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

    // 6. Create Student 2 (in Class 10B)
    const [s2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();

    const [s2] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'ADM-102', name: 'Student Two', classId: class2Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;
  });

  it('Denies unauthenticated requests to exam endpoints (401)', async () => {
    const res = await app.request('/api/exams?classId=' + class1Id, {}, { DB: d1 } as any);
    expect(res.status).toBe(401);
  });

  it('Teacher can create exam for assigned class (201)', async () => {
    const res = await app.request(
      '/api/exams',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId: class1Id,
          type: 'monthly',
          name: 'Monthly Test August',
          examDate: '2026-08-15',
          academicYearId: ayId,
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(201);
  });

  it('Teacher CANNOT create exam for unassigned class (403)', async () => {
    const res = await app.request(
      '/api/exams',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId: class2Id, // Unassigned class
          type: 'monthly',
          name: 'Unauthorized Exam',
          examDate: '2026-08-15',
          academicYearId: ayId,
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });

  it('Student CANNOT create exam or enter marks (403)', async () => {
    const res = await app.request(
      '/api/exams',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${student1Token}`,
        },
        body: JSON.stringify({
          classId: class1Id,
          type: 'monthly',
          name: 'Student Exam',
          examDate: '2026-08-15',
          academicYearId: ayId,
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });

  it('Student can view their own progress card (200)', async () => {
    const res = await app.request(
      '/api/exams/progress-card/me',
      {
        headers: { Cookie: `session_token=${student1Token}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
  });

  it('Student CANNOT view another student progress card (403)', async () => {
    const res = await app.request(
      `/api/exams/progress-card/student/${student2Id}`,
      {
        headers: { Cookie: `session_token=${student1Token}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });
});
