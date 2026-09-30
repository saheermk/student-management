import { UserRole } from './schemas';

export interface UserDTO {
  id: number;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: UserDTO;
  message?: string;
}

export interface ApiErrorResponse {
  error: string;
  details?: unknown;
}

// Academic & People Types

export interface AcademicYearDTO {
  id: number;
  name: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassDTO {
  id: number;
  name: string;
  academicYearId: number;
  academicYearName?: string;
  teacherIds?: number[];
  teacherNames?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SubjectDTO {
  id: number;
  classId: number;
  className?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherDTO {
  id: number;
  userId: number;
  email: string;
  name: string;
  phone?: string | null;
  assignedClassIds?: number[];
  assignedClassNames?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentDTO {
  id: number;
  userId: number;
  admissionNo: string;
  name: string;
  email: string;
  classId: number | null;
  className?: string;
  phone?: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CsvPreviewRowResult {
  rowNumber: number;
  data: {
    name: string;
    admissionNo: string;
    email: string;
    class: string;
    phone?: string;
  };
  isValid: boolean;
  errors: string[];
}

export interface CsvPreviewResponse {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  results: CsvPreviewRowResult[];
}

export interface CsvExecuteImportResponse {
  successCount: number;
  failureCount: number;
  importedStudents: StudentDTO[];
  errors: Array<{ rowNumber: number; email: string; error: string }>;
}

export interface SubjectCsvPreviewRowResult {
  rowNumber: number;
  data: {
    name: string;
    class?: string;
  };
  isValid: boolean;
  errors: string[];
}

export interface SubjectCsvPreviewResponse {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  results: SubjectCsvPreviewRowResult[];
}

export interface SubjectCsvExecuteResponse {
  successCount: number;
  failureCount: number;
  importedSubjects: SubjectDTO[];
  errors: Array<{ rowNumber: number; name: string; error: string }>;
}

// Phase 3: Attendance Types

export interface AttendanceDTO {
  id: number;
  studentId: number;
  studentName?: string;
  admissionNo?: string;
  classId: number;
  className?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  markedBy: number;
  markedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentAttendanceStatsDTO {
  studentId: number;
  studentName: string;
  admissionNo: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  percentage: number;
}

export interface AttendanceSummaryDTO {
  classId: number;
  className: string;
  month: string; // YYYY-MM
  totalStudents: number;
  totalSchoolDays: number;
  overallPercentage: number;
  students: StudentAttendanceStatsDTO[];
}

// Phase 4: Exams & Progress Card Types

export interface ExamDTO {
  id: number;
  classId: number;
  className?: string;
  type: 'monthly' | 'semester' | 'degree';
  name: string;
  examDate: string;
  academicYearId: number;
  academicYearName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamMarkDTO {
  id: number;
  examId: number;
  studentId: number;
  studentName?: string;
  admissionNo?: string;
  subjectId: number;
  subjectName?: string;
  marks: number;
  maxMarks: number;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GradeBoundaryDTO {
  id: number;
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  classification?: string | null;
  isPass: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectMarkDTO {
  sNo: number;
  subjectId: number;
  subjectName: string;
  maxMarks: number;
  marksObtained: number;
  grade: string;
  isPass: boolean;
}

export interface ProgressCardDTO {
  institutionName: string;
  arabicHeader?: string;
  examTitle: string;
  academicYearName: string;
  student: {
    id: number;
    name: string;
    admissionNo: string;
    className: string;
    phone?: string | null;
  };
  attendanceSummary: {
    attendedDays: number;
    totalDays: number;
    percentage: number;
  };
  subjects: SubjectMarkDTO[];
  grandTotalMax: number;
  grandTotalObtained: number;
  grandTotalGrade: string;
  result: 'PASS' | 'FAIL';
  rank: string; // e.g. "#1", "#2"
  overallPercentage: number;
  classification: string;
  generatedDate: string;
}

// Phase 5: Fee Register Types

export interface FeePaymentDTO {
  id: number;
  feeItemId: number;
  studentId: number;
  amountPaid: number;
  paymentDate: string;
  receiptNo: string;
  paymentMethod: string;
  remarks?: string | null;
  recordedBy: number;
  recordedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeItemDTO {
  id: number;
  studentId: number;
  studentName?: string;
  admissionNo?: string;
  classId: number;
  className?: string;
  academicYearId: number;
  academicYearName?: string;
  title: string;
  amount: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  isOverdue: boolean;
  remarks?: string | null;
  payments?: FeePaymentDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentFeeSummaryDTO {
  student: {
    id: number;
    name: string;
    admissionNo: string;
    className: string;
    phone?: string | null;
  };
  totals: {
    totalCharged: number;
    totalPaid: number;
    balance: number;
    overdueCount: number;
  };
  feeItems: FeeItemDTO[];
}

export interface DuesListSummaryDTO {
  totalCharged: number;
  totalCollected: number;
  totalPendingDues: number;
  overdueCount: number;
  dues: {
    feeItemId: number;
    studentId: number;
    studentName: string;
    admissionNo: string;
    classId: number;
    className: string;
    title: string;
    amount: number;
    amountPaid: number;
    balance: number;
    dueDate: string;
    isOverdue: boolean;
  }[];
}

// Phase 6: Leave Register Types

export interface LeaveRequestDTO {
  id: number;
  studentId: number;
  studentName?: string;
  admissionNo?: string;
  classId?: number;
  className?: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: number;
  requestedByName?: string;
  decidedBy?: number | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Institution Settings Types
export interface InstitutionSettingsDTO {
  institutionName: string;
  logoUrl?: string | null;
  logoKey?: string | null;
  updatedAt?: string;
}

// Analytics & Visualizations Types
export interface ChartPieDataItem {
  name: string;
  value: number;
  color: string;
}

export interface AttendanceDailyTrendItem {
  date: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  rate: number;
}

export interface ExamSubjectAverageItem {
  subject: string;
  avgMarks: number;
  maxMarks: number;
  percentage: number;
}

export interface ExamTrendItem {
  examName: string;
  date: string;
  avgPercentage: number;
}

export interface GradeDistributionItem {
  grade: string;
  count: number;
  color: string;
}

export interface ClassAnalyticsDTO {
  classId: number;
  className: string;
  studentCount: number;
  attendanceSummary: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
    dailyTrend: AttendanceDailyTrendItem[];
    distribution: ChartPieDataItem[];
  };
  examPerformance: {
    subjectAverages: ExamSubjectAverageItem[];
    examTrends: ExamTrendItem[];
    gradeDistribution: GradeDistributionItem[];
  };
}

export interface StudentAnalyticsDTO {
  studentId: number;
  studentName: string;
  admissionNo: string;
  classId: number | null;
  className: string | null;
  attendanceSummary: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
    dailyTrend: AttendanceDailyTrendItem[];
    distribution: ChartPieDataItem[];
  };
  examPerformance: {
    subjectScores: ExamSubjectAverageItem[];
    examHistory: ExamTrendItem[];
    gradeDistribution: GradeDistributionItem[];
  };
}




