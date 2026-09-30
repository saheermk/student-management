import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { users, students, classes } from '../db/schema';
import {
  createStudentSchema,
  updateStudentSchema,
  csvPreviewRequestSchema,
  csvExecuteImportSchema,
  promoteClassSchema,
} from '../../shared/schemas';
import { hashPassword, generateRandomToken } from '../lib/crypto';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import {
  checkStudentAccess,
  getStudentByUserId,
  getTeacherAssignedClassIds,
} from '../lib/scope';
import { previewStudentCsv } from '../lib/csv';

const studentsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

studentsRouter.use('*', authMiddleware);

// GET /api/students/me (Student views own record)
studentsRouter.get('/me', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const studentRecord = await getStudentByUserId(db, user.id);
  if (!studentRecord) {
    return c.json({ error: 'Student record not found for logged in user' }, 404);
  }

  // Fetch class name if assigned
  let className: string | undefined = undefined;
  if (studentRecord.classId) {
    const classRecords = await db
      .select({ name: classes.name })
      .from(classes)
      .where(eq(classes.id, studentRecord.classId));
    className = classRecords[0]?.name;
  }

  const studentDTO = {
    ...studentRecord,
    email: user.email,
    className: className || 'Unassigned / Archived',
  };

  return c.json({ student: studentDTO });
});

// GET /api/students (Admin gets all; Teacher gets students in assigned classes ONLY)
studentsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const classIdQuery = c.req.query('classId');

  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: students must access /api/students/me' }, 403);
  }

  let filterClassIds: number[] | null = null;

  if (user.role === 'teacher') {
    const teacherClassIds = await getTeacherAssignedClassIds(db, user.id);
    if (teacherClassIds.length === 0) {
      return c.json({ students: [] });
    }
    filterClassIds = teacherClassIds;
  }

  const query = db
    .select({
      id: students.id,
      userId: students.userId,
      admissionNo: students.admissionNo,
      name: students.name,
      email: users.email,
      classId: students.classId,
      className: classes.name,
      phone: students.phone,
      status: students.status,
      createdAt: students.createdAt,
      updatedAt: students.updatedAt,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .innerJoin(classes, eq(students.classId, classes.id))
    .orderBy(desc(students.createdAt));

  if (filterClassIds !== null) {
    query.where(inArray(students.classId, filterClassIds));
  } else if (classIdQuery) {
    const parsedClassId = parseInt(classIdQuery, 10);
    if (!isNaN(parsedClassId)) {
      query.where(eq(students.classId, parsedClassId));
    }
  }

  const results = await query;
  return c.json({ students: results });
});

// GET /api/students/:id (Enforces scope check)
studentsRouter.get('/:id', async (c) => {
  const studentId = parseInt(c.req.param('id'), 10);
  if (isNaN(studentId)) return c.json({ error: 'Invalid student ID' }, 400);

  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const access = await checkStudentAccess(db, user, studentId);
  if (!access.allowed || !access.student) {
    return c.json({ error: access.reason || 'Forbidden' }, 403);
  }

  const studentRecord = access.student;

  // Fetch email and class name
  const userRecord = await db.select({ email: users.email }).from(users).where(eq(users.id, studentRecord.userId));
  let className = 'Unassigned / Archived';
  if (studentRecord.classId) {
    const classRecord = await db.select({ name: classes.name }).from(classes).where(eq(classes.id, studentRecord.classId));
    if (classRecord[0]?.name) className = classRecord[0].name;
  }

  const studentDTO = {
    ...studentRecord,
    email: userRecord[0]?.email || '',
    className,
  };

  return c.json({ student: studentDTO });
});

// POST /api/students (Admin creates single student)
studentsRouter.post('/', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createStudentSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, admissionNo, email, classId, phone, password } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Check email and admission number uniqueness
  const existingEmail = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existingEmail.length > 0) {
    return c.json({ error: 'User with this email address already exists' }, 409);
  }

  const existingAdm = await db.select().from(students).where(eq(students.admissionNo, admissionNo.trim()));
  if (existingAdm.length > 0) {
    return c.json({ error: 'Student with this admission number already exists' }, 409);
  }

  const tempPassword = password || `Temp${generateRandomToken(4)}!`;
  const passwordHash = await hashPassword(tempPassword);
  const now = new Date().toISOString();

  // Create User account
  const [createdUser] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      role: 'student',
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Create Student record
  const [createdStudent] = await db
    .insert(students)
    .values({
      userId: createdUser.id,
      admissionNo: admissionNo.trim(),
      name,
      classId,
      phone: phone || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json(
    {
      student: {
        ...createdStudent,
        email: createdUser.email,
      },
      temporaryPassword: password ? undefined : tempPassword,
      message: 'Student account and profile created successfully',
    },
    201
  );
});

// PATCH /api/students/:id (Admin updates student details)
studentsRouter.patch('/:id', requireRole('admin'), async (c) => {
  const studentId = parseInt(c.req.param('id'), 10);
  if (isNaN(studentId)) return c.json({ error: 'Invalid student ID' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateStudentSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const [existing] = await db.select().from(students).where(eq(students.id, studentId));
  if (!existing) return c.json({ error: 'Student not found' }, 404);

  const { name, admissionNo, classId, phone, status } = parseResult.data;

  // Check unique constraints if admissionNo changes
  if (admissionNo && admissionNo !== existing.admissionNo) {
    const checkAdm = await db.select().from(students).where(eq(students.admissionNo, admissionNo.trim()));
    if (checkAdm.length > 0) {
      return c.json({ error: 'Student with this admission number already exists' }, 409);
    }
  }

  const [updatedStudent] = await db
    .update(students)
    .set({
      ...(name ? { name } : {}),
      ...(admissionNo ? { admissionNo: admissionNo.trim() } : {}),
      ...(classId ? { classId } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(status ? { status } : {}),
      updatedAt: now,
    })
    .where(eq(students.id, studentId))
    .returning();

  return c.json({ student: updatedStudent, message: 'Student record updated successfully' });
});

// POST /api/students/promote (Admin promotes entire class of active students to next class - FR-S4)
studentsRouter.post('/promote', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = promoteClassSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { sourceClassId, targetClassId } = parseResult.data;
  if (sourceClassId === targetClassId) {
    return c.json({ error: 'Source and target class cannot be the same' }, 400);
  }

  const db = drizzle(c.env.DB);

  // Validate classes exist
  const sourceClassRec = await db.select().from(classes).where(eq(classes.id, sourceClassId));
  const targetClassRec = await db.select().from(classes).where(eq(classes.id, targetClassId));

  if (sourceClassRec.length === 0) return c.json({ error: 'Source class not found' }, 404);
  if (targetClassRec.length === 0) return c.json({ error: 'Target class not found' }, 404);

  const now = new Date().toISOString();

  // Find active students in source class
  const studentsToPromote = await db
    .select()
    .from(students)
    .where(and(eq(students.classId, sourceClassId), eq(students.status, 'active')));

  if (studentsToPromote.length === 0) {
    return c.json({
      promotedCount: 0,
      sourceClassName: sourceClassRec[0].name,
      targetClassName: targetClassRec[0].name,
      message: 'No active students found in the source class to promote',
    });
  }

  // Update students to target class
  await db
    .update(students)
    .set({
      classId: targetClassId,
      updatedAt: now,
    })
    .where(and(eq(students.classId, sourceClassId), eq(students.status, 'active')));

  return c.json({
    promotedCount: studentsToPromote.length,
    sourceClassName: sourceClassRec[0].name,
    targetClassName: targetClassRec[0].name,
    message: `Successfully promoted ${studentsToPromote.length} students from ${sourceClassRec[0].name} to ${targetClassRec[0].name}`,
  });
});

// POST /api/students/import-csv/preview (Admin CSV preview)
studentsRouter.post('/import-csv/preview', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = csvPreviewRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const db = drizzle(c.env.DB);
  const previewResult = await previewStudentCsv(db, parseResult.data.csvContent);

  return c.json(previewResult);
});

// POST /api/students/import-csv/execute (Admin CSV bulk import execution)
studentsRouter.post('/import-csv/execute', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = csvExecuteImportSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { rows } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Lookup classes
  const allClasses = await db.select().from(classes);
  const classMap = new Map<string, number>();
  allClasses.forEach((c) => {
    classMap.set(c.name.toLowerCase(), c.id);
  });

  const importedStudents: any[] = [];
  const errors: Array<{ rowNumber: number; email: string; error: string }> = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 2;

    try {
      const classId = classMap.get(row.class.toLowerCase());
      if (!classId) {
        errors.push({ rowNumber, email: row.email, error: `Class "${row.class}" not found` });
        continue;
      }

      const tempPassword = `Temp${generateRandomToken(4)}!`;
      const passwordHash = await hashPassword(tempPassword);
      const now = new Date().toISOString();

      // Insert user account
      const [userRecord] = await db
        .insert(users)
        .values({
          email: row.email.toLowerCase(),
          passwordHash,
          role: 'student',
          isActive: true,
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Insert student record
      const [studentRecord] = await db
        .insert(students)
        .values({
          userId: userRecord.id,
          admissionNo: row.admissionNo.trim(),
          name: row.name,
          classId,
          phone: row.phone || null,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      importedStudents.push({
        ...studentRecord,
        email: userRecord.email,
        className: row.class,
        temporaryPassword: tempPassword,
      });
    } catch (err: any) {
      errors.push({
        rowNumber,
        email: row.email,
        error: err.message || 'Database insertion error',
      });
    }
  }

  return c.json({
    successCount: importedStudents.length,
    failureCount: errors.length,
    importedStudents,
    errors,
  });
});

export default studentsRouter;
