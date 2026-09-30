import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, inArray, desc, like } from 'drizzle-orm';
import { Env, Variables } from '../types';
import {
  feeItems,
  feePayments,
  students,
  classes,
  academicYears,
  users,
  auditLog,
} from '../db/schema';
import {
  createFeeItemSchema,
  createBulkClassFeeSchema,
  recordPaymentSchema,
  updateFeeItemSchema,
} from '../../shared/schemas';
import { authMiddleware } from '../middleware/auth';
import { getStudentByUserId } from '../lib/scope';

const feesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

feesRouter.use('*', authMiddleware);

// FR-F7: Teachers have NO ACCESS to any fee endpoint (returns 403 Forbidden)
feesRouter.use('*', async (c, next) => {
  const user = c.get('user');
  if (user.role === 'teacher') {
    return c.json({ error: 'Forbidden: Teachers cannot access fee endpoints' }, 403);
  }
  await next();
});

// GET /api/fees/me - Student self fee profile endpoint (FR-F6)
feesRouter.get('/me', async (c) => {
  const user = c.get('user');
  if (user.role !== 'student') {
    return c.json({ error: 'Only student accounts can access /me endpoint' }, 403);
  }

  const db = drizzle(c.env.DB);
  const studentRec = await getStudentByUserId(db, user.id);
  if (!studentRec) {
    return c.json({ error: 'Student profile not found' }, 404);
  }

  return fetchStudentFeeSummary(db, studentRec.id, c);
});

// GET /api/fees/student/:studentId - Fetch fee summary for specific student (Admin or Student self - FR-F6)
feesRouter.get('/student/:studentId', async (c) => {
  const studentId = parseInt(c.req.param('studentId'), 10);
  if (isNaN(studentId)) return c.json({ error: 'Invalid student ID' }, 400);

  const user = c.get('user');
  const db = drizzle(c.env.DB);

  if (user.role === 'student') {
    const studentRec = await getStudentByUserId(db, user.id);
    if (!studentRec || studentRec.id !== studentId) {
      return c.json({ error: 'Forbidden: Students can only view their own fees' }, 403);
    }
  }

  return fetchStudentFeeSummary(db, studentId, c);
});

// GET /api/fees - Admin dues list & summary report (FR-F3, FR-F4)
feesRouter.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  const db = drizzle(c.env.DB);
  const classIdParam = c.req.query('classId');
  const isOverdueParam = c.req.query('isOverdue');
  const searchParam = c.req.query('search');

  const classIdFilter = classIdParam ? parseInt(classIdParam, 10) : undefined;
  const isOverdueFilter = isOverdueParam === 'true';
  const todayStr = new Date().toISOString().slice(0, 10);

  // Fetch all fee items with student & class info
  const query = db
    .select({
      feeItemId: feeItems.id,
      studentId: feeItems.studentId,
      studentName: students.name,
      admissionNo: students.admissionNo,
      classId: feeItems.classId,
      className: classes.name,
      academicYearId: feeItems.academicYearId,
      academicYearName: academicYears.name,
      title: feeItems.title,
      amount: feeItems.amount,
      dueDate: feeItems.dueDate,
      remarks: feeItems.remarks,
      createdAt: feeItems.createdAt,
    })
    .from(feeItems)
    .innerJoin(students, eq(feeItems.studentId, students.id))
    .leftJoin(classes, eq(feeItems.classId, classes.id))
    .innerJoin(academicYears, eq(feeItems.academicYearId, academicYears.id))
    .orderBy(desc(feeItems.dueDate), desc(feeItems.id));

  const conditions = [];
  if (classIdFilter) {
    conditions.push(eq(feeItems.classId, classIdFilter));
  }
  if (searchParam) {
    conditions.push(like(students.name, `%${searchParam}%`));
  }

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const items = await query;

  // Fetch all payments for calculating totals
  const allPayments = await db.select().from(feePayments);
  const paymentsByItemMap = new Map<number, number>();

  allPayments.forEach((p) => {
    const current = paymentsByItemMap.get(p.feeItemId) || 0;
    paymentsByItemMap.set(p.feeItemId, current + p.amountPaid);
  });

  let totalCharged = 0;
  let totalCollected = 0;
  let totalPendingDues = 0;
  let overdueCount = 0;

  const duesList = items
    .map((item) => {
      const amountPaid = paymentsByItemMap.get(item.feeItemId) || 0;
      const balance = Math.max(0, item.amount - amountPaid);
      const isOverdue = item.dueDate < todayStr && balance > 0;

      totalCharged += item.amount;
      totalCollected += amountPaid;
      totalPendingDues += balance;
      if (isOverdue) overdueCount++;

      return {
        feeItemId: item.feeItemId,
        studentId: item.studentId,
        studentName: item.studentName,
        admissionNo: item.admissionNo,
        classId: item.classId,
        className: item.className,
        title: item.title,
        amount: item.amount,
        amountPaid,
        balance,
        dueDate: item.dueDate,
        isOverdue,
      };
    })
    .filter((item) => {
      if (isOverdueFilter) return item.isOverdue;
      return true;
    });

  return c.json({
    summary: {
      totalCharged,
      totalCollected,
      totalPendingDues,
      overdueCount,
      dues: duesList,
    },
  });
});

// POST /api/fees - Add fee items for student or whole class (FR-F1, FR-F5)
feesRouter.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  // 1. Bulk Class Fee Creation
  if (body.classId && !body.studentId) {
    const parseResult = createBulkClassFeeSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
    }

    const { classId, academicYearId, title, amount, dueDate, remarks } = parseResult.data;

    // Fetch active students in class
    const classStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.classId, classId), eq(students.status, 'active')));

    if (classStudents.length === 0) {
      return c.json({ error: 'No active students found in target class' }, 400);
    }

    const createdItems = [];
    for (const stu of classStudents) {
      const [inserted] = await db
        .insert(feeItems)
        .values({
          studentId: stu.id,
          classId,
          academicYearId,
          title,
          amount,
          dueDate,
          remarks: remarks || null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      createdItems.push(inserted);
    }

    // Write audit log (FR-F5)
    await db.insert(auditLog).values({
      userId: user.id,
      action: 'BULK_CREATE_FEE_ITEMS',
      entity: 'fee_items',
      entityId: classId,
      details: JSON.stringify({
        classId,
        title,
        amount,
        dueDate,
        studentsCount: classStudents.length,
      }),
      createdAt: now,
    });

    return c.json(
      {
        message: `Fee item created successfully for ${classStudents.length} students`,
        createdCount: classStudents.length,
      },
      201
    );
  }

  // 2. Single Student Fee Creation
  const parseResult = createFeeItemSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { studentId, title, amount, dueDate, academicYearId, remarks } = parseResult.data;
  if (!studentId) {
    return c.json({ error: 'Either studentId or classId must be provided' }, 400);
  }

  // Fetch Student to get classId if not provided
  const [studentRec] = await db.select().from(students).where(eq(students.id, studentId));
  if (!studentRec) {
    return c.json({ error: 'Student record not found' }, 404);
  }

  const targetClassId = parseResult.data.classId || studentRec.classId;

  const [inserted] = await db
    .insert(feeItems)
    .values({
      studentId,
      classId: targetClassId,
      academicYearId,
      title,
      amount,
      dueDate,
      remarks: remarks || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Write audit log (FR-F5)
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'CREATE_FEE_ITEM',
    entity: 'fee_items',
    entityId: inserted.id,
    details: JSON.stringify({
      feeItemId: inserted.id,
      studentId,
      title,
      amount,
      dueDate,
    }),
    createdAt: now,
  });

  return c.json({ message: 'Fee item created successfully', feeItem: inserted }, 201);
});

// PATCH /api/fees/:id - Edit fee item (FR-F5, Admin only)
feesRouter.patch('/:id', async (c) => {
  const feeItemId = parseInt(c.req.param('id'), 10);
  if (isNaN(feeItemId)) return c.json({ error: 'Invalid fee item ID' }, 400);

  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  const db = drizzle(c.env.DB);
  const [existing] = await db.select().from(feeItems).where(eq(feeItems.id, feeItemId));
  if (!existing) {
    return c.json({ error: 'Fee item not found' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateFeeItemSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = { updatedAt: now };

  if (parseResult.data.title !== undefined) updatePayload.title = parseResult.data.title;
  if (parseResult.data.amount !== undefined) updatePayload.amount = parseResult.data.amount;
  if (parseResult.data.dueDate !== undefined) updatePayload.dueDate = parseResult.data.dueDate;
  if (parseResult.data.remarks !== undefined) updatePayload.remarks = parseResult.data.remarks;

  const [updated] = await db
    .update(feeItems)
    .set(updatePayload)
    .where(eq(feeItems.id, feeItemId))
    .returning();

  // Audit Log (FR-F5)
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'UPDATE_FEE_ITEM',
    entity: 'fee_items',
    entityId: feeItemId,
    details: JSON.stringify({
      feeItemId,
      previous: existing,
      updated,
    }),
    createdAt: now,
  });

  return c.json({ message: 'Fee item updated successfully', feeItem: updated });
});

// DELETE /api/fees/:id - Delete fee item (FR-F5, Admin only)
feesRouter.delete('/:id', async (c) => {
  const feeItemId = parseInt(c.req.param('id'), 10);
  if (isNaN(feeItemId)) return c.json({ error: 'Invalid fee item ID' }, 400);

  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  const db = drizzle(c.env.DB);
  const [existing] = await db.select().from(feeItems).where(eq(feeItems.id, feeItemId));
  if (!existing) {
    return c.json({ error: 'Fee item not found' }, 404);
  }

  await db.delete(feeItems).where(eq(feeItems.id, feeItemId));

  const now = new Date().toISOString();
  // Audit Log (FR-F5)
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'DELETE_FEE_ITEM',
    entity: 'fee_items',
    entityId: feeItemId,
    details: JSON.stringify(existing),
    createdAt: now,
  });

  return c.json({ message: 'Fee item deleted successfully' });
});

// POST /api/fees/payments - Record payment against fee item (FR-F2, FR-F5, Admin only)
feesRouter.post('/payments', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = recordPaymentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { feeItemId, studentId, amountPaid, paymentDate, receiptNo, paymentMethod, remarks } =
    parseResult.data;
  const db = drizzle(c.env.DB);

  // Verify Fee Item exists
  const [feeItemRec] = await db.select().from(feeItems).where(eq(feeItems.id, feeItemId));
  if (!feeItemRec) {
    return c.json({ error: 'Fee item not found' }, 404);
  }

  const now = new Date().toISOString();
  const [payment] = await db
    .insert(feePayments)
    .values({
      feeItemId,
      studentId,
      amountPaid,
      paymentDate,
      receiptNo,
      paymentMethod,
      remarks: remarks || null,
      recordedBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Audit Log (FR-F5)
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'RECORD_FEE_PAYMENT',
    entity: 'fee_payments',
    entityId: payment.id,
    details: JSON.stringify({
      paymentId: payment.id,
      feeItemId,
      studentId,
      amountPaid,
      receiptNo,
      paymentDate,
      paymentMethod,
    }),
    createdAt: now,
  });

  return c.json({ message: 'Payment recorded successfully', payment }, 201);
});

// DELETE /api/fees/payments/:id - Delete payment entry (FR-F5, Admin only)
feesRouter.delete('/payments/:id', async (c) => {
  const paymentId = parseInt(c.req.param('id'), 10);
  if (isNaN(paymentId)) return c.json({ error: 'Invalid payment ID' }, 400);

  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  const db = drizzle(c.env.DB);
  const [existing] = await db.select().from(feePayments).where(eq(feePayments.id, paymentId));
  if (!existing) {
    return c.json({ error: 'Payment record not found' }, 404);
  }

  await db.delete(feePayments).where(eq(feePayments.id, paymentId));

  const now = new Date().toISOString();
  // Audit Log (FR-F5)
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'DELETE_FEE_PAYMENT',
    entity: 'fee_payments',
    entityId: paymentId,
    details: JSON.stringify(existing),
    createdAt: now,
  });

  return c.json({ message: 'Payment record deleted successfully' });
});

// Helper function to fetch comprehensive student fee summary
async function fetchStudentFeeSummary(db: any, studentId: number, c: any) {
  const [studentRec] = await db
    .select({
      id: students.id,
      name: students.name,
      admissionNo: students.admissionNo,
      classId: students.classId,
      phone: students.phone,
      className: classes.name,
    })
    .from(students)
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(eq(students.id, studentId));

  if (!studentRec) {
    return c.json({ error: 'Student not found' }, 404);
  }

  // Fetch all fee items for student
  const items = await db
    .select({
      id: feeItems.id,
      studentId: feeItems.studentId,
      classId: feeItems.classId,
      academicYearId: feeItems.academicYearId,
      academicYearName: academicYears.name,
      title: feeItems.title,
      amount: feeItems.amount,
      dueDate: feeItems.dueDate,
      remarks: feeItems.remarks,
      createdAt: feeItems.createdAt,
      updatedAt: feeItems.updatedAt,
    })
    .from(feeItems)
    .innerJoin(academicYears, eq(feeItems.academicYearId, academicYears.id))
    .where(eq(feeItems.studentId, studentId))
    .orderBy(desc(feeItems.dueDate));

  // Fetch all payments for student
  const payments = await db
    .select({
      id: feePayments.id,
      feeItemId: feePayments.feeItemId,
      studentId: feePayments.studentId,
      amountPaid: feePayments.amountPaid,
      paymentDate: feePayments.paymentDate,
      receiptNo: feePayments.receiptNo,
      paymentMethod: feePayments.paymentMethod,
      remarks: feePayments.remarks,
      recordedBy: feePayments.recordedBy,
      recordedByName: users.email,
      createdAt: feePayments.createdAt,
      updatedAt: feePayments.updatedAt,
    })
    .from(feePayments)
    .innerJoin(users, eq(feePayments.recordedBy, users.id))
    .where(eq(feePayments.studentId, studentId))
    .orderBy(desc(feePayments.paymentDate));

  const paymentsMap = new Map<number, any[]>();
  payments.forEach((p: any) => {
    const list = paymentsMap.get(p.feeItemId) || [];
    list.push(p);
    paymentsMap.set(p.feeItemId, list);
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  let totalCharged = 0;
  let totalPaid = 0;
  let overdueCount = 0;

  const itemDTOs = items.map((item: any) => {
    const itemPayments = paymentsMap.get(item.id) || [];
    const amountPaid = itemPayments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);
    const balance = Math.max(0, item.amount - amountPaid);
    const isOverdue = item.dueDate < todayStr && balance > 0;

    totalCharged += item.amount;
    totalPaid += amountPaid;
    if (isOverdue) overdueCount++;

    return {
      ...item,
      className: studentRec.className,
      amountPaid,
      balance,
      isOverdue,
      payments: itemPayments,
    };
  });

  const balance = Math.max(0, totalCharged - totalPaid);

  return c.json({
    student: studentRec,
    totals: {
      totalCharged,
      totalPaid,
      balance,
      overdueCount,
    },
    feeItems: itemDTOs,
  });
}

export default feesRouter;
