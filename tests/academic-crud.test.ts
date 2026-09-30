import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users } from '../src/worker/db/schema';

describe('Academic & People CRUD API', () => {
  let d1: any;
  let db: any;
  let adminSessionToken: string;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('AdminPass123');
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
    adminSessionToken = session.token;
  });

  it('Admin can CRUD Academic Years', async () => {
    // 1. Create Academic Year
    const createRes = await app.request(
      '/api/academic-years',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ name: '2025-2026', isCurrent: true }),
      },
      { DB: d1 } as any
    );

    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as any;
    expect(createJson.academicYear.name).toBe('2025-2026');
    expect(createJson.academicYear.isCurrent).toBe(true);

    // 2. List Academic Years
    const listRes = await app.request(
      '/api/academic-years',
      {
        headers: { Cookie: `session_token=${adminSessionToken}` },
      },
      { DB: d1 } as any
    );

    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as any;
    expect(listJson.academicYears.length).toBe(1);
  });

  it('Admin can create Class and assign Teacher to Class', async () => {
    const now = new Date().toISOString();

    // Create Academic Year
    const ayRes = await app.request(
      '/api/academic-years',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ name: '2025-2026', isCurrent: true }),
      },
      { DB: d1 } as any
    );
    const ayJson = (await ayRes.json()) as any;

    // Create Class
    const classRes = await app.request(
      '/api/classes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ name: 'Class 10A', academicYearId: ayJson.academicYear.id }),
      },
      { DB: d1 } as any
    );

    expect(classRes.status).toBe(201);
    const classJson = (await classRes.json()) as any;
    expect(classJson.classRecord.name).toBe('Class 10A');

    // Create Teacher
    const teacherRes = await app.request(
      '/api/teachers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'johndoe@school.com',
          phone: '9876543210',
        }),
      },
      { DB: d1 } as any
    );

    expect(teacherRes.status).toBe(201);
    const teacherJson = (await teacherRes.json()) as any;
    expect(teacherJson.teacher.name).toBe('John Doe');

    // Assign Teacher to Class
    const assignRes = await app.request(
      `/api/classes/${classJson.classRecord.id}/teachers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ teacherId: teacherJson.teacher.id }),
      },
      { DB: d1 } as any
    );

    expect(assignRes.status).toBe(200);
  });

  it('Admin can promote active students from one class to another (FR-S4)', async () => {
    // 1. Setup AY and two classes
    const ayRes = await app.request(
      '/api/academic-years',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ name: '2024-2025', isCurrent: false }),
      },
      { DB: d1 } as any
    );
    const ayJson = (await ayRes.json()) as any;

    const class9Res = await app.request(
      '/api/classes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ name: 'Class 9A', academicYearId: ayJson.academicYear.id }),
      },
      { DB: d1 } as any
    );
    const class9Json = (await class9Res.json()) as any;

    const class10Res = await app.request(
      '/api/classes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ name: 'Class 10A', academicYearId: ayJson.academicYear.id }),
      },
      { DB: d1 } as any
    );
    const class10Json = (await class10Res.json()) as any;

    // 2. Create student in Class 9A
    const studentRes = await app.request(
      '/api/students',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({
          name: 'Promote Candidate',
          admissionNo: 'ADM-PROM-01',
          email: 'promote@school.com',
          classId: class9Json.classRecord.id,
        }),
      },
      { DB: d1 } as any
    );
    expect(studentRes.status).toBe(201);
    const studentJson = (await studentRes.json()) as any;

    // 3. Perform Promotion
    const promoteRes = await app.request(
      '/api/students/promote',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({
          sourceClassId: class9Json.classRecord.id,
          targetClassId: class10Json.classRecord.id,
        }),
      },
      { DB: d1 } as any
    );

    expect(promoteRes.status).toBe(200);
    const promoteJson = (await promoteRes.json()) as any;
    expect(promoteJson.promotedCount).toBe(1);

    // 4. Verify student is now in Class 10A
    const getStudentRes = await app.request(
      `/api/students/${studentJson.student.id}`,
      {
        headers: { Cookie: `session_token=${adminSessionToken}` },
      },
      { DB: d1 } as any
    );
    expect(getStudentRes.status).toBe(200);
    const getStudentJson = (await getStudentRes.json()) as any;
    expect(getStudentJson.student.classId).toBe(class10Json.classRecord.id);
  });
});
