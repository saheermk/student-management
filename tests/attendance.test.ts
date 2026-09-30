import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, teachers, students, academicYears, classes, classTeachers, auditLog } from '../src/worker/db/schema';
import { eq } from 'drizzle-orm';

describe('Attendance API & Business Logic', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  let classId: number;
  let student1Id: number;
  let student2Id: number;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('Password123!');
    const now = new Date().toISOString();

    // 1. Setup Admin
    const [adminUser] = await db
      .insert(users)
      .values({ email: 'admin@school.com', passwordHash: passHash, role: 'admin', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    adminToken = (await createSession(db, adminUser.id)).token;

    // 2. Setup Teacher
    const [teacherUser] = await db
      .insert(users)
      .values({ email: 'teacher@school.com', passwordHash: passHash, role: 'teacher', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    teacherToken = (await createSession(db, teacherUser.id)).token;

    const [teacherProfile] = await db
      .insert(teachers)
      .values({ userId: teacherUser.id, name: 'Main Teacher', phone: '1112223333', createdAt: now, updatedAt: now })
      .returning();

    // 3. Setup Class
    const [ay] = await db
      .insert(academicYears)
      .values({ name: '2025-2026', isCurrent: true, createdAt: now, updatedAt: now })
      .returning();

    const [c] = await db
      .insert(classes)
      .values({ name: 'Class 10A', academicYearId: ay.id, createdAt: now, updatedAt: now })
      .returning();
    classId = c.id;

    await db.insert(classTeachers).values({ classId, teacherId: teacherProfile.id, createdAt: now, updatedAt: now });

    // 4. Setup 2 Students in Class 10A
    const [s1User] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    studentToken = (await createSession(db, s1User.id)).token;

    const [s1] = await db
      .insert(students)
      .values({ userId: s1User.id, admissionNo: 'ADM-101', name: 'Alice Smith', classId, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = s1.id;

    const [s2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();

    const [s2] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'ADM-102', name: 'Bob Jones', classId, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;
  });

  it('Teacher can bulk mark attendance for class (default present, absent, late)', async () => {
    const markRes = await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId,
          date: '2026-09-20',
          records: [
            { studentId: student1Id, status: 'present' },
            { studentId: student2Id, status: 'absent' },
          ],
        }),
      },
      { DB: d1 } as any
    );

    expect(markRes.status).toBe(200);
    const markJson = (await markRes.json()) as any;
    expect(markJson.insertedCount).toBe(2);

    // List Attendance Logs for Date
    const getRes = await app.request(
      `/api/attendance?classId=${classId}&date=2026-09-20`,
      {
        headers: { Cookie: `session_token=${teacherToken}` },
      },
      { DB: d1 } as any
    );

    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as any;
    expect(getJson.attendance.length).toBe(2);
  });

  it('Editing past attendance updates record and creates audit log entry (FR-AT2)', async () => {
    // 1. Initial Mark
    await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId,
          date: '2026-09-15',
          records: [{ studentId: student1Id, status: 'present' }],
        }),
      },
      { DB: d1 } as any
    );

    // 2. Edit status from present to absent
    const editRes = await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId,
          date: '2026-09-15',
          records: [{ studentId: student1Id, status: 'absent' }],
        }),
      },
      { DB: d1 } as any
    );

    expect(editRes.status).toBe(200);
    const editJson = (await editRes.json()) as any;
    expect(editJson.updatedCount).toBe(1);

    // 3. Verify audit log entry
    const auditEntries = await db.select().from(auditLog).where(eq(auditLog.action, 'UPDATE_ATTENDANCE'));
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].details).toContain('"oldStatus":"present"');
    expect(auditEntries[0].details).toContain('"newStatus":"absent"');
  });

  it('Calculates monthly class attendance summary and student statistics (FR-AT4)', async () => {
    // Mark Day 1
    await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          classId,
          date: '2026-09-01',
          records: [
            { studentId: student1Id, status: 'present' },
            { studentId: student2Id, status: 'present' },
          ],
        }),
      },
      { DB: d1 } as any
    );

    // Mark Day 2
    await app.request(
      '/api/attendance/mark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          classId,
          date: '2026-09-02',
          records: [
            { studentId: student1Id, status: 'present' },
            { studentId: student2Id, status: 'absent' },
          ],
        }),
      },
      { DB: d1 } as any
    );

    // Request Summary
    const summaryRes = await app.request(
      `/api/attendance/summary/class/${classId}?month=2026-09`,
      {
        headers: { Cookie: `session_token=${teacherToken}` },
      },
      { DB: d1 } as any
    );

    expect(summaryRes.status).toBe(200);
    const summaryJson = (await summaryRes.json()) as any;
    expect(summaryJson.summary.totalSchoolDays).toBe(2);
    expect(summaryJson.summary.students.length).toBe(2);

    const s1Stats = summaryJson.summary.students.find((s: any) => s.studentId === student1Id);
    expect(s1Stats.presentDays).toBe(2);
    expect(s1Stats.percentage).toBe(100);

    const s2Stats = summaryJson.summary.students.find((s: any) => s.studentId === student2Id);
    expect(s2Stats.presentDays).toBe(1);
    expect(s2Stats.absentDays).toBe(1);
    expect(s2Stats.percentage).toBe(50);
  });
});
