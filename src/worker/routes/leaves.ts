import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, lte, gte, inArray, desc, ne } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { users, students, classes, leaves, attendance, auditLog } from '../db/schema';
import {
  createLeaveSchema,
  directLeaveSchema,
  reviewLeaveSchema,
} from '../../shared/schemas';
import { authMiddleware } from '../middleware/auth';
import {
  checkStudentAccess,
  checkClassAccess,
  canTeacherAccessClass,
  getStudentByUserId,
  getTeacherAssignedClassIds,
} from '../lib/scope';

const leavesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

leavesRouter.use('*', authMiddleware);

/**
 * Generate ISO YYYY-MM-DD date strings for range [startDateStr, endDateStr]
 */
function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T00:00:00Z');
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * Check if a student has any pending or approved leaves overlapping [fromDate, toDate]
 */
async function hasOverlappingLeave(
  db: ReturnType<typeof drizzle>,
  studentId: number,
  fromDate: string,
  toDate: string,
  excludeLeaveId?: number
): Promise<boolean> {
  const conditions = [
    eq(leaves.studentId, studentId),
    inArray(leaves.status, ['pending', 'approved']),
    lte(leaves.fromDate, toDate),
    gte(leaves.toDate, fromDate),
  ];

  if (excludeLeaveId) {
    conditions.push(ne(leaves.id, excludeLeaveId));
  }

  const existing = await db
    .select({ id: leaves.id })
    .from(leaves)
    .where(and(...conditions))
    .limit(1);

  return existing.length > 0;
}

/**
 * Automatically update or insert attendance records with 'leave' status for approved dates
 */
async function syncLeaveToAttendance(
  db: ReturnType<typeof drizzle>,
  studentId: number,
  classId: number | null,
  fromDate: string,
  toDate: string,
  markedByUserId: number
) {
  const dateList = getDatesInRange(fromDate, toDate);
  const now = new Date().toISOString();

  for (const d of dateList) {
    const [existing] = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.studentId, studentId), eq(attendance.date, d)));

    if (existing) {
      await db
        .update(attendance)
        .set({
          status: 'leave',
          markedBy: markedByUserId,
          updatedAt: now,
        })
        .where(eq(attendance.id, existing.id));
    } else {
      await db.insert(attendance).values({
        studentId,
        classId,
        date: d,
        status: 'leave',
        markedBy: markedByUserId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

// GET /api/leaves (List leaves filtered by classId, studentId, status)
leavesRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const classIdParam = c.req.query('classId');
  const studentIdParam = c.req.query('studentId');
  const statusParam = c.req.query('status');

  let classIdFilter = classIdParam ? parseInt(classIdParam, 10) : undefined;
  let studentIdFilter = studentIdParam ? parseInt(studentIdParam, 10) : undefined;

  // Student Scoping
  if (user.role === 'student') {
    const studentRec = await getStudentByUserId(db, user.id);
    if (!studentRec) return c.json({ error: 'Student profile not found' }, 404);
    if (studentIdFilter && studentIdFilter !== studentRec.id) {
      return c.json({ error: 'Students can only access their own leave requests' }, 403);
    }
    studentIdFilter = studentRec.id;
  }

  // Teacher Scoping
  if (user.role === 'teacher') {
    if (classIdFilter) {
      const isAssigned = await canTeacherAccessClass(db, user.id, classIdFilter);
      if (!isAssigned) {
        return c.json({ error: 'Teachers can only access leave requests for assigned classes' }, 403);
      }
    }
    if (studentIdFilter) {
      const access = await checkStudentAccess(db, user, studentIdFilter);
      if (!access.allowed) {
        return c.json({ error: access.reason || 'Forbidden' }, 403);
      }
    }
  }

  const conditions = [];

  if (studentIdFilter) {
    conditions.push(eq(leaves.studentId, studentIdFilter));
  }
  if (classIdFilter) {
    conditions.push(eq(students.classId, classIdFilter));
  } else if (user.role === 'teacher' && !studentIdFilter) {
    const teacherClassIds = await getTeacherAssignedClassIds(db, user.id);
    if (teacherClassIds.length === 0) {
      return c.json({ leaves: [] });
    }
    conditions.push(inArray(students.classId, teacherClassIds));
  }

  if (statusParam && ['pending', 'approved', 'rejected'].includes(statusParam)) {
    conditions.push(eq(leaves.status, statusParam as 'pending' | 'approved' | 'rejected'));
  }

  const query = db
    .select({
      id: leaves.id,
      studentId: leaves.studentId,
      studentName: students.name,
      admissionNo: students.admissionNo,
      classId: students.classId,
      className: classes.name,
      fromDate: leaves.fromDate,
      toDate: leaves.toDate,
      reason: leaves.reason,
      status: leaves.status,
      requestedBy: leaves.requestedBy,
      requestedByName: users.email,
      decidedBy: leaves.decidedBy,
      decidedAt: leaves.decidedAt,
      decisionNote: leaves.decisionNote,
      createdAt: leaves.createdAt,
      updatedAt: leaves.updatedAt,
    })
    .from(leaves)
    .innerJoin(students, eq(leaves.studentId, students.id))
    .leftJoin(classes, eq(students.classId, classes.id))
    .innerJoin(users, eq(leaves.requestedBy, users.id))
    .orderBy(desc(leaves.createdAt));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const results = await query;
  return c.json({ leaves: results });
});

// GET /api/leaves/me (Student views own leaves)
leavesRouter.get('/me', async (c) => {
  const user = c.get('user');
  if (user.role !== 'student') {
    return c.json({ error: 'Only student accounts can access /api/leaves/me' }, 403);
  }

  const db = drizzle(c.env.DB);
  const studentRec = await getStudentByUserId(db, user.id);
  if (!studentRec) {
    return c.json({ error: 'Student profile not found' }, 404);
  }

  const results = await db
    .select({
      id: leaves.id,
      studentId: leaves.studentId,
      studentName: students.name,
      admissionNo: students.admissionNo,
      classId: students.classId,
      className: classes.name,
      fromDate: leaves.fromDate,
      toDate: leaves.toDate,
      reason: leaves.reason,
      status: leaves.status,
      requestedBy: leaves.requestedBy,
      decidedBy: leaves.decidedBy,
      decidedAt: leaves.decidedAt,
      decisionNote: leaves.decisionNote,
      createdAt: leaves.createdAt,
      updatedAt: leaves.updatedAt,
    })
    .from(leaves)
    .innerJoin(students, eq(leaves.studentId, students.id))
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(eq(leaves.studentId, studentRec.id))
    .orderBy(desc(leaves.createdAt));

  return c.json({ leaves: results });
});

// POST /api/leaves (Student submits leave request FR-L1)
leavesRouter.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'student') {
    return c.json({ error: 'Only students can submit leave requests via POST /api/leaves. Staff should use POST /api/leaves/direct.' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = createLeaveSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { fromDate, toDate, reason } = parseResult.data;
  const db = drizzle(c.env.DB);

  const studentRec = await getStudentByUserId(db, user.id);
  if (!studentRec) {
    return c.json({ error: 'Student profile not found' }, 404);
  }

  // Overlap Validation (FR-L5)
  const isOverlapping = await hasOverlappingLeave(db, studentRec.id, fromDate, toDate);
  if (isOverlapping) {
    return c.json({ error: 'Overlapping leave request already exists for this date range' }, 400);
  }

  const now = new Date().toISOString();
  const [newLeave] = await db
    .insert(leaves)
    .values({
      studentId: studentRec.id,
      fromDate,
      toDate,
      reason,
      status: 'pending',
      requestedBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ message: 'Leave request submitted successfully', leave: newLeave }, 201);
});

// POST /api/leaves/direct (Staff direct leave entry FR-L3)
leavesRouter.post('/direct', async (c) => {
  const user = c.get('user');
  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students cannot add direct leaves' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = directLeaveSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { studentId, fromDate, toDate, reason, decisionNote } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Check student access for teacher/admin
  const access = await checkStudentAccess(db, user, studentId);
  if (!access.allowed || !access.student) {
    return c.json({ error: access.reason || 'Forbidden: Cannot access student' }, 403);
  }

  // Overlap Validation (FR-L5)
  const isOverlapping = await hasOverlappingLeave(db, studentId, fromDate, toDate);
  if (isOverlapping) {
    return c.json({ error: 'Overlapping leave request already exists for this date range' }, 400);
  }

  const now = new Date().toISOString();
  const [newLeave] = await db
    .insert(leaves)
    .values({
      studentId,
      fromDate,
      toDate,
      reason,
      status: 'approved',
      requestedBy: user.id,
      decidedBy: user.id,
      decidedAt: now,
      decisionNote: decisionNote || 'Direct entry by staff',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Sync to attendance (FR-AT3)
  await syncLeaveToAttendance(db, studentId, access.student.classId, fromDate, toDate, user.id);

  // Audit log entry
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'CREATE_DIRECT_LEAVE',
    entity: 'leaves',
    entityId: newLeave.id,
    details: JSON.stringify({
      studentId,
      fromDate,
      toDate,
      reason,
      status: 'approved',
    }),
    createdAt: now,
  });

  return c.json({ message: 'Direct leave created and approved successfully', leave: newLeave }, 201);
});

// PATCH /api/leaves/:id/review (Teacher/Admin approve or reject leave FR-L2)
leavesRouter.patch('/:id/review', async (c) => {
  const user = c.get('user');
  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students cannot review leave requests' }, 403);
  }

  const leaveId = parseInt(c.req.param('id'), 10);
  if (isNaN(leaveId)) {
    return c.json({ error: 'Invalid leave ID' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = reviewLeaveSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { status, decisionNote } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Fetch leave record
  const [targetLeave] = await db.select().from(leaves).where(eq(leaves.id, leaveId));
  if (!targetLeave) {
    return c.json({ error: 'Leave request not found' }, 404);
  }

  // Check student access
  const access = await checkStudentAccess(db, user, targetLeave.studentId);
  if (!access.allowed || !access.student) {
    return c.json({ error: access.reason || 'Forbidden: Cannot access student leave request' }, 403);
  }

  // If approving, check overlap with other approved/pending leaves
  if (status === 'approved') {
    const isOverlapping = await hasOverlappingLeave(
      db,
      targetLeave.studentId,
      targetLeave.fromDate,
      targetLeave.toDate,
      targetLeave.id
    );
    if (isOverlapping) {
      return c.json({ error: 'Overlapping leave request already exists for this date range' }, 400);
    }
  }

  const now = new Date().toISOString();
  await db
    .update(leaves)
    .set({
      status,
      decidedBy: user.id,
      decidedAt: now,
      decisionNote: decisionNote ?? null,
      updatedAt: now,
    })
    .where(eq(leaves.id, leaveId));

  // If approved, sync attendance (FR-AT3)
  if (status === 'approved') {
    await syncLeaveToAttendance(
      db,
      targetLeave.studentId,
      access.student.classId,
      targetLeave.fromDate,
      targetLeave.toDate,
      user.id
    );
  }

  // Audit log entry
  await db.insert(auditLog).values({
    userId: user.id,
    action: `REVIEW_LEAVE_${status.toUpperCase()}`,
    entity: 'leaves',
    entityId: leaveId,
    details: JSON.stringify({
      studentId: targetLeave.studentId,
      oldStatus: targetLeave.status,
      newStatus: status,
      decisionNote,
    }),
    createdAt: now,
  });

  const [updatedLeave] = await db.select().from(leaves).where(eq(leaves.id, leaveId));

  return c.json({
    message: `Leave request ${status} successfully`,
    leave: updatedLeave,
  });
});

export default leavesRouter;
