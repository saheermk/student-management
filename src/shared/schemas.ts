import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'teacher', 'student']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  environment: z.string().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Phase 1 Auth Schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const createUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: UserRoleSchema,
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  mustChangePassword: z.boolean().optional().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const adminResetPasswordSchema = z.object({
  temporaryPassword: z.string().min(6, 'Password must be at least 6 characters').optional(),
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

// Phase 2 Academic & People Schemas

export const createAcademicYearSchema = z.object({
  name: z.string().min(1, 'Academic year name is required'),
  isCurrent: z.boolean().optional().default(false),
});
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

export const updateAcademicYearSchema = z.object({
  name: z.string().min(1).optional(),
  isCurrent: z.boolean().optional(),
});
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  academicYearId: z.number().int().positive('Academic year is required'),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  academicYearId: z.number().int().positive().optional(),
});
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

export const deleteClassSchema = z.object({
  deleteStudents: z.boolean().default(false),
});
export type DeleteClassInput = z.infer<typeof deleteClassSchema>;

export const createSubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  classId: z.number().int().positive('Class ID is required'),
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const subjectCsvRowSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  class: z.string().optional().default(''),
});
export type SubjectCsvRow = z.infer<typeof subjectCsvRowSchema>;

export const subjectCsvPreviewSchema = z.object({
  csvContent: z.string().min(1, 'CSV content is required'),
  classId: z.number().int().positive().optional(),
});
export type SubjectCsvPreviewInput = z.infer<typeof subjectCsvPreviewSchema>;

export const subjectCsvExecuteSchema = z.object({
  classId: z.number().int().positive('Class ID is required'),
  rows: z.array(z.object({ name: z.string().min(1, 'Subject name is required') })).min(1, 'At least one subject is required'),
});
export type SubjectCsvExecuteInput = z.infer<typeof subjectCsvExecuteSchema>;

export const createTeacherSchema = z.object({
  name: z.string().min(1, 'Teacher name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const updateTeacherSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
});
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

export const assignClassTeacherSchema = z.object({
  classId: z.number().int().positive('Class ID is required'),
  teacherId: z.number().int().positive('Teacher ID is required'),
});
export type AssignClassTeacherInput = z.infer<typeof assignClassTeacherSchema>;

export const createStudentSchema = z.object({
  name: z.string().min(1, 'Student name is required'),
  admissionNo: z.string().min(1, 'Admission number is required'),
  email: z.string().email('Please enter a valid email address'),
  classId: z.number().int().positive('Class ID is required'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  admissionNo: z.string().min(1).optional(),
  classId: z.number().int().positive().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const csvImportRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  admissionNo: z.string().min(1, 'Admission number is required'),
  email: z.string().email('Valid email address is required'),
  class: z.string().min(1, 'Class name is required'),
  phone: z.string().optional().default(''),
});
export type CsvImportRow = z.infer<typeof csvImportRowSchema>;

export const csvPreviewRequestSchema = z.object({
  csvContent: z.string().min(1, 'CSV content is required'),
});
export type CsvPreviewRequest = z.infer<typeof csvPreviewRequestSchema>;

export const csvExecuteImportSchema = z.object({
  rows: z.array(csvImportRowSchema).min(1, 'At least one row is required for import'),
});
export type CsvExecuteImportInput = z.infer<typeof csvExecuteImportSchema>;

export const promoteClassSchema = z.object({
  sourceClassId: z.number().int().positive('Source class ID is required'),
  targetClassId: z.number().int().positive('Target class ID is required'),
});
export type PromoteClassInput = z.infer<typeof promoteClassSchema>;

// Phase 3: Attendance Schemas

export const AttendanceStatusSchema = z.enum(['present', 'absent', 'late', 'leave']);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

export const markAttendanceRecordSchema = z.object({
  studentId: z.number().int().positive('Student ID is required'),
  status: AttendanceStatusSchema,
});
export type MarkAttendanceRecordInput = z.infer<typeof markAttendanceRecordSchema>;

export const markAttendanceSchema = z.object({
  classId: z.number().int().positive('Class ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  records: z.array(markAttendanceRecordSchema).min(1, 'At least one student record is required'),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const attendanceFilterSchema = z.object({
  classId: z.number().int().positive().optional(),
  studentId: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type AttendanceFilterInput = z.infer<typeof attendanceFilterSchema>;

// Phase 4: Exams & Progress Card Schemas

export const ExamTypeSchema = z.enum(['monthly', 'semester', 'degree']);
export type ExamType = z.infer<typeof ExamTypeSchema>;

export const createExamSchema = z.object({
  classId: z.number().int().positive('Class is required'),
  type: ExamTypeSchema,
  name: z.string().min(1, 'Exam name is required'),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  academicYearId: z.number().int().positive('Academic year is required'),
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

export const enterExamMarksRecordSchema = z.object({
  studentId: z.number().int().positive('Student ID is required'),
  subjectId: z.number().int().positive('Subject ID is required'),
  marks: z.number().int().min(0, 'Marks must be non-negative'),
  maxMarks: z.number().int().positive('Max marks must be positive').default(50),
  remarks: z.string().optional(),
});
export type EnterExamMarksRecordInput = z.infer<typeof enterExamMarksRecordSchema>;

export const enterExamMarksSchema = z.object({
  examId: z.number().int().positive('Exam ID is required').optional(),
  records: z.array(enterExamMarksRecordSchema).min(1, 'At least one mark record is required'),
});
export type EnterExamMarksInput = z.infer<typeof enterExamMarksSchema>;

export const gradeBoundarySchema = z.object({
  grade: z.string().min(1, 'Grade text is required'),
  minPercentage: z.number().int().min(0).max(100),
  maxPercentage: z.number().int().min(0).max(100),
  classification: z.string().optional(),
  isPass: z.boolean().default(true),
});
export type GradeBoundaryInput = z.infer<typeof gradeBoundarySchema>;

// Phase 5: Fee Register Schemas

export const PaymentMethodSchema = z.enum(['cash', 'online', 'bank_transfer', 'upi', 'cheque']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const createFeeItemSchema = z.object({
  title: z.string().min(1, 'Fee title is required'),
  amount: z.number().int().positive('Amount must be positive'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  academicYearId: z.number().int().positive('Academic year is required'),
  studentId: z.number().int().positive().optional(),
  classId: z.number().int().positive().optional(),
  remarks: z.string().optional(),
});
export type CreateFeeItemInput = z.infer<typeof createFeeItemSchema>;

export const createBulkClassFeeSchema = z.object({
  title: z.string().min(1, 'Fee title is required'),
  amount: z.number().int().positive('Amount must be positive'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  academicYearId: z.number().int().positive('Academic year is required'),
  classId: z.number().int().positive('Class is required'),
  remarks: z.string().optional(),
});
export type CreateBulkClassFeeInput = z.infer<typeof createBulkClassFeeSchema>;

export const recordPaymentSchema = z.object({
  feeItemId: z.number().int().positive('Fee item is required'),
  studentId: z.number().int().positive('Student ID is required'),
  amountPaid: z.number().int().positive('Payment amount must be positive'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  receiptNo: z.string().min(1, 'Receipt number is required'),
  paymentMethod: PaymentMethodSchema.default('cash'),
  remarks: z.string().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const updateFeeItemSchema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().int().positive().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  remarks: z.string().optional(),
});
export type UpdateFeeItemInput = z.infer<typeof updateFeeItemSchema>;

// Phase 6: Leave Register Schemas

export const LeaveStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type LeaveStatus = z.infer<typeof LeaveStatusSchema>;

export const createLeaveSchema = z
  .object({
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format'),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format'),
    reason: z.string().min(1, 'Reason is required'),
  })
  .refine((data) => data.fromDate <= data.toDate, {
    message: 'From date cannot be after To date',
    path: ['toDate'],
  });
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;

export const directLeaveSchema = z
  .object({
    studentId: z.number().int().positive('Student ID is required'),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format'),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format'),
    reason: z.string().min(1, 'Reason is required'),
    decisionNote: z.string().optional(),
  })
  .refine((data) => data.fromDate <= data.toDate, {
    message: 'From date cannot be after To date',
    path: ['toDate'],
  });
export type DirectLeaveInput = z.infer<typeof directLeaveSchema>;

export const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  decisionNote: z.string().optional(),
});
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;

// Institution Settings Schema
export const updateSettingsSchema = z.object({
  institutionName: z.string().min(1, 'Institution name is required'),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;



