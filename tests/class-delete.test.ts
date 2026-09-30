import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import {
  users,
  students,
  academicYears,
  classes,
  subjects,
  attendance,
  exams,
  examMarks,
  feeItems,
  feePayments,
  leaves,
} from '../src/worker/db/schema';
import { eq } from 'drizzle-orm';

describe('Class Delete & Edit Tests (Delete-With-Keep-Students Focus)', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;
  let student1Token: string;

  let ayId: number;
  let class1Id: number;
  let student1Id: number;
  let student2Id: number;
  let subject1Id: number;
  let exam1Id: number;
  let feeItem1Id: number;
  let leave1Id: number;

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

    // 3. Create Academic Year and Class 10A
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

    // 4. Create Subject
    const [sub1] = await db
      .insert(subjects)
      .values({ name: 'Mathematics', classId: class1Id, createdAt: now, updatedAt: now })
      .returning();
    subject1Id = sub1.id;

    // 5. Create Student 1 & Student 2
    const [s1User] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    student1Token = (await createSession(db, s1User.id)).token;

    const [s1] = await db
      .insert(students)
      .values({ userId: s1User.id, admissionNo: 'ADM-101', name: 'Alice Smith', classId: class1Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = s1.id;

    const [s2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();

    const [s2] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'ADM-102', name: 'Bob Jones', classId: class1Id, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;

    // 6. Record Attendance for Student 1 & 2
    await db.insert(attendance).values({
      studentId: student1Id,
      classId: class1Id,
      date: '2026-09-20',
      status: 'present',
      markedBy: adminUser.id,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(attendance).values({
      studentId: student2Id,
      classId: class1Id,
      date: '2026-09-20',
      status: 'absent',
      markedBy: adminUser.id,
      createdAt: now,
      updatedAt: now,
    });

    // 7. Create Exam & Record Exam Marks
    const [ex1] = await db
      .insert(exams)
      .values({ name: 'Midterm Exam', classId: class1Id, type: 'monthly', examDate: '2026-09-21', academicYearId: ayId, createdAt: now, updatedAt: now })
      .returning();
    exam1Id = ex1.id;

    await db.insert(examMarks).values({
      examId: exam1Id,
      studentId: student1Id,
      subjectId: subject1Id,
      marks: 45,
      maxMarks: 50,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(examMarks).values({
      examId: exam1Id,
      studentId: student2Id,
      subjectId: subject1Id,
      marks: 38,
      maxMarks: 50,
      createdAt: now,
      updatedAt: now,
    });

    // 8. Create Fee Item & Payment for Student 1
    const [fi1] = await db
      .insert(feeItems)
      .values({ studentId: student1Id, classId: class1Id, academicYearId: ayId, title: 'Term 1 Tuition', amount: 5000, dueDate: '2026-10-01', createdAt: now, updatedAt: now })
      .returning();
    feeItem1Id = fi1.id;

    await db.insert(feePayments).values({
      feeItemId: feeItem1Id,
      studentId: student1Id,
      amountPaid: 3000,
      paymentDate: '2026-09-22',
      receiptNo: 'RCP-888',
      recordedBy: adminUser.id,
      createdAt: now,
      updatedAt: now,
    });

    // 9. Create Leave Request for Student 1
    const [lv1] = await db
      .insert(leaves)
      .values({ studentId: student1Id, fromDate: '2026-09-25', toDate: '2026-09-26', reason: 'Family event', status: 'approved', requestedBy: s1User.id, createdAt: now, updatedAt: now })
      .returning();
    leave1Id = lv1.id;
  });

  it('PROVES DELETE CLASS WITH KEEP-STUDENTS (deleteStudents=false) PRESERVES ALL STUDENT RECORDS AND HISTORY (FR-S1 / FR-S4)', async () => {
    // Action: Admin deletes Class 10A with deleteStudents = false
    const res = await app.request(
      `/api/classes/${class1Id}?deleteStudents=false`,
      {
        method: 'DELETE',
        headers: { Cookie: `session_token=${adminToken}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const resData: any = await res.json();
    expect(resData.action).toBe('deleted_kept_students');
    expect(resData.studentsCount).toBe(2);

    // 1. Verify Class 10A is deleted
    const [deletedClass] = await db.select().from(classes).where(eq(classes.id, class1Id));
    expect(deletedClass).toBeUndefined();

    // 2. Verify Students (Alice & Bob) still exist in DB with classId = null
    const [s1Record] = await db.select().from(students).where(eq(students.id, student1Id));
    expect(s1Record).toBeDefined();
    expect(s1Record.name).toBe('Alice Smith');
    expect(s1Record.classId).toBeNull();
    expect(s1Record.status).toBe('inactive'); // Unassigned/Archived status

    const [s2Record] = await db.select().from(students).where(eq(students.id, student2Id));
    expect(s2Record).toBeDefined();
    expect(s2Record.name).toBe('Bob Jones');
    expect(s2Record.classId).toBeNull();

    // 3. Verify Attendance Records REMAIN INTACT
    const s1Attendance = await db.select().from(attendance).where(eq(attendance.studentId, student1Id));
    expect(s1Attendance.length).toBe(1);
    expect(s1Attendance[0].status).toBe('present');

    const s2Attendance = await db.select().from(attendance).where(eq(attendance.studentId, student2Id));
    expect(s2Attendance.length).toBe(1);
    expect(s2Attendance[0].status).toBe('absent');

    // 4. Verify Exam Marks REMAIN INTACT
    const s1Marks = await db.select().from(examMarks).where(eq(examMarks.studentId, student1Id));
    expect(s1Marks.length).toBe(1);
    expect(s1Marks[0].marks).toBe(45);

    const s2Marks = await db.select().from(examMarks).where(eq(examMarks.studentId, student2Id));
    expect(s2Marks.length).toBe(1);
    expect(s2Marks[0].marks).toBe(38);

    // 5. Verify Fee Items & Payments REMAIN INTACT
    const s1FeeSummaryRes = await app.request(
      `/api/fees/student/${student1Id}`,
      { headers: { Cookie: `session_token=${adminToken}` } },
      { DB: d1 } as any
    );
    expect(s1FeeSummaryRes.status).toBe(200);
    const feeData: any = await s1FeeSummaryRes.json();
    expect(feeData.totals.totalCharged).toBe(5000);
    expect(feeData.totals.totalPaid).toBe(3000);
    expect(feeData.totals.balance).toBe(2000);
    expect(feeData.feeItems.length).toBe(1);

    // 6. Verify Leave Records REMAIN INTACT
    const s1LeavesRes = await app.request(
      `/api/leaves/me`,
      { headers: { Cookie: `session_token=${student1Token}` } },
      { DB: d1 } as any
    );
    expect(s1LeavesRes.status).toBe(200);
    const leaveData: any = await s1LeavesRes.json();
    expect(leaveData.leaves.length).toBe(1);
    expect(leaveData.leaves[0].reason).toBe('Family event');
  });

  it('DELETE CLASS WITH DELETE-STUDENTS (deleteStudents=true) PERMANENTLY REMOVES CLASS AND STUDENTS', async () => {
    const res = await app.request(
      `/api/classes/${class1Id}?deleteStudents=true`,
      {
        method: 'DELETE',
        headers: { Cookie: `session_token=${adminToken}` },
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const resData: any = await res.json();
    expect(resData.action).toBe('deleted_with_students');

    const [deletedClass] = await db.select().from(classes).where(eq(classes.id, class1Id));
    expect(deletedClass).toBeUndefined();

    const [s1Record] = await db.select().from(students).where(eq(students.id, student1Id));
    expect(s1Record).toBeUndefined();
  });

  it('PATCH /api/classes/:id allows admin to edit class name and academic year', async () => {
    // Create another academic year
    const now = new Date().toISOString();
    const [ay2] = await db
      .insert(academicYears)
      .values({ name: '2026-2027', isCurrent: false, createdAt: now, updatedAt: now })
      .returning();

    const res = await app.request(
      `/api/classes/${class1Id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Class 10B Premier',
          academicYearId: ay2.id,
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.classRecord.name).toBe('Class 10B Premier');
    expect(data.classRecord.academicYearId).toBe(ay2.id);
  });

  it('Non-admin users receive 403 Forbidden for Edit & Delete class endpoints', async () => {
    const editRes = await app.request(
      `/api/classes/${class1Id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({ name: 'Hacked Class' }),
      },
      { DB: d1 } as any
    );
    expect(editRes.status).toBe(403);

    const deleteRes = await app.request(
      `/api/classes/${class1Id}`,
      {
        method: 'DELETE',
        headers: { Cookie: `session_token=${teacherToken}` },
      },
      { DB: d1 } as any
    );
    expect(deleteRes.status).toBe(403);
  });

  it('Subject CSV Import Preview & Execute Flow', async () => {
    const csvContent = `Subject Name\nPhysics\nChemistry\nMathematics`; // Mathematics already exists in DB for class1Id

    // 1. Preview
    const previewRes = await app.request(
      '/api/subjects/import-csv/preview',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({ csvContent, classId: class1Id }),
      },
      { DB: d1 } as any
    );

    expect(previewRes.status).toBe(200);
    const previewData: any = await previewRes.json();
    expect(previewData.totalRows).toBe(3);
    expect(previewData.validRowsCount).toBe(2);
    expect(previewData.invalidRowsCount).toBe(1); // Mathematics flagged as duplicate

    // 2. Execute import with valid rows
    const validRows = previewData.results.filter((r: any) => r.isValid).map((r: any) => ({ name: r.data.name }));
    const execRes = await app.request(
      '/api/subjects/import-csv/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({ classId: class1Id, rows: validRows }),
      },
      { DB: d1 } as any
    );

    expect(execRes.status).toBe(200);
    const execData: any = await execRes.json();
    expect(execData.successCount).toBe(2);

    // Verify database has 3 subjects now
    const classSubjects = await db.select().from(subjects).where(eq(subjects.classId, class1Id));
    expect(classSubjects.length).toBe(3);
  });
});
