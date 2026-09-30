import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, teachers, students, academicYears, classes, classTeachers } from '../src/worker/db/schema';

describe('Leave Register Business Logic Tests (FR-L1 to FR-L5 & FR-AT3)', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  let class1Id: number;
  let student1Id: number;

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
    const [tUser] = await db
      .insert(users)
      .values({ email: 'teacher@school.com', passwordHash: passHash, role: 'teacher', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    teacherToken = (await createSession(db, tUser.id)).token;

    const [tProfile] = await db
      .insert(teachers)
      .values({ userId: tUser.id, name: 'Main Teacher', phone: '1111111111', createdAt: now, updatedAt: now })
      .returning();

    // 3. Create Academic Year and Class
    const [ay] = await db
      .insert(academicYears)
      .values({ name: '2025-2026', isCurrent: true, createdAt: now, updatedAt: now })
      .returning();

    const [c1] = await db
      .insert(classes)
      .values({ name: 'Class 10A', academicYearId: ay.id, createdAt: now, updatedAt: now })
      .returning();
    class1Id = c1.id;

    await db.insert(classTeachers).values({ classId: class1Id, teacherId: tProfile.id, createdAt: now, updatedAt: now });

    // 4. Create Student
    const [sUser] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    studentToken = (await createSession(db, sUser.id)).token;

    const [sProfile] = await db
      .insert(students)
      .values({ userId: sUser.id, admissionNo: 'STU001', name: 'John Doe', classId: class1Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = sProfile.id;
  });

  it('validates date range in leave request (fromDate <= toDate)', async () => {
    const res = await app.request('/api/leaves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${studentToken}`,
      },
      body: JSON.stringify({
        fromDate: '2025-10-15',
        toDate: '2025-10-10', // Invalid: fromDate > toDate
        reason: 'Invalid range test',
      }),
    }, { DB: d1 });

    expect(res.status).toBe(400);
  });

  it('prevents overlapping pending or approved leave requests (FR-L5)', async () => {
    // 1. Submit initial request for Oct 10 to Oct 15
    const firstReq = await app.request('/api/leaves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${studentToken}`,
      },
      body: JSON.stringify({
        fromDate: '2025-10-10',
        toDate: '2025-10-15',
        reason: 'First trip',
      }),
    }, { DB: d1 });
    expect(firstReq.status).toBe(201);

    // 2. Attempt overlapping request for Oct 12 to Oct 18 (overlaps Oct 12-15)
    const overlapReq = await app.request('/api/leaves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${studentToken}`,
      },
      body: JSON.stringify({
        fromDate: '2025-10-12',
        toDate: '2025-10-18',
        reason: 'Second trip overlap',
      }),
    }, { DB: d1 });
    expect(overlapReq.status).toBe(400);
    const errData = (await overlapReq.json()) as any;
    expect(errData.error).toContain('Overlapping leave request');

    // 3. Non-overlapping request for Oct 20 to Oct 22 succeeds
    const okReq = await app.request('/api/leaves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${studentToken}`,
      },
      body: JSON.stringify({
        fromDate: '2025-10-20',
        toDate: '2025-10-22',
        reason: 'Next trip',
      }),
    }, { DB: d1 });
    expect(okReq.status).toBe(201);
  });

  it('links approved leave dates directly to attendance status (FR-AT3)', async () => {
    // 1. Teacher submits direct leave for Oct 01 to Oct 03
    const directRes = await app.request('/api/leaves/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${teacherToken}`,
      },
      body: JSON.stringify({
        studentId: student1Id,
        fromDate: '2025-10-01',
        toDate: '2025-10-03',
        reason: 'Medical leave approved directly',
        decisionNote: 'Doctor certificate provided',
      }),
    }, { DB: d1 });
    expect(directRes.status).toBe(201);

    // 2. Fetch attendance logs for student
    const attRes = await app.request(`/api/attendance?studentId=${student1Id}`, {
      headers: { Cookie: `session_token=${teacherToken}` },
    }, { DB: d1 });
    expect(attRes.status).toBe(200);
    const attData = (await attRes.json()) as any;

    expect(attData.attendance.length).toBe(3); // Oct 1, Oct 2, Oct 3
    const leaveStatuses = attData.attendance.map((a: any) => a.status);
    expect(leaveStatuses).toEqual(['leave', 'leave', 'leave']);

    // 3. Verify attendance summary counts leaveDays correctly
    const summaryRes = await app.request(`/api/attendance/summary/student/${student1Id}`, {
      headers: { Cookie: `session_token=${studentToken}` },
    }, { DB: d1 });
    expect(summaryRes.status).toBe(200);
    const summaryData = (await summaryRes.json()) as any;
    expect(summaryData.stats.leaveDays).toBe(3);
  });

  it('approves pending leave request and syncs attendance (FR-L2 & FR-AT3)', async () => {
    // 1. Student requests leave for Nov 05 to Nov 06
    const reqRes = await app.request('/api/leaves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${studentToken}`,
      },
      body: JSON.stringify({
        fromDate: '2025-11-05',
        toDate: '2025-11-06',
        reason: 'Wedding ceremony',
      }),
    }, { DB: d1 });
    expect(reqRes.status).toBe(201);
    const { leave } = (await reqRes.json()) as any;

    // 2. Teacher approves leave
    const reviewRes = await app.request(`/api/leaves/${leave.id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${teacherToken}`,
      },
      body: JSON.stringify({
        status: 'approved',
        decisionNote: 'Granted',
      }),
    }, { DB: d1 });
    expect(reviewRes.status).toBe(200);

    // 3. Verify attendance records for Nov 05 and Nov 06 are set to 'leave'
    const attRes = await app.request(`/api/attendance?studentId=${student1Id}&date=2025-11-05`, {
      headers: { Cookie: `session_token=${teacherToken}` },
    }, { DB: d1 });
    const attData = (await attRes.json()) as any;
    expect(attData.attendance[0].status).toBe('leave');
  });
});

