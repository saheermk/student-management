import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { users, teachers, classTeachers, classes } from '../db/schema';
import { createTeacherSchema, updateTeacherSchema } from '../../shared/schemas';
import { hashPassword, generateRandomToken } from '../lib/crypto';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const teachersRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

teachersRouter.use('*', authMiddleware);

// GET /api/teachers (Admin lists all teachers; Teacher gets own record)
teachersRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: students cannot access teachers list' }, 403);
  }

  const query = db
    .select({
      id: teachers.id,
      userId: teachers.userId,
      email: users.email,
      name: teachers.name,
      phone: teachers.phone,
      createdAt: teachers.createdAt,
      updatedAt: teachers.updatedAt,
    })
    .from(teachers)
    .innerJoin(users, eq(teachers.userId, users.id))
    .orderBy(desc(teachers.createdAt));

  if (user.role === 'teacher') {
    query.where(eq(teachers.userId, user.id));
  }

  const teacherRecords = await query;

  // Enrich with assigned class names
  const result = await Promise.all(
    teacherRecords.map(async (t) => {
      const assignedClasses = await db
        .select({
          classId: classes.id,
          className: classes.name,
        })
        .from(classTeachers)
        .innerJoin(classes, eq(classTeachers.classId, classes.id))
        .where(eq(classTeachers.teacherId, t.id));

      return {
        ...t,
        assignedClassIds: assignedClasses.map((c) => c.classId),
        assignedClassNames: assignedClasses.map((c) => c.className),
      };
    })
  );

  return c.json({ teachers: result });
});

// POST /api/teachers (Admin creates new teacher user & profile)
teachersRouter.post('/', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createTeacherSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, email, phone, password } = parseResult.data;
  const db = drizzle(c.env.DB);

  // Check email existence
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (existingUser.length > 0) {
    return c.json({ error: 'User with this email address already exists' }, 409);
  }

  const generatedTempPass = password || `Temp${generateRandomToken(4)}!`;
  const passwordHash = await hashPassword(generatedTempPass);
  const now = new Date().toISOString();

  // 1. Create User account (role: teacher)
  const [createdUser] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      role: 'teacher',
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // 2. Create Teacher record
  const [createdTeacher] = await db
    .insert(teachers)
    .values({
      userId: createdUser.id,
      name,
      phone: phone || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json(
    {
      teacher: {
        ...createdTeacher,
        email: createdUser.email,
      },
      temporaryPassword: password ? undefined : generatedTempPass,
      message: 'Teacher profile and account created successfully',
    },
    201
  );
});

export default teachersRouter;
