import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, and } from 'drizzle-orm';
import { users, teachers, students, classTeachers, classes } from '../db/schema';
import { UserDTO } from '../../shared/types';

export async function getTeacherByUserId(
  db: ReturnType<typeof drizzle>,
  userId: number
) {
  const results = await db
    .select()
    .from(teachers)
    .where(eq(teachers.userId, userId));
  return results[0] || null;
}

export async function getStudentByUserId(
  db: ReturnType<typeof drizzle>,
  userId: number
) {
  const results = await db
    .select()
    .from(students)
    .where(eq(students.userId, userId));
  return results[0] || null;
}

export async function getTeacherAssignedClassIds(
  db: ReturnType<typeof drizzle>,
  teacherUserId: number
): Promise<number[]> {
  const teacher = await getTeacherByUserId(db, teacherUserId);
  if (!teacher) return [];

  const classTeacherRecords = await db
    .select({ classId: classTeachers.classId })
    .from(classTeachers)
    .where(eq(classTeachers.teacherId, teacher.id));

  return classTeacherRecords.map((r) => r.classId);
}

export async function canTeacherAccessClass(
  db: ReturnType<typeof drizzle>,
  teacherUserId: number,
  classId: number
): Promise<boolean> {
  const assignedClassIds = await getTeacherAssignedClassIds(db, teacherUserId);
  return assignedClassIds.includes(classId);
}

export async function canTeacherAccessStudent(
  db: ReturnType<typeof drizzle>,
  teacherUserId: number,
  studentId: number
): Promise<boolean> {
  const assignedClassIds = await getTeacherAssignedClassIds(db, teacherUserId);
  if (assignedClassIds.length === 0) return false;

  const targetStudent = await db
    .select({ classId: students.classId })
    .from(students)
    .where(eq(students.id, studentId));

  if (targetStudent.length === 0 || !targetStudent[0].classId) return false;
  return assignedClassIds.includes(targetStudent[0].classId);
}

export async function checkStudentAccess(
  db: ReturnType<typeof drizzle>,
  user: UserDTO,
  targetStudentId: number
): Promise<{ allowed: boolean; student?: typeof students.$inferSelect; reason?: string }> {
  const targetStudentResults = await db
    .select()
    .from(students)
    .where(eq(students.id, targetStudentId));

  if (targetStudentResults.length === 0) {
    return { allowed: false, reason: 'Student not found' };
  }

  const student = targetStudentResults[0];

  // 1. Admin has full access
  if (user.role === 'admin') {
    return { allowed: true, student };
  }

  // 2. Student can only access their own record
  if (user.role === 'student') {
    if (student.userId === user.id) {
      return { allowed: true, student };
    }
    return { allowed: false, reason: 'Students can only view their own record' };
  }

  // 3. Teacher can only access students in their assigned classes
  if (user.role === 'teacher') {
    if (!student.classId) {
      return { allowed: false, reason: 'Student is unassigned to any class' };
    }
    const isAssigned = await canTeacherAccessClass(db, user.id, student.classId);
    if (isAssigned) {
      return { allowed: true, student };
    }
    return { allowed: false, reason: 'Teachers can only access students in their assigned classes' };
  }

  return { allowed: false, reason: 'Unauthorized access' };
}

export async function checkClassAccess(
  db: ReturnType<typeof drizzle>,
  user: UserDTO,
  targetClassId: number
): Promise<{ allowed: boolean; reason?: string }> {
  // Admin has full access
  if (user.role === 'admin') {
    return { allowed: true };
  }

  // Teacher can access assigned classes
  if (user.role === 'teacher') {
    const isAssigned = await canTeacherAccessClass(db, user.id, targetClassId);
    if (isAssigned) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Teachers can only access their assigned classes' };
  }

  // Student can access their own class
  if (user.role === 'student') {
    const student = await getStudentByUserId(db, user.id);
    if (student && student.classId === targetClassId) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Students can only access their own class information' };
  }

  return { allowed: false, reason: 'Unauthorized access' };
}
