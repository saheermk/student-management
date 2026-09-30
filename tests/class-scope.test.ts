import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import {
  users,
  academicYears,
  classes,
  teachers,
  classTeachers,
  students,
} from '../src/worker/db/schema';

describe('Class-Scope & Role Scoping Permissions', () => {
  let d1: any;
  let db: any;
  let class1Id: number;
  let class2Id: number;

  let teacher1UserId: number;
  let teacher1SessionToken: string;

  let student1UserId: number;
  let student1StudentId: number;
  let student1SessionToken: string;

  let student2UserId: number;
  let student2StudentId: number;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('Password123');
    const now = new Date().toISOString();

    // 1. Create Academic Year
    const [ay] = await db
      .insert(academicYears)
      .values({ name: '2025-2026', isCurrent: true, createdAt: now, updatedAt: now })
      .returning();

    // 2. Create Class 1 (Class 10A) and Class 2 (Class 10B)
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

    // 3. Create Teacher 1 (assigned to Class 10A ONLY)
    const [t1User] = await db
      .insert(users)
      .values({
        email: 'teacher1@school.com',
        passwordHash: passHash,
        role: 'teacher',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    teacher1UserId = t1User.id;

    const [t1Record] = await db
      .insert(teachers)
      .values({ userId: t1User.id, name: 'Teacher One', phone: '1234567890', createdAt: now, updatedAt: now })
      .returning();

    await db.insert(classTeachers).values({
      classId: class1Id,
      teacherId: t1Record.id,
      createdAt: now,
      updatedAt: now,
    });

    const t1Session = await createSession(db, teacher1UserId);
    teacher1SessionToken = t1Session.token;

    // 4. Create Student 1 (in Class 10A)
    const [s1User] = await db
      .insert(users)
      .values({
        email: 'student1@school.com',
        passwordHash: passHash,
        role: 'student',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    student1UserId = s1User.id;

    const [s1Record] = await db
      .insert(students)
      .values({
        userId: s1User.id,
        admissionNo: 'ADM101',
        name: 'Student One',
        classId: class1Id,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    student1StudentId = s1Record.id;

    const s1Session = await createSession(db, student1UserId);
    student1SessionToken = s1Session.token;

    // 5. Create Student 2 (in Class 10B)
    const [s2User] = await db
      .insert(users)
      .values({
        email: 'student2@school.com',
        passwordHash: passHash,
        role: 'student',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    student2UserId = s2User.id;

    const [s2Record] = await db
      .insert(students)
      .values({
        userId: s2User.id,
        admissionNo: 'ADM102',
        name: 'Student Two',
        classId: class2Id,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    student2StudentId = s2Record.id;
  });

  it('Teacher can read students in assigned class (200 OK)', async () => {
    const res = await app.request(
      '/api/students',
      {
        headers: { Cookie: `session_token=${teacher1SessionToken}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { students: any[] };
    // Teacher 1 is assigned to Class 10A, so should ONLY see Student 1
    expect(json.students.length).toBe(1);
    expect(json.students[0].admissionNo).toBe('ADM101');
  });

  it('Teacher cannot access details of student outside assigned class (403)', async () => {
    const res = await app.request(
      `/api/students/${student2StudentId}`,
      {
        headers: { Cookie: `session_token=${teacher1SessionToken}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });

  it('Student can read their own profile (200 OK)', async () => {
    const res = await app.request(
      '/api/students/me',
      {
        headers: { Cookie: `session_token=${student1SessionToken}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { student: any };
    expect(json.student.admissionNo).toBe('ADM101');
  });

  it('Student gets 403 when trying to access another student profile', async () => {
    const res = await app.request(
      `/api/students/${student2StudentId}`,
      {
        headers: { Cookie: `session_token=${student1SessionToken}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(403);
  });
});
