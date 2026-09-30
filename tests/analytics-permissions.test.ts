import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, teachers, students, academicYears, classes, classTeachers } from '../src/worker/db/schema';

describe('Analytics & Performance Visualizations Permission Tests', () => {
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
    student2Token = (await createSession(db, s2User.id)).token;

    const [s2] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'ADM-102', name: 'Student Two', classId: class2Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;
  });

  it('Denies unauthenticated requests to analytics endpoints (401)', async () => {
    const res = await app.request(`/api/analytics/class/${class1Id}`, {}, { DB: d1 } as any);
    expect(res.status).toBe(401);
  });

  it('Admin can access class analytics for any class (200)', async () => {
    const res1 = await app.request(`/api/analytics/class/${class1Id}`, { headers: { Cookie: `session_token=${adminToken}` } }, { DB: d1 } as any);
    expect(res1.status).toBe(200);

    const res2 = await app.request(`/api/analytics/class/${class2Id}`, { headers: { Cookie: `session_token=${adminToken}` } }, { DB: d1 } as any);
    expect(res2.status).toBe(200);
  });

  it('Teacher can access class analytics for assigned class (200)', async () => {
    const res = await app.request(`/api/analytics/class/${class1Id}`, { headers: { Cookie: `session_token=${teacherToken}` } }, { DB: d1 } as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.classId).toBe(class1Id);
  });

  it('Teacher CANNOT access class analytics for unassigned class (403)', async () => {
    const res = await app.request(`/api/analytics/class/${class2Id}`, { headers: { Cookie: `session_token=${teacherToken}` } }, { DB: d1 } as any);
    expect(res.status).toBe(403);
  });

  it('Student CANNOT access class analytics (403)', async () => {
    const res = await app.request(`/api/analytics/class/${class1Id}`, { headers: { Cookie: `session_token=${student1Token}` } }, { DB: d1 } as any);
    expect(res.status).toBe(403);
  });

  it('Admin can access student analytics for any student (200)', async () => {
    const res = await app.request(`/api/analytics/student/${student1Id}`, { headers: { Cookie: `session_token=${adminToken}` } }, { DB: d1 } as any);
    expect(res.status).toBe(200);
  });

  it('Teacher can access student analytics for student in assigned class (200)', async () => {
    const res = await app.request(`/api/analytics/student/${student1Id}`, { headers: { Cookie: `session_token=${teacherToken}` } }, { DB: d1 } as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.studentId).toBe(student1Id);
  });

  it('Teacher CANNOT access student analytics for student in unassigned class (403)', async () => {
    const res = await app.request(`/api/analytics/student/${student2Id}`, { headers: { Cookie: `session_token=${teacherToken}` } }, { DB: d1 } as any);
    expect(res.status).toBe(403);
  });

  it('Student can access their own student analytics (200)', async () => {
    const res = await app.request(`/api/analytics/student/${student1Id}`, { headers: { Cookie: `session_token=${student1Token}` } }, { DB: d1 } as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.studentId).toBe(student1Id);
  });

  it('Student CANNOT access another student analytics (403)', async () => {
    const res = await app.request(`/api/analytics/student/${student2Id}`, { headers: { Cookie: `session_token=${student1Token}` } }, { DB: d1 } as any);
    expect(res.status).toBe(403);
  });
});
