import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, inArray, desc } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { users, students, classes, attendance, auditLog } from '../db/schema';
import {
  markAttendanceSchema,
  attendanceFilterSchema,
} from '../../shared/schemas';
import { authMiddleware } from '../middleware/auth';
import {
  checkStudentAccess,
  checkClassAccess,
  canTeacherAccessClass,
  getStudentByUserId,
  getTeacherAssignedClassIds,
} from '../lib/scope';

const attendanceRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

attendanceRouter.use('*', authMiddleware);

// GET /api/attendance (List attendance logs based on filters)
attendanceRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const classIdParam = c.req.query('classId');
  const studentIdParam = c.req.query('studentId');
  const dateParam = c.req.query('date');
  const monthParam = c.req.query('month');

  let classIdFilter: number | undefined = classIdParam ? parseInt(classIdParam, 10) : undefined;
  let studentIdFilter: number | undefined = studentIdParam ? parseInt(studentIdParam, 10) : undefined;

  // Student Role Scoping
  if (user.role === 'student') {
    const studentRec = await getStudentByUserId(db, user.id);
    if (!studentRec) return c.json({ error: 'Student record not found' }, 404);
    studentIdFilter = studentRec.id; // Force own student ID
  }

  // Teacher Role Scoping
  if (user.role === 'teacher') {
    if (classIdFilter) {
      const isAssigned = await canTeacherAccessClass(db, user.id, classIdFilter);
      if (!isAssigned) {
        return c.json({ error: 'Teachers can only access attendance for assigned classes' }, 403);
      }
    }
  }

  const conditions = [];

  if (studentIdFilter) {
    conditions.push(eq(attendance.studentId, studentIdFilter));
  }
  if (classIdFilter) {
    conditions.push(eq(attendance.classId, classIdFilter));
  } else if (user.role === 'teacher' && !studentIdFilter) {
    const teacherClassIds = await getTeacherAssignedClassIds(db, user.id);
    if (teacherClassIds.length === 0) {
      return c.json({ attendance: [] });
    }
    conditions.push(inArray(attendance.classId, teacherClassIds));
  }

  if (dateParam) {
    conditions.push(eq(attendance.date, dateParam));
  } else if (monthParam) {
    conditions.push(like(attendance.date, `${monthParam}-%`));
  }

  const query = db
    .select({
      id: attendance.id,
      studentId: attendance.studentId,
      studentName: students.name,
      admissionNo: students.admissionNo,
      classId: attendance.classId,
      className: classes.name,
      date: attendance.date,
      status: attendance.status,
      markedBy: attendance.markedBy,
      markedByName: users.email,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    })
    .from(attendance)
    .innerJoin(students, eq(attendance.studentId, students.id))
    .innerJoin(classes, eq(attendance.classId, classes.id))
    .innerJoin(users, eq(attendance.markedBy, users.id))
    .orderBy(desc(attendance.date), desc(students.name));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const results = await query;
  return c.json({ attendance: results });
});

// GET /api/attendance/me (Student views own attendance profile & summary)
attendanceRouter.get('/me', async (c) => {
  const user = c.get('user');
  if (user.role !== 'student') {
    return c.json({ error: 'Only student accounts can access /api/attendance/me' }, 403);
  }

  const db = drizzle(c.env.DB);
  const studentRec = await getStudentByUserId(db, user.id);
  if (!studentRec) {
    return c.json({ error: 'Student profile not found' }, 404);
  }

  const logs = await db
    .select({
      id: attendance.id,
      studentId: attendance.studentId,
      classId: attendance.classId,
      className: classes.name,
      date: attendance.date,
      status: attendance.status,
      markedBy: attendance.markedBy,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    })
    .from(attendance)
    .innerJoin(classes, eq(attendance.classId, classes.id))
    .where(eq(attendance.studentId, studentRec.id))
    .orderBy(desc(attendance.date));

  const totalDays = logs.length;
  const presentDays = logs.filter((l) => l.status === 'present').length;
  const lateDays = logs.filter((l) => l.status === 'late').length;
  const absentDays = logs.filter((l) => l.status === 'absent').length;
  const leaveDays = logs.filter((l) => l.status === 'leave').length;

  const attendedDays = presentDays + lateDays;
  const percentage = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 100;

  return c.json({
    student: {
      id: studentRec.id,
      name: studentRec.name,
      admissionNo: studentRec.admissionNo,
      className: logs[0]?.className || '',
    },
    stats: {
      totalDays,
      presentDays,
      lateDays,
      absentDays,
      leaveDays,
      percentage,
    },
    logs,
  });
});

// POST /api/attendance/mark (Bulk mark attendance for class + date)
attendanceRouter.post('/mark', async (c) => {
  const user = c.get('user');
  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students cannot mark attendance' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = markAttendanceSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { classId, date, records } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Check Class-Scope permission
  const access = await checkClassAccess(db, user, classId);
  if (!access.allowed) {
    return c.json({ error: access.reason || 'Forbidden' }, 403);
  }

  const now = new Date().toISOString();
  let updatedCount = 0;
  let insertedCount = 0;

  for (const rec of records) {
    // Check if attendance record already exists for (studentId, date)
    const existing = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.studentId, rec.studentId), eq(attendance.date, date)));

    if (existing.length > 0) {
      const prev = existing[0];
      if (prev.status !== rec.status) {
        // Update attendance
        await db
          .update(attendance)
          .set({
            status: rec.status,
            markedBy: user.id,
            updatedAt: now,
          })
          .where(eq(attendance.id, prev.id));

        // Audit log entry for past date editing (FR-AT2)
        await db.insert(auditLog).values({
          userId: user.id,
          action: 'UPDATE_ATTENDANCE',
          entity: 'attendance',
          entityId: prev.id,
          details: JSON.stringify({
            studentId: rec.studentId,
            date,
            oldStatus: prev.status,
            newStatus: rec.status,
            markedBy: user.id,
          }),
          createdAt: now,
        });

        updatedCount++;
      }
    } else {
      // Insert new attendance record
      await db.insert(attendance).values({
        studentId: rec.studentId,
        classId,
        date,
        status: rec.status,
        markedBy: user.id,
        createdAt: now,
        updatedAt: now,
      });

      insertedCount++;
    }
  }

  return c.json({
    message: `Attendance recorded successfully for ${records.length} students`,
    insertedCount,
    updatedCount,
  });
});

// GET /api/attendance/summary/class/:classId (Monthly Class Summary - FR-AT4)
attendanceRouter.get('/summary/class/:classId', async (c) => {
  const classId = parseInt(c.req.param('classId'), 10);
  if (isNaN(classId)) return c.json({ error: 'Invalid class ID' }, 400);

  const user = c.get('user');
  const db = drizzle(c.env.DB);

  // Check Class Access
  const access = await checkClassAccess(db, user, classId);
  if (!access.allowed) {
    return c.json({ error: access.reason || 'Forbidden' }, 403);
  }

  const monthParam = c.req.query('month') || new Date().toISOString().slice(0, 7); // YYYY-MM

  // Fetch Class details
  const [classRec] = await db.select().from(classes).where(eq(classes.id, classId));
  if (!classRec) return c.json({ error: 'Class not found' }, 404);

  // Fetch active students in class
  const classStudents = await db
    .select({
      id: students.id,
      name: students.name,
      admissionNo: students.admissionNo,
    })
    .from(students)
    .where(and(eq(students.classId, classId), eq(students.status, 'active')))
    .orderBy(students.name);

  // Fetch monthly attendance records for class
  const monthlyRecords = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.classId, classId), like(attendance.date, `${monthParam}-%`)));

  // Calculate unique school days in month
  const uniqueDates = new Set(monthlyRecords.map((r) => r.date));
  const totalSchoolDays = uniqueDates.size;

  let classTotalPercentageSum = 0;

  const studentStats = classStudents.map((s) => {
    const studentLogs = monthlyRecords.filter((r) => r.studentId === s.id);
    const totalDays = studentLogs.length;
    const presentDays = studentLogs.filter((r) => r.status === 'present').length;
    const lateDays = studentLogs.filter((r) => r.status === 'late').length;
    const absentDays = studentLogs.filter((r) => r.status === 'absent').length;
    const leaveDays = studentLogs.filter((r) => r.status === 'leave').length;

    const attendedDays = presentDays + lateDays;
    const percentage = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 100;
    classTotalPercentageSum += percentage;

    return {
      studentId: s.id,
      studentName: s.name,
      admissionNo: s.admissionNo,
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      leaveDays,
      percentage,
    };
  });

  const overallPercentage =
    studentStats.length > 0 ? Math.round(classTotalPercentageSum / studentStats.length) : 100;

  return c.json({
    summary: {
      classId: classRec.id,
      className: classRec.name,
      month: monthParam,
      totalStudents: classStudents.length,
      totalSchoolDays,
      overallPercentage,
      students: studentStats,
    },
  });
});

// GET /api/attendance/summary/student/:studentId (Student Attendance Summary Stats)
attendanceRouter.get('/summary/student/:studentId', async (c) => {
  const studentId = parseInt(c.req.param('studentId'), 10);
  if (isNaN(studentId)) return c.json({ error: 'Invalid student ID' }, 400);

  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const access = await checkStudentAccess(db, user, studentId);
  if (!access.allowed || !access.student) {
    return c.json({ error: access.reason || 'Forbidden' }, 403);
  }

  const monthParam = c.req.query('month');
  const conditions = [eq(attendance.studentId, studentId)];
  if (monthParam) {
    conditions.push(like(attendance.date, `${monthParam}-%`));
  }

  const logs = await db
    .select({
      id: attendance.id,
      date: attendance.date,
      status: attendance.status,
      className: classes.name,
      markedByName: users.email,
    })
    .from(attendance)
    .innerJoin(classes, eq(attendance.classId, classes.id))
    .innerJoin(users, eq(attendance.markedBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(attendance.date));

  const totalDays = logs.length;
  const presentDays = logs.filter((l) => l.status === 'present').length;
  const lateDays = logs.filter((l) => l.status === 'late').length;
  const absentDays = logs.filter((l) => l.status === 'absent').length;
  const leaveDays = logs.filter((l) => l.status === 'leave').length;

  const attendedDays = presentDays + lateDays;
  const percentage = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 100;

  return c.json({
    student: {
      id: access.student.id,
      name: access.student.name,
      admissionNo: access.student.admissionNo,
    },
    stats: {
      totalDays,
      presentDays,
      lateDays,
      absentDays,
      leaveDays,
      percentage,
    },
    logs,
  });
});

export default attendanceRouter;
