import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, teachers, students, academicYears, classes, classTeachers } from '../src/worker/db/schema';

describe('Attendance Permission & Scope Tests', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;
  let student1Token: string;
  let student2Token: string;

  let class1Id: number;
  let class2Id: number;
  let student1Id: number;
  let student2Id: number;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('Password123!');
    const now = new Date().toISOString();

    // 1. Create Admin User
    const [adminUser] = await db
      .insert(users)
      .values({ email: 'admin@school.com', passwordHash: passHash, role: 'admin', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    adminToken = (await createSession(db, adminUser.id)).token;

    // 2. Create Teacher User & Profile
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
    const [student1User] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    student1Token = (await createSession(db, student1User.id)).token;

    const [s1] = await db
      .insert(students)
      .values({ userId: student1User.id, admissionNo: 'ADM-001', name: 'Student One', classId: class1Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = s1.id;

    // 6. Create Student 2 (in Class 10B)
    const [student2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    student2Token = (await createSession(db, student2User.id)).token;

    const [s2] = await db
      .insert(students)
      .values({ userId: student2User.id, admissionNo: 'ADM-002', name: 'Student Two', classId: class2Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;
  });

  it('Denies unauthenticated requests to attendance endpoints (401)', async () => {
    const res = await app.request('/api/attendance?classId=' + class1Id, {}, { DB: d1 } as any);
    expect(res.status).toBe(401);
  });

  it('Teacher can mark attendance for assigned class (200)', async () => {
    const res = await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId: class1Id,
          date: '2026-09-20',
          records: [{ studentId: student1Id, status: 'present' }],
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
  });

  it('Teacher CANNOT mark attendance for unassigned class (403)', async () => {
    const res = await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId: class2Id, // Teacher is NOT assigned to Class 10B
          date: '2026-09-20',
          records: [{ studentId: student2Id, status: 'present' }],
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
    const json = (await res.json()) as any;
    expect(json.error).toContain('assigned');
  });

  it('Student CANNOT mark attendance (403)', async () => {
    const res = await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${student1Token}`,
        },
        body: JSON.stringify({
          classId: class1Id,
          date: '2026-09-20',
          records: [{ studentId: student1Id, status: 'present' }],
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });

  it('Student can read their own attendance history (200)', async () => {
    const res = await app.request(
      '/api/attendance/me',
      {
        headers: { Cookie: `session_token=${student1Token}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
  });

  it('Student CANNOT access another student attendance summary (403)', async () => {
    const res = await app.request(
      `/api/attendance/summary/student/${student2Id}`,
      {
        headers: { Cookie: `session_token=${student1Token}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });
});
