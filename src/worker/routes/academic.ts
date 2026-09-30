import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { Env, Variables } from '../types';
import {
  academicYears,
  classes,
  classTeachers,
  subjects,
  teachers,
  students,
  users,
  attendance,
  exams,
  feeItems,
} from '../db/schema';
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  createClassSchema,
  updateClassSchema,
  createSubjectSchema,
  assignClassTeacherSchema,
  subjectCsvPreviewSchema,
  subjectCsvExecuteSchema,
} from '../../shared/schemas';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { checkClassAccess, getTeacherAssignedClassIds } from '../lib/scope';
import { previewSubjectCsv } from '../lib/csv';

const academicRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

academicRouter.use('*', authMiddleware);

// --- ACADEMIC YEARS ---

// GET /api/academic-years
academicRouter.get('/academic-years', async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db
    .select()
    .from(academicYears)
    .orderBy(desc(academicYears.isCurrent), desc(academicYears.createdAt));

  return c.json({ academicYears: result });
});

// POST /api/academic-years (Admin only)
academicRouter.post('/academic-years', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createAcademicYearSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, isCurrent } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  // If setting as current, unset current flag on all other academic years
  if (isCurrent) {
    await db.update(academicYears).set({ isCurrent: false, updatedAt: now });
  }

  const [inserted] = await db
    .insert(academicYears)
    .values({
      name,
      isCurrent,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ academicYear: inserted, message: 'Academic year created successfully' }, 201);
});

// PATCH /api/academic-years/:id (Admin only)
academicRouter.patch('/academic-years/:id', requireRole('admin'), async (c) => {
  const ayId = parseInt(c.req.param('id'), 10);
  if (isNaN(ayId)) return c.json({ error: 'Invalid ID' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateAcademicYearSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, isCurrent } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  if (isCurrent) {
    await db.update(academicYears).set({ isCurrent: false, updatedAt: now });
  }

  const [updated] = await db
    .update(academicYears)
    .set({
      ...(name ? { name } : {}),
      ...(isCurrent !== undefined ? { isCurrent } : {}),
      updatedAt: now,
    })
    .where(eq(academicYears.id, ayId))
    .returning();

  if (!updated) return c.json({ error: 'Academic year not found' }, 404);
  return c.json({ academicYear: updated, message: 'Academic year updated successfully' });
});

// --- CLASSES ---

// GET /api/classes
academicRouter.get('/classes', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  let allowedClassIds: number[] | null = null;
  if (user.role === 'teacher') {
    allowedClassIds = await getTeacherAssignedClassIds(db, user.id);
    if (allowedClassIds.length === 0) {
      return c.json({ classes: [] });
    }
  }

  const query = db
    .select({
      id: classes.id,
      name: classes.name,
      academicYearId: classes.academicYearId,
      academicYearName: academicYears.name,
      createdAt: classes.createdAt,
      updatedAt: classes.updatedAt,
    })
    .from(classes)
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id));

  if (allowedClassIds !== null) {
    query.where(inArray(classes.id, allowedClassIds));
  }

  const classRecords = await query;

  // Enrich with assigned teachers
  const result = await Promise.all(
    classRecords.map(async (cls) => {
      const teacherRecords = await db
        .select({
          teacherId: teachers.id,
          teacherName: teachers.name,
        })
        .from(classTeachers)
        .innerJoin(teachers, eq(classTeachers.teacherId, teachers.id))
        .where(eq(classTeachers.classId, cls.id));

      return {
        ...cls,
        teacherIds: teacherRecords.map((t) => t.teacherId),
        teacherNames: teacherRecords.map((t) => t.teacherName),
      };
    })
  );

  return c.json({ classes: result });
});

// POST /api/classes (Admin only)
academicRouter.post('/classes', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createClassSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, academicYearId } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const [inserted] = await db
    .insert(classes)
    .values({
      name,
      academicYearId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ classRecord: inserted, message: 'Class created successfully' }, 201);
});

// PATCH /api/classes/:id (Admin only - Edit Class)
academicRouter.patch('/classes/:id', requireRole('admin'), async (c) => {
  const classId = parseInt(c.req.param('id'), 10);
  if (isNaN(classId)) return c.json({ error: 'Invalid class ID' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateClassSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, academicYearId } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const [existing] = await db.select().from(classes).where(eq(classes.id, classId));
  if (!existing) return c.json({ error: 'Class not found' }, 404);

  const [updated] = await db
    .update(classes)
    .set({
      ...(name ? { name } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      updatedAt: now,
    })
    .where(eq(classes.id, classId))
    .returning();

  return c.json({ classRecord: updated, message: 'Class updated successfully' });
});

// DELETE /api/classes/:id (Admin only - Delete Class with deleteStudents choice)
academicRouter.delete('/classes/:id', requireRole('admin'), async (c) => {
  const classId = parseInt(c.req.param('id'), 10);
  if (isNaN(classId)) return c.json({ error: 'Invalid class ID' }, 400);

  const queryDeleteStudents = c.req.query('deleteStudents');
  let deleteStudents = queryDeleteStudents === 'true';

  const body = await c.req.json().catch(() => ({}));
  if (body && typeof body.deleteStudents === 'boolean') {
    deleteStudents = body.deleteStudents;
  }

  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const [targetClass] = await db.select().from(classes).where(eq(classes.id, classId));
  if (!targetClass) return c.json({ error: 'Class not found' }, 404);

  const classStudents = await db.select().from(students).where(eq(students.classId, classId));

  if (deleteStudents) {
    // Delete students and their associated user accounts
    for (const student of classStudents) {
      await db.delete(students).where(eq(students.id, student.id));
      await db.delete(users).where(eq(users.id, student.userId));
    }

    // Remove class teachers association
    await db.delete(classTeachers).where(eq(classTeachers.classId, classId));

    // Remove class record
    await db.delete(classes).where(eq(classes.id, classId));

    return c.json({
      message: `Class "${targetClass.name}" and ${classStudents.length} enrolled students were permanently deleted.`,
      studentsCount: classStudents.length,
      action: 'deleted_with_students',
    });
  } else {
    // KEEP STUDENTS: Move students to unassigned / archived state (classId = null, status = 'inactive')
    await db
      .update(students)
      .set({
        classId: null,
        status: 'inactive',
        updatedAt: now,
      })
      .where(eq(students.classId, classId));

    // Keep attendance, exams, fee items history intact by setting classId = null
    await db.update(attendance).set({ classId: null }).where(eq(attendance.classId, classId));
    await db.update(exams).set({ classId: null }).where(eq(exams.classId, classId));
    await db.update(feeItems).set({ classId: null }).where(eq(feeItems.classId, classId));
    await db.update(subjects).set({ classId: null }).where(eq(subjects.classId, classId));

    // Remove class teachers association
    await db.delete(classTeachers).where(eq(classTeachers.classId, classId));

    // Remove class record
    await db.delete(classes).where(eq(classes.id, classId));

    return c.json({
      message: `Class "${targetClass.name}" was deleted. ${classStudents.length} students were kept in unassigned/archived state with full history intact.`,
      studentsCount: classStudents.length,
      action: 'deleted_kept_students',
    });
  }
});

// POST /api/classes/:id/teachers (Admin only) - Assign Teacher to Class
academicRouter.post('/classes/:id/teachers', requireRole('admin'), async (c) => {
  const classId = parseInt(c.req.param('id'), 10);
  if (isNaN(classId)) return c.json({ error: 'Invalid class ID' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parseResult = assignClassTeacherSchema.safeParse({ ...body, classId });

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { teacherId } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  // Check if already assigned
  const existing = await db
    .select()
    .from(classTeachers)
    .where(and(eq(classTeachers.classId, classId), eq(classTeachers.teacherId, teacherId)));

  if (existing.length > 0) {
    return c.json({ message: 'Teacher is already assigned to this class' });
  }

  await db.insert(classTeachers).values({
    classId,
    teacherId,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ message: 'Teacher assigned to class successfully' });
});

// --- SUBJECTS ---

// GET /api/subjects
academicRouter.get('/subjects', async (c) => {
  const classIdParam = c.req.query('classId');
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const query = db
    .select({
      id: subjects.id,
      classId: subjects.classId,
      className: classes.name,
      name: subjects.name,
      createdAt: subjects.createdAt,
      updatedAt: subjects.updatedAt,
    })
    .from(subjects)
    .leftJoin(classes, eq(subjects.classId, classes.id));

  if (classIdParam) {
    const classId = parseInt(classIdParam, 10);
    const access = await checkClassAccess(db, user, classId);
    if (!access.allowed) {
      return c.json({ error: access.reason }, 403);
    }
    query.where(eq(subjects.classId, classId));
  }

  const result = await query;
  return c.json({ subjects: result });
});

// POST /api/subjects (Admin only)
academicRouter.post('/subjects', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createSubjectSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, classId } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const [inserted] = await db
    .insert(subjects)
    .values({
      name,
      classId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ subject: inserted, message: 'Subject created successfully' }, 201);
});

// POST /api/subjects/import-csv/preview (Admin only)
academicRouter.post('/subjects/import-csv/preview', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = subjectCsvPreviewSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { csvContent, classId } = parseResult.data;
  if (!classId) return c.json({ error: 'Target class ID is required' }, 400);

  const db = drizzle(c.env.DB);
  const previewResult = await previewSubjectCsv(db, csvContent, classId);

  return c.json(previewResult);
});

// POST /api/subjects/import-csv/execute (Admin only)
academicRouter.post('/subjects/import-csv/execute', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = subjectCsvExecuteSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { classId, rows } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const importedSubjects: any[] = [];
  const errors: Array<{ rowNumber: number; name: string; error: string }> = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 1;

    try {
      const [inserted] = await db
        .insert(subjects)
        .values({
          classId,
          name: row.name.trim(),
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      importedSubjects.push(inserted);
    } catch (err: any) {
      errors.push({
        rowNumber,
        name: row.name,
        error: err.message || 'Database insertion error',
      });
    }
  }

  return c.json({
    successCount: importedSubjects.length,
    failureCount: errors.length,
    importedSubjects,
    errors,
  });
});

export default academicRouter;
