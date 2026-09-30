import {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  CreateUserInput,
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
  CreateClassInput,
  UpdateClassInput,
  CreateSubjectInput,
  CreateTeacherInput,
  CreateStudentInput,
  UpdateStudentInput,
  HealthResponse,
  CsvImportRow,
  MarkAttendanceInput,
  CreateFeeItemInput,
  CreateBulkClassFeeInput,
  RecordPaymentInput,
  UpdateFeeItemInput,
  CreateLeaveInput,
  DirectLeaveInput,
  ReviewLeaveInput,
  UpdateSettingsInput,
} from '../../shared/schemas';
import {
  UserDTO,
  AcademicYearDTO,
  ClassDTO,
  SubjectDTO,
  TeacherDTO,
  StudentDTO,
  CsvPreviewResponse,
  CsvExecuteImportResponse,
  SubjectCsvPreviewResponse,
  SubjectCsvExecuteResponse,
  AttendanceDTO,
  AttendanceSummaryDTO,
  StudentAttendanceStatsDTO,
  FeeItemDTO,
  FeePaymentDTO,
  StudentFeeSummaryDTO,
  DuesListSummaryDTO,
  LeaveRequestDTO,
  InstitutionSettingsDTO,
  ClassAnalyticsDTO,
  StudentAnalyticsDTO,
} from '../../shared/types';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include', // Include HttpOnly session cookies
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = (await response.json().catch(() => ({}))) as any;

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>('/api/health');
}

export const api = {
  fetchHealth,

  // Auth
  async login(credentials: LoginInput) {
    return fetchApi<{ user: UserDTO; token: string; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async logout() {
    return fetchApi<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  async getMe() {
    return fetchApi<{ user: UserDTO }>('/api/auth/me', {
      method: 'GET',
    });
  },

  async forgotPassword(data: ForgotPasswordInput) {
    return fetchApi<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetPassword(data: ResetPasswordInput) {
    return fetchApi<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async changePassword(data: ChangePasswordInput) {
    return fetchApi<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Admin User Management
  async getUsers() {
    return fetchApi<{ users: UserDTO[] }>('/api/admin/users', {
      method: 'GET',
    });
  },

  async createUser(data: CreateUserInput) {
    return fetchApi<{ user: UserDTO; temporaryPassword?: string; message: string }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUserStatus(userId: number, isActive: boolean) {
    return fetchApi<{ user: UserDTO; message: string }>(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  async adminResetPassword(userId: number, temporaryPassword?: string) {
    return fetchApi<{ temporaryPassword?: string; message: string }>(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword }),
    });
  },

  // Phase 2: Academic Years & Classes
  async getAcademicYears() {
    return fetchApi<{ academicYears: AcademicYearDTO[] }>('/api/academic-years', { method: 'GET' });
  },

  async createAcademicYear(data: CreateAcademicYearInput) {
    return fetchApi<{ academicYear: AcademicYearDTO; message: string }>('/api/academic-years', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAcademicYear(id: number, data: UpdateAcademicYearInput) {
    return fetchApi<{ academicYear: AcademicYearDTO; message: string }>(`/api/academic-years/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getClasses() {
    return fetchApi<{ classes: ClassDTO[] }>('/api/classes', { method: 'GET' });
  },

  async createClass(data: CreateClassInput) {
    return fetchApi<{ classRecord: ClassDTO; message: string }>('/api/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateClass(id: number, data: UpdateClassInput) {
    return fetchApi<{ classRecord: ClassDTO; message: string }>(`/api/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteClass(id: number, deleteStudents: boolean = false) {
    return fetchApi<{ message: string; studentsCount: number; action: string }>(`/api/classes/${id}?deleteStudents=${deleteStudents}`, {
      method: 'DELETE',
    });
  },

  async assignClassTeacher(classId: number, teacherId: number) {
    return fetchApi<{ message: string }>(`/api/classes/${classId}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ teacherId }),
    });
  },

  async getSubjects(classId?: number) {
    const url = classId ? `/api/subjects?classId=${classId}` : '/api/subjects';
    return fetchApi<{ subjects: SubjectDTO[] }>(url, { method: 'GET' });
  },

  async createSubject(data: CreateSubjectInput) {
    return fetchApi<{ subject: SubjectDTO; message: string }>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async previewSubjectCsv(csvContent: string, classId: number) {
    return fetchApi<SubjectCsvPreviewResponse>('/api/subjects/import-csv/preview', {
      method: 'POST',
      body: JSON.stringify({ csvContent, classId }),
    });
  },

  async executeSubjectCsv(classId: number, rows: Array<{ name: string }>) {
    return fetchApi<SubjectCsvExecuteResponse>('/api/subjects/import-csv/execute', {
      method: 'POST',
      body: JSON.stringify({ classId, rows }),
    });
  },

  // Phase 2: Teachers & Students
  async getTeachers() {
    return fetchApi<{ teachers: TeacherDTO[] }>('/api/teachers', { method: 'GET' });
  },

  async createTeacher(data: CreateTeacherInput) {
    return fetchApi<{ teacher: TeacherDTO; temporaryPassword?: string; message: string }>('/api/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getStudents(classId?: number) {
    const url = classId ? `/api/students?classId=${classId}` : '/api/students';
    return fetchApi<{ students: StudentDTO[] }>(url, { method: 'GET' });
  },

  async getStudentMe() {
    return fetchApi<{ student: StudentDTO }>('/api/students/me', { method: 'GET' });
  },

  async getStudent(id: number) {
    return fetchApi<{ student: StudentDTO }>(`/api/students/${id}`, { method: 'GET' });
  },

  async createStudent(data: CreateStudentInput) {
    return fetchApi<{ student: StudentDTO; temporaryPassword?: string; message: string }>('/api/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateStudent(id: number, data: UpdateStudentInput) {
    return fetchApi<{ student: StudentDTO; message: string }>(`/api/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async promoteClass(sourceClassId: number, targetClassId: number) {
    return fetchApi<{ promotedCount: number; sourceClassName: string; targetClassName: string; message: string }>('/api/students/promote', {
      method: 'POST',
      body: JSON.stringify({ sourceClassId, targetClassId }),
    });
  },

  // CSV Bulk Import (FR-A6)
  async previewStudentCsv(csvContent: string) {
    return fetchApi<CsvPreviewResponse>('/api/students/import-csv/preview', {
      method: 'POST',
      body: JSON.stringify({ csvContent }),
    });
  },

  async executeStudentCsv(rows: CsvImportRow[]) {
    return fetchApi<CsvExecuteImportResponse>('/api/students/import-csv/execute', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  // Phase 3: Attendance API Methods
  async getAttendance(filters?: { classId?: number; studentId?: number; date?: string; month?: string }) {
    const params = new URLSearchParams();
    if (filters?.classId) params.append('classId', filters.classId.toString());
    if (filters?.studentId) params.append('studentId', filters.studentId.toString());
    if (filters?.date) params.append('date', filters.date);
    if (filters?.month) params.append('month', filters.month);

    const queryString = params.toString();
    const url = queryString ? `/api/attendance?${queryString}` : '/api/attendance';
    return fetchApi<{ attendance: AttendanceDTO[] }>(url, { method: 'GET' });
  },

  async markAttendance(data: MarkAttendanceInput) {
    return fetchApi<{ message: string; insertedCount: number; updatedCount: number }>('/api/attendance/mark', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getClassAttendanceSummary(classId: number, month?: string) {
    const url = month
      ? `/api/attendance/summary/class/${classId}?month=${month}`
      : `/api/attendance/summary/class/${classId}`;
    return fetchApi<{ summary: AttendanceSummaryDTO }>(url, { method: 'GET' });
  },

  async getStudentAttendanceSummary(studentId: number, month?: string) {
    const url = month
      ? `/api/attendance/summary/student/${studentId}?month=${month}`
      : `/api/attendance/summary/student/${studentId}`;
    return fetchApi<{
      student: { id: number; name: string; admissionNo: string };
      stats: StudentAttendanceStatsDTO;
      logs: AttendanceDTO[];
    }>(url, { method: 'GET' });
  },

  async getAttendanceMe() {
    return fetchApi<{
      student: { id: number; name: string; admissionNo: string; className: string };
      stats: StudentAttendanceStatsDTO;
      logs: AttendanceDTO[];
    }>('/api/attendance/me', { method: 'GET' });
  },

  // Seed Initial Admin
  async seedAdmin(data?: { email?: string; password?: string }) {
    return fetchApi<{ user: UserDTO; message: string; initialPassword?: string }>('/api/seed/admin', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  // Phase 4: Exams & Progress Card API Methods
  async getExams(classId?: number) {
    const url = classId ? `/api/exams?classId=${classId}` : '/api/exams';
    return fetchApi<{ exams: any[] }>(url, { method: 'GET' });
  },

  async createExam(data: { classId: number; type: 'monthly' | 'semester' | 'degree'; name: string; examDate: string; academicYearId: number }) {
    return fetchApi<{ exam: any; message: string }>('/api/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getExamMarksGrid(examId: number) {
    return fetchApi<{
      exam: any;
      class: ClassDTO;
      subjects: SubjectDTO[];
      students: {
        studentId: number;
        studentName: string;
        admissionNo: string;
        marks: Record<number, { marks: number; maxMarks: number; remarks: string | null }>;
      }[];
    }>(`/api/exams/${examId}/marks`, { method: 'GET' });
  },

  async saveExamMarks(examId: number, records: { studentId: number; subjectId: number; marks: number; maxMarks?: number; remarks?: string }[]) {
    return fetchApi<{ message: string; insertedCount: number; updatedCount: number }>(`/api/exams/${examId}/marks`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  },

  async getProgressCardMe(examId?: number) {
    const url = examId ? `/api/exams/progress-card/me?examId=${examId}` : '/api/exams/progress-card/me';
    return fetchApi<{ progressCard: any }>(url, { method: 'GET' });
  },

  async getProgressCardForStudent(studentId: number, examId?: number) {
    const url = examId
      ? `/api/exams/progress-card/student/${studentId}?examId=${examId}`
      : `/api/exams/progress-card/student/${studentId}`;
    return fetchApi<{ progressCard: any }>(url, { method: 'GET' });
  },

  async getGradeBoundaries() {
    return fetchApi<{ boundaries: any[] }>('/api/exams/grade-boundaries', { method: 'GET' });
  },

  async updateGradeBoundaries(boundaries: any[]) {
    return fetchApi<{ message: string; boundaries: any[] }>('/api/exams/grade-boundaries', {
      method: 'POST',
      body: JSON.stringify(boundaries),
    });
  },

  // Phase 5: Fee Register API Methods
  async getFees(filters?: { classId?: number; isOverdue?: boolean; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.classId) params.append('classId', filters.classId.toString());
    if (filters?.isOverdue) params.append('isOverdue', 'true');
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `/api/fees?${queryString}` : '/api/fees';
    return fetchApi<{ summary: DuesListSummaryDTO }>(url, { method: 'GET' });
  },

  async createFeeItem(data: CreateFeeItemInput) {
    return fetchApi<{ feeItem: FeeItemDTO; message: string }>('/api/fees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createBulkClassFee(data: CreateBulkClassFeeInput) {
    return fetchApi<{ message: string; createdCount: number }>('/api/fees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFeeItem(id: number, data: UpdateFeeItemInput) {
    return fetchApi<{ feeItem: FeeItemDTO; message: string }>(`/api/fees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteFeeItem(id: number) {
    return fetchApi<{ message: string }>(`/api/fees/${id}`, {
      method: 'DELETE',
    });
  },

  async recordFeePayment(data: RecordPaymentInput) {
    return fetchApi<{ payment: FeePaymentDTO; message: string }>('/api/fees/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteFeePayment(id: number) {
    return fetchApi<{ message: string }>(`/api/fees/payments/${id}`, {
      method: 'DELETE',
    });
  },

  async getStudentFeeSummary(studentId: number) {
    return fetchApi<StudentFeeSummaryDTO>(`/api/fees/student/${studentId}`, { method: 'GET' });
  },

  async getFeesMe() {
    return fetchApi<StudentFeeSummaryDTO>('/api/fees/me', { method: 'GET' });
  },

  // Phase 6: Leave Register API Methods
  async getLeaves(params?: { classId?: number; studentId?: number; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.classId) searchParams.append('classId', params.classId.toString());
    if (params?.studentId) searchParams.append('studentId', params.studentId.toString());
    if (params?.status) searchParams.append('status', params.status);

    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchApi<{ leaves: LeaveRequestDTO[] }>(`/api/leaves${queryStr}`, { method: 'GET' });
  },

  async getLeavesMe() {
    return fetchApi<{ leaves: LeaveRequestDTO[] }>('/api/leaves/me', { method: 'GET' });
  },

  async requestLeave(data: CreateLeaveInput) {
    return fetchApi<{ leave: LeaveRequestDTO; message: string }>('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createDirectLeave(data: DirectLeaveInput) {
    return fetchApi<{ leave: LeaveRequestDTO; message: string }>('/api/leaves/direct', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reviewLeave(id: number, data: ReviewLeaveInput) {
    return fetchApi<{ leave: LeaveRequestDTO; message: string }>(`/api/leaves/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Institution Settings API Methods
  async getSettings() {
    return fetchApi<InstitutionSettingsDTO>('/api/settings', { method: 'GET' });
  },

  async updateSettings(data: UpdateSettingsInput) {
    return fetchApi<{ settings: InstitutionSettingsDTO; message: string }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch('/api/settings/logo', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload logo');
    }
    return data as { logoUrl: string; logoKey: string; message: string };
  },

  // Analytics & Visualizations API Methods
  async getClassAnalytics(classId: number) {
    return fetchApi<ClassAnalyticsDTO>(`/api/analytics/class/${classId}`, { method: 'GET' });
  },

  async getStudentAnalytics(studentId: number) {
    return fetchApi<StudentAnalyticsDTO>(`/api/analytics/student/${studentId}`, { method: 'GET' });
  },

  async getStudentMeAnalytics() {
    return fetchApi<StudentAnalyticsDTO>('/api/analytics/student-me', { method: 'GET' });
  },
};



