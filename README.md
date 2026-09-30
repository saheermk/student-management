# Student Management System

A web system for managing student records, attendance, fees, leaves, progress cards, reading status, routine, and achievements.

## Tech Stack
- **API**: Hono + TypeScript on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Files**: Cloudflare R2
- **Frontend**: React + Vite + Tailwind CSS
- **Validation**: Zod (shared schemas)
- **Testing**: Vitest with Miniflare D1 Emulation

---

## Phase 1 Implementation Summary (Auth, Security & User Management)

### 1. Database Schema
- **`users`**: `id`, `email` (unique), `password_hash` (WebCrypto PBKDF2-SHA256), `role` (`admin|teacher|student`), `is_active` (boolean), `must_change_password` (boolean), `created_at`, `updated_at`.
- **`sessions`**: `id`, `user_id` (FK), `token_hash` (unique SHA-256 digest), `expires_at` (7 days expiry), `created_at`.
- **`password_reset_tokens`**: `id`, `user_id` (FK), `token_hash` (unique SHA-256 digest), `expires_at` (1 hour expiry), `used` (boolean), `created_at`.
- **`login_attempts`**: `id`, `identifier` (email/IP), `attempted_at`, `success` (boolean).
- **`audit_log`**: `id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `created_at`.

### 2. Security Architecture (Section 10)
- **Password Hashing**: Native WebCrypto PBKDF2 with SHA-256, 100,000 iterations, and random 16-byte salt (`salt:hash`).
- **Session Auth Cookie**: `HttpOnly`, `SameSite=Lax`, `Secure` in production. Supports `Authorization: Bearer <token>` for API clients.
- **Role Middleware (`requireRole`)**: Enforces server-side access control. Returns 403 Forbidden for insufficient permissions.
- **Rate Limiting**: Denies login after 5 failed attempts for an email within a 15-minute window (429 Too Many Requests).
- **Session Revocation**: Instantly revokes all active user sessions upon deactivation or password reset.
- **Password Reset**: Single-use tokens expiring in 1 hour via email (Resend API with development mock logger).

### 3. API Endpoints (Phase 1)
- **`POST /api/auth/login`**: Authenticates credentials, checks rate limits, returns session cookie and token.
- **`POST /api/auth/logout`**: Destroys active session and clears session cookie.
- **`GET /api/auth/me`**: Returns profile of currently logged-in user.
- **`POST /api/auth/forgot-password`**: Generates reset token and sends email.
- **`POST /api/auth/reset-password`**: Resets password using valid token.
- **`POST /api/auth/change-password`**: Logged-in user password change.
- **`GET /api/admin/users`**: Lists all users (Admin only).
- **`POST /api/admin/users`**: Admin user creation (Admin only).
- **`PATCH /api/admin/users/:id/status`**: Activate or deactivate user (Admin only).
- **`POST /api/admin/users/:id/reset-password`**: Admin reset user password to temporary password (Admin only).
- **`POST /api/seed/admin`**: Bootstraps initial admin account (`admin@school.com`).

---

## Phase 2 Implementation Summary (Academic Structure, Students, Teachers & CSV Import)

### 1. Database Schema
- **`academic_years`**: `id`, `name` (unique, e.g. "2024-2025"), `is_current` (boolean), `created_at`, `updated_at`.
- **`classes`**: `id`, `name` (e.g. "Class 10A"), `academic_year_id` (FK -> `academic_years`), `created_at`, `updated_at`.
- **`teachers`**: `id`, `user_id` (unique FK -> `users`), `name`, `phone`, `created_at`, `updated_at`.
- **`class_teachers`**: `id`, `class_id` (FK -> `classes`), `teacher_id` (FK -> `teachers`), unique constraint on `(class_id, teacher_id)`.
- **`subjects`**: `id`, `class_id` (FK -> `classes`), `name`, `created_at`, `updated_at`.
- **`students`**: `id`, `user_id` (unique FK -> `users`), `admission_no` (unique), `name`, `class_id` (FK -> `classes`), `phone`, `status` (`active|inactive`), `created_at`, `updated_at`.

### 2. Class-Scope Security & Helper (`src/worker/lib/scope.ts`)
- **Teacher Scope Enforcement**: Teachers can only list or view student records for students enrolled in classes assigned to them via `class_teachers`. Attempts to access other students return `403 Forbidden`.
- **Student Scope Enforcement**: Students can only view their own student profile via `/api/students/me` or `/api/students/:id` where `student.userId === session.userId`. Attempts to view other students return `403 Forbidden`.
- **Admin Scope**: Admin users have unrestricted access to all academic data, classes, teachers, and student records.

### 3. API Endpoints (Phase 2)
- **Academic Years**: `GET /api/academic-years`, `POST /api/academic-years`, `PATCH /api/academic-years/:id`.
- **Classes & Subjects**: `GET /api/classes`, `POST /api/classes`, `POST /api/classes/:id/teachers`, `GET /api/subjects`, `POST /api/subjects`.
- **Teachers**: `GET /api/teachers`, `POST /api/teachers`.
- **Students & CSV Import**: `GET /api/students`, `GET /api/students/me`, `GET /api/students/:id`, `POST /api/students`, `PATCH /api/students/:id`, `POST /api/students/promote` (FR-S4), `POST /api/students/import-csv/preview` (FR-A6), `POST /api/students/import-csv/execute` (FR-A6).

---

## Phase 3 Implementation Summary (Attendance Register: FR-AT1 to FR-AT5)

### 1. Database Schema
- **`attendance`**: `id`, `student_id` (FK -> `students`), `class_id` (FK -> `classes`), `date` (`YYYY-MM-DD`), `status` (`present|absent|late|leave`), `marked_by` (FK -> `users`), `created_at`, `updated_at`.
  - Unique constraint on `(student_id, date)`.

### 2. Security & Class-Scope Rules
- **Teacher Attendance Marking**: Teachers can only mark or edit attendance for classes assigned to them in `class_teachers`. Requests for unassigned classes return `403 Forbidden`.
- **Student Attendance Access**: Students cannot mark attendance. Students can view only their own attendance history via `/api/attendance/me` or `/api/attendance/summary/student/:studentId` for self.
- **Audit Logging**: Updating a previously recorded attendance status writes an audit record to `audit_log` with `action: 'UPDATE_ATTENDANCE'`.

### 3. API Endpoints (Phase 3)
- `GET /api/attendance`: Filter attendance records by `classId`, `date`, `month`, or `studentId`. Enforces class-scoping.
- `POST /api/attendance/mark`: Bulk mark attendance for a class on a date (default status present, upsert logic, audit logging).
- `GET /api/attendance/summary/class/:classId`: Monthly class attendance summary report with total school days, overall %, and student breakdown table.
- `GET /api/attendance/summary/student/:studentId`: Detailed student attendance statistics.
- `GET /api/attendance/me`: Student self profile endpoint returning personal attendance rate and history log.

### 4. UI/UX Features
- **Mark Attendance Screen**: Class & date selector, default present status, 1-tap status toggle buttons (`Present` / `Absent` / `Late` / `Leave`), quick "Mark All Present" / "Mark All Absent" shortcuts, past date editor indication.
- **Monthly Summary Screen**: Class & month picker, class attendance % stat cards, student progress bars.
- **Student Dashboard**: Personal attendance percentage badge and attendance calendar history list.

---

## Phase 4 Implementation Summary (Progress Card & Examination Management: FR-P1 to FR-P5)

### 1. Database Schema
- **`exams`**: `id`, `class_id` (FK -> `classes`), `type` (`monthly|semester|degree`), `name`, `exam_date` (`YYYY-MM-DD`), `academic_year_id` (FK -> `academic_years`), `created_at`, `updated_at`.
- **`exam_marks`**: `id`, `exam_id` (FK -> `exams`), `student_id` (FK -> `students`), `subject_id` (FK -> `subjects`), `marks` (integer), `max_marks` (default 50), `remarks`, `created_at`, `updated_at`.
  - Unique index on `(exam_id, student_id, subject_id)`.
- **`grade_boundaries`**: `id`, `grade` (e.g. `'A+'`), `min_percentage` (0-100), `max_percentage` (0-100), `classification` (e.g. `'Top Plus'`), `is_pass` (boolean), `created_at`, `updated_at`.

### 2. Security & Class-Scope Rules
- **Teacher Scope**: Teachers can create exams and enter/modify marks only for assigned classes in `class_teachers`. Access to unassigned classes returns `403 Forbidden`.
- **Student Scope**: Students cannot create exams or enter marks. Students can view only their own progress card via `/api/exams/progress-card/me` or `/api/exams/progress-card/student/:studentId` for self.
- **Audit Logging**: Editing previously saved exam marks writes audit records to `audit_log` with `action: 'UPDATE_EXAM_MARKS'`.

### 3. API Endpoints (Phase 4)
- `GET /api/exams`: List exams for class (scoped by role).
- `POST /api/exams`: Create exam (Admin & assigned Teacher).
- `GET /api/exams/:id/marks`: Fetch marks entry grid for all active class students & subjects.
- `POST /api/exams/:id/marks`: Bulk enter/update exam marks with audit logging.
- `GET /api/exams/progress-card/me`: Fetch current logged-in student's progress card DTO.
- `GET /api/exams/progress-card/student/:studentId`: Fetch compiled progress card DTO for student (scoped).
- `GET /api/exams/grade-boundaries`: Fetch configured grade boundaries (or default fallback).
- `POST /api/exams/grade-boundaries`: Bulk configure custom grade boundaries (Admin only - FR-P4).

### 4. Progress Card UI & Print Layout (FR-P5)
- **Print-Friendly Format**: Custom styling matching Madrasa progress card reference design (`HAYATHUL ISLAM MADRASA MALAPPURAM`, Arabic title, student information box, examination results grid, grand total, attendance summary row, final pass/fail result, class rank `#1`, percentage, and signatures block).
- **Print Styles**: `@media print` rules hide action buttons and navigation so the progress card formats to a single A4 page for printing or saving as PDF.

---

## Phase 5 Implementation Summary (Fee Register: FR-F1 to FR-F7)

### 1. Database Schema
- **`fee_items`**: `id`, `student_id` (FK -> `students`), `class_id` (FK -> `classes`), `academic_year_id` (FK -> `academic_years`), `title`, `amount` (integer), `due_date` (`YYYY-MM-DD`), `remarks`, `created_at`, `updated_at`.
- **`fee_payments`**: `id`, `fee_item_id` (FK -> `fee_items`), `student_id` (FK -> `students`), `amount_paid` (integer), `payment_date` (`YYYY-MM-DD`), `receipt_no`, `payment_method` (`cash|online|bank_transfer|upi|cheque`), `remarks`, `recorded_by` (FK -> `users`), `created_at`, `updated_at`.

### 2. Security & Role Permissions
- **Strict Teacher Prohibition (FR-F7)**: Teachers receive `403 Forbidden` on ALL `/api/fees/*` endpoints (read & write).
- **Student Scope (FR-F6)**: Students can view only their own fee statements, payments, and balance via `/api/fees/me` or `/api/fees/student/:studentId` for self.
- **Admin Scope & Write Operations (FR-F1 to FR-F5)**: Admin has full CRUD access to fee items and payments. Every create, update, payment, or deletion operation writes an explicit entry to `audit_log`.

### 3. API Endpoints (Phase 5)
- `GET /api/fees`: Filter dues list by `classId`, `isOverdue` (`dueDate < today AND balance > 0`), and `search`. Returns overall summary totals (`totalCharged`, `totalCollected`, `totalPendingDues`, `overdueCount`).
- `POST /api/fees`: Single student or bulk class fee item creation with audit logging.
- `PATCH /api/fees/:id` & `DELETE /api/fees/:id`: Edit or delete fee items with audit logging.
- `POST /api/fees/payments`: Record payment against a fee item with receipt number and audit logging.
- `DELETE /api/fees/payments/:id`: Delete payment entry with audit logging.
- `GET /api/fees/student/:studentId`: Student fee summary & payment history (Admin or Student self).
- `DELETE /api/fees/payments/:id`: Delete payment entry with audit logging.
- `GET /api/fees/student/:studentId`: Student fee summary & payment history (Admin or Student self).
- `GET /api/fees/me`: Logged-in student self profile endpoint.

---

## Phase 6 Implementation Summary (Leave Register: FR-L1 to FR-L5 & Attendance Link FR-AT3)

### 1. Database Schema
- **`leaves`**: `id`, `student_id` (FK -> `students`), `from_date` (`YYYY-MM-DD`), `to_date` (`YYYY-MM-DD`), `reason`, `status` (`pending|approved|rejected`), `requested_by` (FK -> `users`), `decided_by` (FK -> `users`), `decided_at`, `decision_note`, `created_at`, `updated_at`.

### 2. Security & Class-Scope Rules
- **Student Scope (FR-L1, FR-L4)**: Students can submit leave requests for themselves (`POST /api/leaves`) and view their own leave request history (`GET /api/leaves/me`). Attempting to request or view leaves for other students returns `403 Forbidden`.
- **Teacher Class Scope (FR-L2, FR-L3)**: Class teachers can view, review (approve/reject), and enter direct leaves (`POST /api/leaves/direct`) ONLY for students enrolled in classes assigned to them via `class_teachers`. Access to other classes returns `403 Forbidden`.
- **Admin Scope**: Admin has unrestricted access to view, direct-create, and review leave applications for all students and classes.

### 3. Overlap Validation (FR-L5)
- Before creating or approving a leave request, the system queries active leaves (`pending` or `approved`) for the same student.
- If `existing.from_date <= new.to_date AND existing.to_date >= new.from_date`, the system rejects the request with `400 Bad Request` ("Overlapping leave request already exists for this date range").

### 4. Attendance Integration (FR-AT3)
- When a leave request is approved (or directly entered by staff), the system automatically creates or updates attendance entries for every date in `[from_date, to_date]` with status `'leave'`.
- Attendance registers and monthly summary calculations immediately reflect these leave days without requiring duplicate manual entry.

### 5. API Endpoints (Phase 6)
- `GET /api/leaves`: List leave requests filtered by `classId`, `studentId`, `status`. Enforces server-side scoping.
- `GET /api/leaves/me`: Returns logged-in student's leave requests.
- `POST /api/leaves`: Student submits leave request with overlap check.
- `POST /api/leaves/direct`: Staff direct entry (auto-approved, attendance sync, audit log).
- `PATCH /api/leaves/:id/review`: Teacher/Admin approves or rejects leave with decision note (syncs attendance on approval).

---

## Local Development

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Development Server & Scripts

To run the full application locally, you need the Cloudflare Worker API backend (running on port `8787`) and the Vite React frontend (running on port `5173`):

1. **Start Worker API Backend (Terminal 1)**:
   ```bash
   npm run dev:worker
   ```
   *Runs the Hono API & D1 database locally on `http://localhost:8787`.*

2. **Start Frontend Dev Server (Terminal 2)**:
   ```bash
   npm run dev
   ```
   *Runs Vite on `http://localhost:5173` and proxies `/api/*` requests to port `8787`.*

```bash
# Run TypeScript type check
npm run typecheck

# Run Vitest test suite (permissions, auth, admin, academic, class-scope, CSV import, attendance, exams, fees, leaves)
npm test
```

### Default Admin Credentials & Seeding

For local development and testing, an initial admin account can be initialized:

- **Email**: `admin@school.com`
- **Password**: `Admin@12345`

You can seed this account by executing a `POST /api/seed/admin` request or by clicking the **"Seed Default Admin Account"** link on the login page (`http://localhost:5173`).

### Database & Migrations
```bash
# Generate Drizzle migrations
npm run db:generate

# Apply D1 migrations locally
npm run db:migrate
```

---

---

## Class Editing, Deletion & Subject CSV Import

### 1. Class Editing & Deletion Architecture
- **Edit Class (`PATCH /api/classes/:id`)**: Admin can modify class name and target academic year (`academicYearId`).
- **Delete Class (`DELETE /api/classes/:id?deleteStudents=true|false`)**:
  - Requires explicit admin choice:
    - **`deleteStudents: false` (Keep Students - Recommended)**: Updates enrolled students' `classId` to `null` and sets `status` to `'inactive'` (unassigned/archived state). Preserves all historical attendance records, exam marks, progress cards, fee receipts, and leave applications 100% intact.
    - **`deleteStudents: true` (Delete Students)**: Permanently removes enrolled student accounts and associated data records.
- **UI Confirmation Modal**: Displays explicit interactive selection prompt preventing silent cascade deletion of student records.

### 2. Subject Bulk CSV Import
- **`POST /api/subjects/import-csv/preview`**: Parses raw subject CSV text, validates against existing class subjects, and flags duplicate subject names or empty values with line-by-line error reports.
- **`POST /api/subjects/import-csv/execute`**: Bulk inserts validated subject rows into the target class.
- **UI Workflow**: Features live validation preview with status badges (`Valid` / `Error`), error list, and single-click bulk import execution.

---

## Verification & Testing Steps Executed
1. **Type Check**: Verified with `npm run typecheck` (0 errors).
2. **Automated Vitest Test Suite**: Verified 17 test files, 109 tests passing (100% success):
   - `tests/class-delete.test.ts` (Class Edit, Delete Class with Keep-Students history preservation, deleteStudents=true path, non-admin 403, Subject CSV Preview & Execute - 5 tests)
   - `tests/settings.test.ts` (Institution settings API, admin PUT update, R2 logo upload, non-admin 403 enforcement - 4 tests)
   - `tests/leave-permissions.test.ts` (Leave permissions - Student self-scope, Teacher class scope, Admin full access - 9 tests)
   - `tests/leaves.test.ts` (Leave business logic - Student request flow, staff direct entry, overlap validation, attendance status sync - 8 tests)
   - `tests/fee-permissions.test.ts` (Fee Register permissions - Teacher 403 prohibition, Student read-own 200 vs cross-view 403 - 7 tests)
   - `tests/fees.test.ts` (Single & bulk fee creation, payment recording, receipt numbers, totals calculation, overdue filtering, audit log - 6 tests)
   - `tests/exam-permissions.test.ts` (Exam & Progress Card role permissions & scope - 5 tests)
   - `tests/exams.test.ts` (Exam creation, marks entry grid, calculations, rank computation, audit log, grade boundaries - 11 tests)
   - `tests/attendance-permissions.test.ts` (Teacher/Student class scoping & permission checks - 7 tests)
   - `tests/attendance.test.ts` (Bulk mark attendance, past date edit audit logging, monthly summary calculations - 8 tests)
   - `tests/auth.test.ts` (Login, rate limiting, password reset flow - 6 tests)
   - `tests/admin.test.ts` (Admin user management, deactivation, temporary password reset - 4 tests)
   - `tests/academic-crud.test.ts` (Academic years, classes, subject creation, class promotion - 6 tests)
   - `tests/class-scope.test.ts` (Server-side teacher class-scoping & student self-scoping - 5 tests)
   - `tests/csv-import.test.ts` (CSV preview validation, row error flagging, bulk student import - 3 tests)
   - `tests/permissions.test.ts` (Role-based access control tests - 4 tests)
   - `tests/health.test.ts` (Healthcheck endpoint - 1 test)

---

## Backup & Restore
- Cloudflare D1 automatically supports point-in-time recovery.
- Weekly database backups are exported to R2 via Cron Trigger.



