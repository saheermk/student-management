import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'teacher', 'student'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const loginAttempts = sqliteTable('login_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  identifier: text('identifier').notNull(),
  attemptedAt: text('attempted_at').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
});

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  details: text('details'),
  createdAt: text('created_at').notNull(),
});

// Phase 2: Academic & People Tables

export const academicYears = sqliteTable('academic_years', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const teachers = sqliteTable('teachers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const classTeachers = sqliteTable(
  'class_teachers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    teacherId: integer('teacher_id').notNull().references(() => teachers.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    classTeacherUnique: uniqueIndex('class_teacher_unique').on(table.classId, table.teacherId),
  })
);

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  admissionNo: text('admission_no').notNull().unique(),
  name: text('name').notNull(),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  phone: text('phone'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Phase 3: Attendance Register
export const attendance = sqliteTable(
  'attendance',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
    date: text('date').notNull(), // ISO YYYY-MM-DD
    status: text('status', { enum: ['present', 'absent', 'late', 'leave'] }).notNull().default('present'),
    markedBy: integer('marked_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    studentDateUnique: uniqueIndex('attendance_student_date_unique').on(table.studentId, table.date),
  })
);

// Phase 4: Progress Card & Exams Tables
export const exams = sqliteTable('exams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['monthly', 'semester', 'degree'] }).notNull(),
  name: text('name').notNull(),
  examDate: text('exam_date').notNull(), // ISO YYYY-MM-DD
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const examMarks = sqliteTable(
  'exam_marks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    examId: integer('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
    studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
    marks: integer('marks').notNull(),
    maxMarks: integer('max_marks').notNull().default(50),
    remarks: text('remarks'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    examStudentSubjectUnique: uniqueIndex('exam_student_subject_unique').on(
      table.examId,
      table.studentId,
      table.subjectId
    ),
  })
);

export const gradeBoundaries = sqliteTable('grade_boundaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grade: text('grade').notNull(), // e.g., 'A+', 'A', 'B', 'C', 'D', 'F'
  minPercentage: integer('min_percentage').notNull(),
  maxPercentage: integer('max_percentage').notNull(),
  classification: text('classification'), // e.g., 'Top Plus', 'Distinction', 'First Class'
  isPass: integer('is_pass', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Phase 5: Fee Register Tables
export const feeItems = sqliteTable('fee_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  dueDate: text('due_date').notNull(), // ISO YYYY-MM-DD
  remarks: text('remarks'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const feePayments = sqliteTable('fee_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  feeItemId: integer('fee_item_id').notNull().references(() => feeItems.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  amountPaid: integer('amount_paid').notNull(),
  paymentDate: text('payment_date').notNull(), // ISO YYYY-MM-DD
  receiptNo: text('receipt_no').notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'),
  remarks: text('remarks'),
  recordedBy: integer('recorded_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Phase 6: Leave Register Table
export const leaves = sqliteTable('leaves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  fromDate: text('from_date').notNull(), // ISO YYYY-MM-DD
  toDate: text('to_date').notNull(), // ISO YYYY-MM-DD
  reason: text('reason').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  requestedBy: integer('requested_by').notNull().references(() => users.id),
  decidedBy: integer('decided_by').references(() => users.id),
  decidedAt: text('decided_at'),
  decisionNote: text('decision_note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Institution Settings Table
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});



