import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like } from 'drizzle-orm';
import {
  students,
  classes,
  academicYears,
  subjects,
  exams,
  examMarks,
  gradeBoundaries,
  attendance,
} from '../db/schema';
import { ProgressCardDTO, SubjectMarkDTO, GradeBoundaryDTO } from '../../shared/types';
import { getSettingsMap } from '../routes/settings';

const DEFAULT_GRADE_BOUNDARIES = [
  { grade: 'A+', minPercentage: 90, maxPercentage: 100, classification: 'Top Plus', isPass: true },
  { grade: 'A', minPercentage: 80, maxPercentage: 89, classification: 'Distinction', isPass: true },
  { grade: 'B', minPercentage: 70, maxPercentage: 79, classification: 'First Class', isPass: true },
  { grade: 'C', minPercentage: 60, maxPercentage: 69, classification: 'Second Class', isPass: true },
  { grade: 'D', minPercentage: 50, maxPercentage: 59, classification: 'Passed', isPass: true },
  { grade: 'F', minPercentage: 0, maxPercentage: 49, classification: 'Failed', isPass: false },
];

export function evaluateGrade(percentage: number, boundaries: any[]) {
  const rounded = Math.round(percentage);
  const match = boundaries.find((b) => rounded >= b.minPercentage && rounded <= b.maxPercentage);
  if (match) {
    return {
      grade: match.grade,
      classification: match.classification || 'Passed',
      isPass: Boolean(match.isPass),
    };
  }
  return rounded >= 50
    ? { grade: 'D', classification: 'Passed', isPass: true }
    : { grade: 'F', classification: 'Failed', isPass: false };
}

export async function generateProgressCard(
  db: ReturnType<typeof drizzle>,
  studentId: number,
  examId?: number
): Promise<ProgressCardDTO | null> {
  // 1. Fetch Student, Class, Academic Year
  const [studentRec] = await db
    .select({
      id: students.id,
      name: students.name,
      admissionNo: students.admissionNo,
      classId: students.classId,
      phone: students.phone,
      className: classes.name,
      academicYearId: classes.academicYearId,
      academicYearName: academicYears.name,
    })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .where(eq(students.id, studentId));

  if (!studentRec) return null;

  // 2. Fetch Exam (If examId specified, or latest exam for class)
  let targetExam: typeof exams.$inferSelect | null = null;

  if (examId) {
    const [examRec] = await db.select().from(exams).where(eq(exams.id, examId));
    if (examRec) targetExam = examRec;
  } else if (studentRec.classId) {
    const classExams = await db
      .select()
      .from(exams)
      .where(eq(exams.classId, studentRec.classId));
    if (classExams.length > 0) {
      targetExam = classExams[classExams.length - 1];
    }
  }

  const examTitle = targetExam ? targetExam.name : 'Annual Examination Result';

  // 3. Fetch Subjects for Class
  const classSubjects = studentRec.classId
    ? await db
        .select()
        .from(subjects)
        .where(eq(subjects.classId, studentRec.classId))
    : await db.select().from(subjects);

  // 4. Fetch Custom Grade Boundaries or fallback to default
  const dbBoundaries = await db.select().from(gradeBoundaries);
  const boundariesToUse = dbBoundaries.length > 0 ? dbBoundaries : DEFAULT_GRADE_BOUNDARIES;

  // 5. Fetch Marks for Target Exam
  const markRecords = targetExam
    ? await db
        .select()
        .from(examMarks)
        .where(and(eq(examMarks.examId, targetExam.id), eq(examMarks.studentId, studentId)))
    : [];

  const markMap = new Map<number, typeof examMarks.$inferSelect>();
  markRecords.forEach((m) => markMap.set(m.subjectId, m));

  let grandTotalMax = 0;
  let grandTotalObtained = 0;
  let allSubjectsPassed = true;

  const subjectDTOs: SubjectMarkDTO[] = classSubjects.map((sub, idx) => {
    const record = markMap.get(sub.id);
    const marksObtained = record ? record.marks : 0;
    const maxMarks = record ? record.maxMarks : 50;

    grandTotalMax += maxMarks;
    grandTotalObtained += marksObtained;

    const subPercentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
    const evalResult = evaluateGrade(subPercentage, boundariesToUse);

    if (!evalResult.isPass) {
      allSubjectsPassed = false;
    }

    return {
      sNo: idx + 1,
      subjectId: sub.id,
      subjectName: sub.name,
      maxMarks,
      marksObtained,
      grade: evalResult.grade,
      isPass: evalResult.isPass,
    };
  });

  // Default fallback if no subjects exist yet
  if (grandTotalMax === 0) grandTotalMax = 300;

  const overallPercentage =
    grandTotalMax > 0 ? Math.round(((grandTotalObtained / grandTotalMax) * 100) * 10) / 10 : 0;
  const overallEval = evaluateGrade(overallPercentage, boundariesToUse);

  const finalResult: 'PASS' | 'FAIL' = allSubjectsPassed && overallEval.isPass ? 'PASS' : 'FAIL';

  // 6. Calculate Rank across all active students in class for this exam
  let studentRank = '#1';
  if (targetExam) {
    const classStudents = studentRec.classId
      ? await db
          .select({ id: students.id })
          .from(students)
          .where(and(eq(students.classId, studentRec.classId), eq(students.status, 'active')))
      : [];

    const allExamMarks = await db
      .select()
      .from(examMarks)
      .where(eq(examMarks.examId, targetExam.id));

    const studentTotalMap = new Map<number, number>();
    allExamMarks.forEach((m) => {
      const current = studentTotalMap.get(m.studentId) || 0;
      studentTotalMap.set(m.studentId, current + m.marks);
    });

    const rankedStudents = classStudents.map((s) => ({
      studentId: s.id,
      totalObtained: studentTotalMap.get(s.id) || 0,
    }));

    rankedStudents.sort((a, b) => b.totalObtained - a.totalObtained);
    const rankIndex = rankedStudents.findIndex((r) => r.studentId === studentId);
    if (rankIndex !== -1) {
      studentRank = `#${rankIndex + 1}`;
    }
  }

  // 7. Calculate Student Attendance Stats
  const attendanceLogs = await db
    .select()
    .from(attendance)
    .where(eq(attendance.studentId, studentId));

  const totalDays = attendanceLogs.length > 0 ? attendanceLogs.length : 180;
  const attendedDays =
    attendanceLogs.length > 0
      ? attendanceLogs.filter((a) => a.status === 'present' || a.status === 'late').length
      : 180;
  const attPercentage = Math.round((attendedDays / totalDays) * 100);

  const settingsMap = await getSettingsMap(db);
  const institutionName = settingsMap['institution_name'] || 'Student Management System';

  return {
    institutionName,
    arabicHeader: 'مدرسة حياة الإسلام',
    examTitle: `${examTitle} • ${studentRec.academicYearName}`,
    academicYearName: studentRec.academicYearName,
    student: {
      id: studentRec.id,
      name: studentRec.name,
      admissionNo: studentRec.admissionNo,
      className: studentRec.className,
      phone: studentRec.phone,
    },
    attendanceSummary: {
      attendedDays,
      totalDays,
      percentage: attPercentage,
    },
    subjects: subjectDTOs,
    grandTotalMax,
    grandTotalObtained,
    grandTotalGrade: overallEval.grade,
    result: finalResult,
    rank: studentRank,
    overallPercentage,
    classification: overallEval.classification,
    generatedDate: new Date().toLocaleDateString('en-GB'),
  };
}
