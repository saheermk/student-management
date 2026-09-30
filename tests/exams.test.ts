import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import {
  users,
  teachers,
  students,
  academicYears,
  classes,
  classTeachers,
  subjects,
  auditLog,
} from '../src/worker/db/schema';

describe('Exams & Progress Card Business Logic Tests', () => {
  let d1: any;
  let db: any;
  let adminToken: string;
  let teacherToken: string;

  let classId: number;
  let student1Id: number;
  let student2Id: number;
  let subject1Id: number;
  let subject2Id: number;
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
      .values({ userId: teacherUser.id, name: 'Lead Teacher', phone: '9876543210', createdAt: now, updatedAt: now })
      .returning();

    // 3. Create Academic Year and Class
    const [ay] = await db
      .insert(academicYears)
      .values({ name: '2025-2026', isCurrent: true, createdAt: now, updatedAt: now })
      .returning();
    ayId = ay.id;

    const [c1] = await db
      .insert(classes)
      .values({ name: 'Class 5A', academicYearId: ay.id, createdAt: now, updatedAt: now })
      .returning();
    classId = c1.id;

    // Assign Teacher to Class
    await db.insert(classTeachers).values({ classId, teacherId: teacherProfile.id, createdAt: now, updatedAt: now });

    // 4. Create Subjects
    const [sub1] = await db
      .insert(subjects)
      .values({ classId, name: 'Quran & Thajweed', createdAt: now, updatedAt: now })
      .returning();
    subject1Id = sub1.id;

    const [sub2] = await db
      .insert(subjects)
      .values({ classId, name: 'Fiqh & Hadeeth', createdAt: now, updatedAt: now })
      .returning();
    subject2Id = sub2.id;

    // 5. Create 2 Students
    const [s1User] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    const [s1] = await db
      .insert(students)
      .values({ userId: s1User.id, admissionNo: 'ADM-001', name: 'Ali Ahmed', classId, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = s1.id;

    const [s2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    const [s2] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'ADM-002', name: 'Bilal Hassan', classId, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;
  });

  it('Creates an exam and lists it for the class', async () => {
    const createRes = await app.request(
      '/api/exams',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          classId,
          type: 'monthly',
          name: 'First Term Exam',
          examDate: '2026-09-10',
          academicYearId: ayId,
        }),
      },
      { DB: d1 } as any
    );

    expect(createRes.status).toBe(201);
    const createData: any = await createRes.json();
    expect(createData.exam.name).toBe('First Term Exam');
    expect(createData.exam.id).toBeDefined();

    // List Exams
    const listRes = await app.request(
      `/api/exams?classId=${classId}`,
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    expect(listRes.status).toBe(200);
    const listData: any = await listRes.json();
    expect(listData.exams.length).toBe(1);
    expect(listData.exams[0].name).toBe('First Term Exam');
  });

  it('Enters exam marks and generates progress card with ranks and total calculations', async () => {
    // 1. Create Exam
    const createExamRes = await app.request(
      '/api/exams',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          classId,
          type: 'semester',
          name: 'Half Yearly Examination',
          examDate: '2026-09-15',
          academicYearId: ayId,
        }),
      },
      { DB: d1 } as any
    );
    const examObj = ((await createExamRes.json()) as any).exam;

    // 2. Bulk Save Marks: Ali (student1) gets 45/50 & 48/50 (Total 93/100). Bilal (student2) gets 35/50 & 40/50 (Total 75/100)
    const saveMarksRes = await app.request(
      `/api/exams/${examObj.id}/marks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          records: [
            { studentId: student1Id, subjectId: subject1Id, marks: 45, maxMarks: 50, remarks: 'Excellent' },
            { studentId: student1Id, subjectId: subject2Id, marks: 48, maxMarks: 50, remarks: 'Top Rank' },
            { studentId: student2Id, subjectId: subject1Id, marks: 35, maxMarks: 50 },
            { studentId: student2Id, subjectId: subject2Id, marks: 40, maxMarks: 50 },
          ],
        }),
      },
      { DB: d1 } as any
    );
    expect(saveMarksRes.status).toBe(200);
    const saveResult: any = await saveMarksRes.json();
    expect(saveResult.insertedCount).toBe(4);

    // 3. Fetch Marks Entry Grid
    const gridRes = await app.request(
      `/api/exams/${examObj.id}/marks`,
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    expect(gridRes.status).toBe(200);
    const gridData: any = await gridRes.json();
    expect(gridData.students.length).toBe(2);
    expect(gridData.subjects.length).toBe(2);

    // 4. Update existing mark for Ali (audit log trigger)
    const updateMarksRes = await app.request(
      `/api/exams/${examObj.id}/marks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${teacherToken}`,
        },
        body: JSON.stringify({
          records: [
            { studentId: student1Id, subjectId: subject1Id, marks: 47, maxMarks: 50, remarks: 'Correction' },
          ],
        }),
      },
      { DB: d1 } as any
    );
    expect(updateMarksRes.status).toBe(200);
    const updateData: any = await updateMarksRes.json();
    expect(updateData.updatedCount).toBe(1);

    // Check Audit Log
    const auditEntries = await db.select().from(auditLog);
    expect(auditEntries.length).toBeGreaterThan(0);
    expect(auditEntries[0].action).toBe('UPDATE_EXAM_MARKS');

    // 5. Fetch Progress Card for Student 1 (Ali Ahmed)
    const cardRes = await app.request(
      `/api/exams/progress-card/student/${student1Id}?examId=${examObj.id}`,
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    expect(cardRes.status).toBe(200);
    const card = ((await cardRes.json()) as any).progressCard;

    expect(card.student.name).toBe('Ali Ahmed');
    expect(card.grandTotalMax).toBe(100);
    expect(card.grandTotalObtained).toBe(95); // 47 + 48 = 95
    expect(card.overallPercentage).toBe(95);
    expect(card.result).toBe('PASS');
    expect(card.rank).toBe('#1'); // Highest total in class
    expect(card.grandTotalGrade).toBe('A+');
  });

  it('Admin configures custom grade boundaries', async () => {
    const customBoundaries = [
      { grade: 'A+', minPercentage: 95, maxPercentage: 100, classification: 'Super Distinction', isPass: true },
      { grade: 'A', minPercentage: 85, maxPercentage: 94, classification: 'Distinction', isPass: true },
      { grade: 'B', minPercentage: 70, maxPercentage: 84, classification: 'First Class', isPass: true },
      { grade: 'F', minPercentage: 0, maxPercentage: 69, classification: 'Failed', isPass: false },
    ];

    const configRes = await app.request(
      '/api/exams/grade-boundaries',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify(customBoundaries),
      },
      { DB: d1 } as any
    );

    expect(configRes.status).toBe(200);
    const configData: any = await configRes.json();
    expect(configData.boundaries.length).toBe(4);

    // Fetch Grade Boundaries
    const getRes = await app.request(
      '/api/exams/grade-boundaries',
      { headers: { Cookie: `session_token=${teacherToken}` } },
      { DB: d1 } as any
    );
    expect(getRes.status).toBe(200);
    const getData: any = await getRes.json();
    expect(getData.boundaries[0].classification).toBe('Super Distinction');
  });
});
