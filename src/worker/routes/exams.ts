import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { Env, Variables } from '../types';
import {
  exams,
  examMarks,
  gradeBoundaries,
  classes,
  students,
  subjects,
  academicYears,
  auditLog,
} from '../db/schema';
import { createExamSchema, enterExamMarksSchema, gradeBoundarySchema } from '../../shared/schemas';
import { authMiddleware } from '../middleware/auth';
import {
  checkClassAccess,
  checkStudentAccess,
  canTeacherAccessClass,
  getStudentByUserId,
  getTeacherAssignedClassIds,
} from '../lib/scope';
import { generateProgressCard } from '../lib/progress-card';

const examsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

examsRouter.use('*', authMiddleware);

// GET /api/exams - List exams based on role and class filter
examsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const classIdParam = c.req.query('classId');
  const classId = classIdParam ? parseInt(classIdParam, 10) : undefined;

  let targetClassIds: number[] | null = null;

  if (user.role === 'student') {
    const studentRec = await getStudentByUserId(db, user.id);
    if (!studentRec) return c.json({ error: 'Student record not found' }, 404);
    targetClassIds = studentRec.classId ? [studentRec.classId] : [];
  } else if (user.role === 'teacher') {
    if (classId) {
      const isAssigned = await canTeacherAccessClass(db, user.id, classId);
      if (!isAssigned) {
        return c.json({ error: 'Forbidden: Teacher not assigned to class' }, 403);
      }
      targetClassIds = [classId];
    } else {
      targetClassIds = await getTeacherAssignedClassIds(db, user.id);
      if (targetClassIds.length === 0) {
        return c.json({ exams: [] });
      }
    }
  } else if (classId) {
    targetClassIds = [classId];
  }

  const query = db
    .select({
      id: exams.id,
      name: exams.name,
      type: exams.type,
      classId: exams.classId,
      className: classes.name,
      academicYearId: exams.academicYearId,
      academicYearName: academicYears.name,
      examDate: exams.examDate,
      createdAt: exams.createdAt,
      updatedAt: exams.updatedAt,
    })
    .from(exams)
    .innerJoin(classes, eq(exams.classId, classes.id))
    .innerJoin(academicYears, eq(exams.academicYearId, academicYears.id))
    .orderBy(desc(exams.examDate), desc(exams.id));

  if (targetClassIds && targetClassIds.length > 0) {
    query.where(inArray(exams.classId, targetClassIds));
  }

  const results = await query;
  return c.json({ exams: results });
});

// POST /api/exams - Create exam for a class
examsRouter.post('/', async (c) => {
  const user = c.get('user');
  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students cannot create exams' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = createExamSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const db = drizzle(c.env.DB);
  const { classId, type, name, examDate, academicYearId } = parseResult.data;

  // Enforce Class Scope
  const access = await checkClassAccess(db, user, classId);
  if (!access.allowed) {
    return c.json({ error: access.reason || 'Forbidden' }, 403);
  }

  const now = new Date().toISOString();
  const [newExam] = await db
    .insert(exams)
    .values({
      classId,
      academicYearId,
      type,
      name,
      examDate,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ message: 'Exam created successfully', exam: newExam }, 201);
});

// GET /api/exams/progress-card/me - Student self progress card
examsRouter.get('/progress-card/me', async (c) => {
  const user = c.get('user');
  if (user.role !== 'student') {
    return c.json({ error: 'Only student accounts can access /me endpoint' }, 403);
  }

  const db = drizzle(c.env.DB);
  const studentRec = await getStudentByUserId(db, user.id);
  if (!studentRec) {
    return c.json({ error: 'Student record not found' }, 404);
  }

  const examIdParam = c.req.query('examId');
  const examId = examIdParam ? parseInt(examIdParam, 10) : undefined;

  const card = await generateProgressCard(db, studentRec.id, examId);
  if (!card) {
    return c.json({ error: 'Progress card generation failed' }, 404);
  }

  return c.json({ progressCard: card });
});

// GET /api/exams/progress-card/student/:studentId - Fetch progress card for specific student
examsRouter.get('/progress-card/student/:studentId', async (c) => {
  const studentId = parseInt(c.req.param('studentId'), 10);
  if (isNaN(studentId)) return c.json({ error: 'Invalid student ID' }, 400);

  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const access = await checkStudentAccess(db, user, studentId);
  if (!access.allowed) {
    return c.json({ error: access.reason || 'Forbidden' }, 403);
  }

  const examIdParam = c.req.query('examId');
  const examId = examIdParam ? parseInt(examIdParam, 10) : undefined;

  const card = await generateProgressCard(db, studentId, examId);
  if (!card) {
    return c.json({ error: 'Progress card not found for student' }, 404);
  }

  return c.json({ progressCard: card });
});

// GET /api/exams/:id/marks - Fetch marks entry grid for an exam
examsRouter.get('/:id/marks', async (c) => {
  const examId = parseInt(c.req.param('id'), 10);
  if (isNaN(examId)) return c.json({ error: 'Invalid exam ID' }, 400);

  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const [examRec] = await db.select().from(exams).where(eq(exams.id, examId));
  if (!examRec) {
    return c.json({ error: 'Exam not found' }, 404);
  }

  // Enforce Class Scope
  if (examRec.classId) {
    const access = await checkClassAccess(db, user, examRec.classId);
    if (!access.allowed) {
      return c.json({ error: access.reason || 'Forbidden' }, 403);
    }
  }

  // Fetch Class
  const [classRec] = examRec.classId
    ? await db.select().from(classes).where(eq(classes.id, examRec.classId))
    : [undefined];

  // Fetch Subjects for class
  const classSubjects = examRec.classId
    ? await db
        .select()
        .from(subjects)
        .where(eq(subjects.classId, examRec.classId))
    : await db.select().from(subjects);

  // Fetch Active Students in class
  const classStudents = examRec.classId
    ? await db
        .select()
        .from(students)
        .where(and(eq(students.classId, examRec.classId), eq(students.status, 'active')))
        .orderBy(students.name)
    : [];

  // Fetch Entered Marks
  const marks = await db.select().from(examMarks).where(eq(examMarks.examId, examId));

  const marksMap = new Map<string, typeof examMarks.$inferSelect>();
  marks.forEach((m) => {
    marksMap.set(`${m.studentId}_${m.subjectId}`, m);
  });

  const studentGrid = classStudents.map((s) => {
    const subjectMarks: Record<number, { marks: number; maxMarks: number; remarks: string | null }> = {};
    classSubjects.forEach((sub) => {
      const rec = marksMap.get(`${s.id}_${sub.id}`);
      subjectMarks[sub.id] = {
        marks: rec ? rec.marks : 0,
        maxMarks: rec ? rec.maxMarks : 50,
        remarks: rec ? rec.remarks : '',
      };
    });
    return {
      studentId: s.id,
      studentName: s.name,
      admissionNo: s.admissionNo,
      marks: subjectMarks,
    };
  });

  return c.json({
    exam: examRec,
    class: classRec,
    subjects: classSubjects,
    students: studentGrid,
  });
});

// POST /api/exams/:id/marks - Bulk save / edit exam marks
examsRouter.post('/:id/marks', async (c) => {
  const examId = parseInt(c.req.param('id'), 10);
  if (isNaN(examId)) return c.json({ error: 'Invalid exam ID' }, 400);

  const user = c.get('user');
  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students cannot enter marks' }, 403);
  }

  const db = drizzle(c.env.DB);
  const [examRec] = await db.select().from(exams).where(eq(exams.id, examId));
  if (!examRec) {
    return c.json({ error: 'Exam not found' }, 404);
  }

  if (examRec.classId) {
    const access = await checkClassAccess(db, user, examRec.classId);
    if (!access.allowed) {
      return c.json({ error: access.reason || 'Forbidden' }, 403);
    }
  } else if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = enterExamMarksSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const now = new Date().toISOString();
  let updatedCount = 0;
  let insertedCount = 0;

  for (const rec of parseResult.data.records) {
    const existing = await db
      .select()
      .from(examMarks)
      .where(
        and(
          eq(examMarks.examId, examId),
          eq(examMarks.studentId, rec.studentId),
          eq(examMarks.subjectId, rec.subjectId)
        )
      );

    if (existing.length > 0) {
      const prev = existing[0];
      if (prev.marks !== rec.marks || prev.maxMarks !== rec.maxMarks || prev.remarks !== (rec.remarks || null)) {
        await db
          .update(examMarks)
          .set({
            marks: rec.marks,
            maxMarks: rec.maxMarks,
            remarks: rec.remarks || null,
            updatedAt: now,
          })
          .where(eq(examMarks.id, prev.id));

        // Audit Log for modified marks
        await db.insert(auditLog).values({
          userId: user.id,
          action: 'UPDATE_EXAM_MARKS',
          entity: 'exam_marks',
          entityId: prev.id,
          details: JSON.stringify({
            examId,
            studentId: rec.studentId,
            subjectId: rec.subjectId,
            oldMarks: prev.marks,
            newMarks: rec.marks,
            oldMaxMarks: prev.maxMarks,
            newMaxMarks: rec.maxMarks,
          }),
          createdAt: now,
        });

        updatedCount++;
      }
    } else {
      await db.insert(examMarks).values({
        examId,
        studentId: rec.studentId,
        subjectId: rec.subjectId,
        marks: rec.marks,
        maxMarks: rec.maxMarks,
        remarks: rec.remarks || null,
        createdAt: now,
        updatedAt: now,
      });

      insertedCount++;
    }
  }

  return c.json({
    message: 'Exam marks saved successfully',
    insertedCount,
    updatedCount,
  });
});

// GET /api/exams/grade-boundaries - List configured grade boundaries
examsRouter.get('/grade-boundaries', async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(gradeBoundaries).orderBy(desc(gradeBoundaries.minPercentage));

  if (result.length === 0) {
    // Return default grade boundaries fallback
    const defaults = [
      { grade: 'A+', minPercentage: 90, maxPercentage: 100, classification: 'Top Plus', isPass: true },
      { grade: 'A', minPercentage: 80, maxPercentage: 89, classification: 'Distinction', isPass: true },
      { grade: 'B', minPercentage: 70, maxPercentage: 79, classification: 'First Class', isPass: true },
      { grade: 'C', minPercentage: 60, maxPercentage: 69, classification: 'Second Class', isPass: true },
      { grade: 'D', minPercentage: 50, maxPercentage: 59, classification: 'Passed', isPass: true },
      { grade: 'F', minPercentage: 0, maxPercentage: 49, classification: 'Failed', isPass: false },
    ];
    return c.json({ boundaries: defaults });
  }

  return c.json({ boundaries: result });
});

// POST /api/exams/grade-boundaries - Configurable grade boundaries (Admin only - FR-P4)
examsRouter.post('/grade-boundaries', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Only admin can configure grade boundaries' }, 403);
  }

  const body = await c.req.json().catch(() => ([]));
  if (!Array.isArray(body)) {
    return c.json({ error: 'Expected an array of grade boundary records' }, 400);
  }

  const validated: any[] = [];
  for (const item of body) {
    const parse = gradeBoundarySchema.safeParse(item);
    if (!parse.success) {
      return c.json({ error: 'Validation failed', details: parse.error.flatten() }, 400);
    }
    validated.push(parse.data);
  }

  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  // Replace all grade boundaries
  await db.delete(gradeBoundaries);

  for (const item of validated) {
    await db.insert(gradeBoundaries).values({
      grade: item.grade,
      minPercentage: item.minPercentage,
      maxPercentage: item.maxPercentage,
      classification: item.classification || null,
      isPass: item.isPass ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const updatedList = await db.select().from(gradeBoundaries).orderBy(desc(gradeBoundaries.minPercentage));
  return c.json({ message: 'Grade boundaries updated successfully', boundaries: updatedList });
});

export default examsRouter;

