import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { checkClassAccess, checkStudentAccess, getStudentByUserId, getTeacherAssignedClassIds } from '../lib/scope';
import { attendance, exams, examMarks, subjects, classes, students } from '../db/schema';
import { ClassAnalyticsDTO, StudentAnalyticsDTO, ChartPieDataItem, AttendanceDailyTrendItem, ExamSubjectAverageItem, ExamTrendItem, GradeDistributionItem } from '../../shared/types';

const analyticsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

analyticsRouter.use('*', authMiddleware);

/**
 * Helper to compute grade letter from percentage score
 */
function getGradeLetter(percentage: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

/**
 * GET /api/analytics/class/:classId
 * Permission: Admin (all), Teacher (assigned classes only), Student (403 forbidden)
 */
analyticsRouter.get('/class/:classId', async (c) => {
  const user = c.get('user');
  const classId = parseInt(c.req.param('classId'), 10);

  if (isNaN(classId)) {
    return c.json({ error: 'Invalid class ID' }, 400);
  }

  const db = drizzle(c.env.DB);

  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students are restricted to their own performance analytics' }, 403);
  }

  // Enforce server-side role & class-scope access
  const access = await checkClassAccess(db, user, classId);
  if (!access.allowed) {
    return c.json({ error: access.reason || 'Forbidden: Insufficient permissions for this class' }, 403);
  }

  // Fetch Class Info
  const classRecords = await db.select().from(classes).where(eq(classes.id, classId));
  if (classRecords.length === 0) {
    return c.json({ error: 'Class not found' }, 404);
  }
  const classInfo = classRecords[0];

  // Fetch student count
  const classStudents = await db.select().from(students).where(eq(students.classId, classId));
  const studentCount = classStudents.length;

  // 1. Attendance Analytics
  const classAttendance = await db
    .select()
    .from(attendance)
    .where(eq(attendance.classId, classId))
    .orderBy(asc(attendance.date));

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;

  const dateTrendMap: Record<string, { present: number; absent: number; late: number; leave: number; total: number }> = {};

  classAttendance.forEach((rec) => {
    if (rec.status === 'present') presentCount++;
    else if (rec.status === 'absent') absentCount++;
    else if (rec.status === 'late') lateCount++;
    else if (rec.status === 'leave') leaveCount++;

    if (!dateTrendMap[rec.date]) {
      dateTrendMap[rec.date] = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    }
    dateTrendMap[rec.date][rec.status]++;
    dateTrendMap[rec.date].total++;
  });

  const totalRecords = classAttendance.length;
  const attendanceRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 1000) / 10 : 0;

  const dailyTrend: AttendanceDailyTrendItem[] = Object.entries(dateTrendMap).map(([date, counts]) => ({
    date,
    present: counts.present,
    absent: counts.absent,
    late: counts.late,
    leave: counts.leave,
    rate: counts.total > 0 ? Math.round(((counts.present + counts.late) / counts.total) * 100) : 0,
  }));

  const attendanceDistribution: ChartPieDataItem[] = [
    { name: 'Present', value: presentCount, color: '#10b981' },
    { name: 'Absent', value: absentCount, color: '#ef4444' },
    { name: 'Late', value: lateCount, color: '#f59e0b' },
    { name: 'Leave', value: leaveCount, color: '#6366f1' },
  ];

  // 2. Exam Performance Analytics
  const classExams = await db.select().from(exams).where(eq(exams.classId, classId));
  const examIds = classExams.map((e) => e.id);

  let subjectAverages: ExamSubjectAverageItem[] = [];
  let examTrends: ExamTrendItem[] = [];
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  if (examIds.length > 0) {
    const marksRecords = await db
      .select({
        examId: examMarks.examId,
        subjectId: examMarks.subjectId,
        subjectName: subjects.name,
        examName: exams.name,
        examDate: exams.examDate,
        marks: examMarks.marks,
        maxMarks: examMarks.maxMarks,
      })
      .from(examMarks)
      .innerJoin(exams, eq(examMarks.examId, exams.id))
      .innerJoin(subjects, eq(examMarks.subjectId, subjects.id))
      .where(inArray(examMarks.examId, examIds));

    // Aggregate by subject
    const subjectMap: Record<string, { totalPct: number; count: number; totalMarks: number; totalMax: number }> = {};
    // Aggregate by exam
    const examMap: Record<string, { examName: string; date: string; totalPct: number; count: number }> = {};

    marksRecords.forEach((m) => {
      const pct = m.maxMarks > 0 ? (m.marks / m.maxMarks) * 100 : 0;
      const grade = getGradeLetter(pct);
      gradeCounts[grade]++;

      // Subject stats
      if (!subjectMap[m.subjectName]) {
        subjectMap[m.subjectName] = { totalPct: 0, count: 0, totalMarks: 0, totalMax: 0 };
      }
      subjectMap[m.subjectName].totalPct += pct;
      subjectMap[m.subjectName].count++;
      subjectMap[m.subjectName].totalMarks += m.marks;
      subjectMap[m.subjectName].totalMax += m.maxMarks;

      // Exam stats
      const examKey = `${m.examId}`;
      if (!examMap[examKey]) {
        examMap[examKey] = { examName: m.examName, date: m.examDate, totalPct: 0, count: 0 };
      }
      examMap[examKey].totalPct += pct;
      examMap[examKey].count++;
    });

    subjectAverages = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      avgMarks: Math.round((data.totalMarks / data.count) * 10) / 10,
      maxMarks: Math.round((data.totalMax / data.count) * 10) / 10,
      percentage: Math.round((data.totalPct / data.count) * 10) / 10,
    }));

    examTrends = Object.values(examMap).map((data) => ({
      examName: data.examName,
      date: data.date,
      avgPercentage: Math.round((data.totalPct / data.count) * 10) / 10,
    }));
  }

  const gradeDistribution: GradeDistributionItem[] = [
    { grade: 'A (>=80%)', count: gradeCounts.A, color: '#10b981' },
    { grade: 'B (70-79%)', count: gradeCounts.B, color: '#3b82f6' },
    { grade: 'C (60-69%)', count: gradeCounts.C, color: '#6366f1' },
    { grade: 'D (50-59%)', count: gradeCounts.D, color: '#f59e0b' },
    { grade: 'F (<50%)', count: gradeCounts.F, color: '#ef4444' },
  ];

  const responseData: ClassAnalyticsDTO = {
    classId,
    className: classInfo.name,
    studentCount,
    attendanceSummary: {
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      attendanceRate,
      dailyTrend,
      distribution: attendanceDistribution,
    },
    examPerformance: {
      subjectAverages,
      examTrends,
      gradeDistribution,
    },
  };

  return c.json(responseData);
});

/**
 * GET /api/analytics/student/:studentId
 * Permission: Admin (all), Teacher (students in assigned classes only), Student (own studentId only)
 */
analyticsRouter.get('/student/:studentId', async (c) => {
  const user = c.get('user');
  const studentId = parseInt(c.req.param('studentId'), 10);

  if (isNaN(studentId)) {
    return c.json({ error: 'Invalid student ID' }, 400);
  }

  const db = drizzle(c.env.DB);

  // Enforce server-side student authorization
  const access = await checkStudentAccess(db, user, studentId);
  if (!access.allowed || !access.student) {
    return c.json({ error: access.reason || 'Forbidden: Insufficient permissions for this student' }, 403);
  }

  const targetStudent = access.student;

  // Fetch Class Info if student belongs to a class
  let className: string | null = null;
  if (targetStudent.classId) {
    const classRec = await db.select().from(classes).where(eq(classes.id, targetStudent.classId));
    if (classRec.length > 0) {
      className = classRec[0].name;
    }
  }

  // 1. Student Attendance Analytics
  const studentAttendance = await db
    .select()
    .from(attendance)
    .where(eq(attendance.studentId, studentId))
    .orderBy(asc(attendance.date));

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;

  const dailyTrend: AttendanceDailyTrendItem[] = studentAttendance.map((rec) => {
    if (rec.status === 'present') presentCount++;
    else if (rec.status === 'absent') absentCount++;
    else if (rec.status === 'late') lateCount++;
    else if (rec.status === 'leave') leaveCount++;

    const statusRate = rec.status === 'present' ? 100 : rec.status === 'late' ? 50 : 0;
    return {
      date: rec.date,
      present: rec.status === 'present' ? 1 : 0,
      absent: rec.status === 'absent' ? 1 : 0,
      late: rec.status === 'late' ? 1 : 0,
      leave: rec.status === 'leave' ? 1 : 0,
      rate: statusRate,
    };
  });

  const totalRecords = studentAttendance.length;
  const attendanceRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 1000) / 10 : 0;

  const attendanceDistribution: ChartPieDataItem[] = [
    { name: 'Present', value: presentCount, color: '#10b981' },
    { name: 'Absent', value: absentCount, color: '#ef4444' },
    { name: 'Late', value: lateCount, color: '#f59e0b' },
    { name: 'Leave', value: leaveCount, color: '#6366f1' },
  ];

  // 2. Student Exam Marks Performance
  const marksRecords = await db
    .select({
      examId: examMarks.examId,
      subjectId: examMarks.subjectId,
      subjectName: subjects.name,
      examName: exams.name,
      examDate: exams.examDate,
      marks: examMarks.marks,
      maxMarks: examMarks.maxMarks,
    })
    .from(examMarks)
    .innerJoin(exams, eq(examMarks.examId, exams.id))
    .innerJoin(subjects, eq(examMarks.subjectId, subjects.id))
    .where(eq(examMarks.studentId, studentId))
    .orderBy(asc(exams.examDate));

  const subjectMap: Record<string, { totalMarks: number; totalMax: number; count: number; totalPct: number }> = {};
  const examMap: Record<string, { examName: string; date: string; totalMarks: number; totalMax: number; count: number }> = {};
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  marksRecords.forEach((m) => {
    const pct = m.maxMarks > 0 ? (m.marks / m.maxMarks) * 100 : 0;
    const grade = getGradeLetter(pct);
    gradeCounts[grade]++;

    // Subject breakdown
    if (!subjectMap[m.subjectName]) {
      subjectMap[m.subjectName] = { totalMarks: 0, totalMax: 0, count: 0, totalPct: 0 };
    }
    subjectMap[m.subjectName].totalMarks += m.marks;
    subjectMap[m.subjectName].totalMax += m.maxMarks;
    subjectMap[m.subjectName].totalPct += pct;
    subjectMap[m.subjectName].count++;

    // Exam timeline breakdown
    const examKey = `${m.examId}`;
    if (!examMap[examKey]) {
      examMap[examKey] = { examName: m.examName, date: m.examDate, totalMarks: 0, totalMax: 0, count: 0 };
    }
    examMap[examKey].totalMarks += m.marks;
    examMap[examKey].totalMax += m.maxMarks;
    examMap[examKey].count++;
  });

  const subjectScores: ExamSubjectAverageItem[] = Object.entries(subjectMap).map(([subject, data]) => ({
    subject,
    avgMarks: Math.round((data.totalMarks / data.count) * 10) / 10,
    maxMarks: Math.round((data.totalMax / data.count) * 10) / 10,
    percentage: Math.round((data.totalPct / data.count) * 10) / 10,
  }));

  const examHistory: ExamTrendItem[] = Object.values(examMap).map((data) => ({
    examName: data.examName,
    date: data.date,
    avgPercentage: data.totalMax > 0 ? Math.round((data.totalMarks / data.totalMax) * 1000) / 10 : 0,
  }));

  const gradeDistribution: GradeDistributionItem[] = [
    { grade: 'A (>=80%)', count: gradeCounts.A, color: '#10b981' },
    { grade: 'B (70-79%)', count: gradeCounts.B, color: '#3b82f6' },
    { grade: 'C (60-69%)', count: gradeCounts.C, color: '#6366f1' },
    { grade: 'D (50-59%)', count: gradeCounts.D, color: '#f59e0b' },
    { grade: 'F (<50%)', count: gradeCounts.F, color: '#ef4444' },
  ];

  const responseData: StudentAnalyticsDTO = {
    studentId,
    studentName: targetStudent.name,
    admissionNo: targetStudent.admissionNo,
    classId: targetStudent.classId,
    className,
    attendanceSummary: {
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      attendanceRate,
      dailyTrend,
      distribution: attendanceDistribution,
    },
    examPerformance: {
      subjectScores,
      examHistory,
      gradeDistribution,
    },
  };

  return c.json(responseData);
});

/**
 * GET /api/analytics/student-me
 * Shortcut for student to fetch their own performance analytics without providing studentId param
 */
analyticsRouter.get('/student-me', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  if (user.role !== 'student') {
    return c.json({ error: 'Endpoint reserved for students' }, 403);
  }

  const student = await getStudentByUserId(db, user.id);
  if (!student) {
    return c.json({ error: 'Student profile not found' }, 404);
  }

  // Redirect internally to GET /api/analytics/student/:studentId logic
  return c.redirect(`/api/analytics/student/${student.id}`);
});

export default analyticsRouter;
