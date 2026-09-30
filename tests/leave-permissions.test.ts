import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, teachers, students, academicYears, classes, classTeachers } from '../src/worker/db/schema';

describe('Leave Register Permission Tests (FR-L1 to FR-L4)', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
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

    // 1. Create Admin
    const [adminUser] = await db
      .insert(users)
      .values({ email: 'admin@school.com', passwordHash: passHash, role: 'admin', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    adminToken = (await createSession(db, adminUser.id)).token;

    // 2. Create Teacher 1 (assigned to Class 1)
    const [t1User] = await db
      .insert(users)
      .values({ email: 'teacher1@school.com', passwordHash: passHash, role: 'teacher', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    teacher1Token = (await createSession(db, t1User.id)).token;

    const [t1Profile] = await db
      .insert(teachers)
      .values({ userId: t1User.id, name: 'Teacher One', phone: '1111111111', createdAt: now, updatedAt: now })
      .returning();

    // 3. Create Teacher 2 (assigned to Class 2)
    const [t2User] = await db
      .insert(users)
      .values({ email: 'teacher2@school.com', passwordHash: passHash, role: 'teacher', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    teacher2Token = (await createSession(db, t2User.id)).token;

    const [t2Profile] = await db
      .insert(teachers)
      .values({ userId: t2User.id, name: 'Teacher Two', phone: '2222222222', createdAt: now, updatedAt: now })
      .returning();

    // 4. Create Academic Year and Classes
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

    await db.insert(classTeachers).values({ classId: class1Id, teacherId: t1Profile.id, createdAt: now, updatedAt: now });
    await db.insert(classTeachers).values({ classId: class2Id, teacherId: t2Profile.id, createdAt: now, updatedAt: now });

    // 5. Create Students
    const [s1User] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    student1Token = (await createSession(db, s1User.id)).token;

    const [s1Profile] = await db
      .insert(students)
      .values({ userId: s1User.id, admissionNo: 'STU001', name: 'Student One', classId: class1Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = s1Profile.id;

    const [s2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    student2Token = (await createSession(db, s2User.id)).token;

    const [s2Profile] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'STU002', name: 'Student Two', classId: class2Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2Profile.id;
  });

  describe('Student Access Scoping', () => {
    it('allows student to request leave for self', async () => {
      const res = await app.request('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${student1Token}`,
        },
        body: JSON.stringify({
          fromDate: '2025-10-10',
          toDate: '2025-10-12',
          reason: 'Family function',
        }),
      }, { DB: d1 });

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.leave.studentId).toBe(student1Id);
      expect(data.leave.status).toBe('pending');
    });

    it('denies student from accessing direct leave route', async () => {
      const res = await app.request('/api/leaves/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${student1Token}`,
        },
        body: JSON.stringify({
          studentId: student1Id,
          fromDate: '2025-10-10',
          toDate: '2025-10-12',
          reason: 'Direct leave attempt',
        }),
      }, { DB: d1 });

      expect(res.status).toBe(403);
    });

    it('denies student from viewing another student leave list', async () => {
      const res = await app.request(`/api/leaves?studentId=${student2Id}`, {
        headers: { Cookie: `session_token=${student1Token}` },
      }, { DB: d1 });

      expect(res.status).toBe(403);
    });

    it('denies student from reviewing leave requests', async () => {
      const res = await app.request('/api/leaves/1/review', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${student1Token}`,
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      }, { DB: d1 });

      expect(res.status).toBe(403);
    });
  });

  describe('Teacher Class Scoping', () => {
    it('allows Teacher 1 to add direct leave for student in assigned Class 1', async () => {
      const res = await app.request('/api/leaves/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacher1Token}`,
        },
        body: JSON.stringify({
          studentId: student1Id,
          fromDate: '2025-10-01',
          toDate: '2025-10-02',
          reason: 'Fever',
        }),
      }, { DB: d1 });

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.leave.status).toBe('approved');
    });

    it('denies Teacher 1 from adding direct leave for student in unassigned Class 2', async () => {
      const res = await app.request('/api/leaves/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacher1Token}`,
        },
        body: JSON.stringify({
          studentId: student2Id,
          fromDate: '2025-10-01',
          toDate: '2025-10-02',
          reason: 'Fever',
        }),
      }, { DB: d1 });

      expect(res.status).toBe(403);
    });

    it('denies Teacher 1 from reviewing leave for student in unassigned Class 2', async () => {
      // Student 2 creates request
      const reqRes = await app.request('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${student2Token}`,
        },
        body: JSON.stringify({
          fromDate: '2025-10-15',
          toDate: '2025-10-16',
          reason: 'Medical appointment',
        }),
      }, { DB: d1 });
      const reqData = (await reqRes.json()) as any;


      // Teacher 1 tries to review
      const reviewRes = await app.request(`/api/leaves/${reqData.leave.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacher1Token}`,
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      }, { DB: d1 });

      expect(reviewRes.status).toBe(403);
    });
  });

  describe('Admin Full Access', () => {
    it('allows admin to direct-create leave for any student', async () => {
      const res = await app.request('/api/leaves/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          studentId: student2Id,
          fromDate: '2025-10-20',
          toDate: '2025-10-21',
          reason: 'Sports meet',
        }),
      }, { DB: d1 });

      expect(res.status).toBe(201);
    });
  });
});
