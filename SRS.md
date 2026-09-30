# SRS: Student Management System

Version 1.0 · Built with the Antigravity agent · Hosted fully on Cloudflare

> **How to use this file:** put it in the project root as `SRS.md`. Give the agent ONE phase at a time (Section 12). Do not ask it to "build everything". Review each phase before moving on.

---

## 1. Purpose

A web system for about 110 students where:

- Admin/office and teachers manage student records.
- Each student logs in with their own account and views their own status.

## 2. Scope

**In scope (all required by the client):**

1. Progress Card (Monthly Exam, Semester Exam, Degree Exam)
2. Fee Register
3. Leave Register
4. Attendance Register
5. Reading Status
6. Daily Routine Status
7. Achievements
8. Login for admin, teachers and students

**Out of scope (unless added later, priced separately):**

- Parent logins
- SMS/WhatsApp alerts
- Online fee payment
- Native mobile app
- Multi-institution support

## 3. Users and roles

| Role    | Who              | Can do                                        |
| ------- | ---------------- | --------------------------------------------- |
| Admin   | Office/principal | Everything, including fees                    |
| Teacher | Staff            | Manage data for their assigned classes only   |
| Student | 110 students     | View own data only; submit own leave requests |

A class can have several teachers. A teacher can have several classes.

## 4. Permission matrix

| Module                             | Admin                          | Teacher (own classes)              | Student (self)           |
| ---------------------------------- | ------------------------------ | ---------------------------------- | ------------------------ |
| Users, classes, students, teachers | Full                           | Read students in own classes       | Read own profile         |
| Attendance                         | Full                           | Create/edit                        | Read                     |
| Fee register                       | Full (only role that can edit) | No access                          | Read own                 |
| Leave                              | Full                           | Create for student, approve/reject | Create request, read own |
| Progress card / marks              | Full                           | Create/edit                        | Read own                 |
| Reading status                     | Full                           | Create/edit                        | Read own                 |
| Daily routine                      | Full                           | Create/edit                        | Read own                 |
| Achievements                       | Full                           | Create/edit                        | Read own                 |

## 5. Assumptions (confirm with the client)

- **A1:** Reading status and daily routine are entered by teachers. Students only view. _(Client has not answered. If students should fill them in, add student write access for those two modules.)_
- **A2:** Login is by email. If a student has no email, admin creates a login for them.
- **A3:** Fee register shows charges, payments, and balance due, with payment history. No online payments.
- **A4:** UI language is English.
- **A5:** Progress card layout follows the client's current paper format (get a photo/sample before Phase 4).
- **A6:** Yearly rollover (promote class, archive) is done by admin.

## 6. Tech stack

| Layer          | Choice                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hosting        | Single Cloudflare Worker serving the API (`/api/*`) and the built frontend (static assets)                                                             |
| API            | TypeScript + Hono                                                                                                                                      |
| Database       | Cloudflare D1 (SQLite)                                                                                                                                 |
| ORM/migrations | Drizzle ORM + drizzle-kit                                                                                                                              |
| Files          | Cloudflare R2 (achievement photos)                                                                                                                     |
| Frontend       | React + Vite + TypeScript + Tailwind CSS                                                                                                               |
| Validation     | Zod (shared between API and frontend)                                                                                                                  |
| Auth           | Session cookies (HttpOnly, Secure, SameSite=Lax). Use a well-maintained auth library or WebCrypto-based password hashing. Never store plain passwords. |
| Email          | Resend (or similar) for password reset                                                                                                                 |
| Deploy         | Wrangler                                                                                                                                               |
| Tests          | Vitest                                                                                                                                                 |

Same-origin (one Worker) means no CORS problems and simple cookies.

**Ownership rule:** everything is deployed in the **client's** Cloudflare account, with the developer invited as a member.

## 7. Project structure

```
/
├─ SRS.md
├─ AGENTS.md            (rules for the agent, see Section 11)
├─ wrangler.jsonc
├─ drizzle.config.ts
├─ package.json
├─ migrations/
├─ src/
│  ├─ worker/           (Hono API)
│  │  ├─ index.ts
│  │  ├─ middleware/    (auth, role, class-scope)
│  │  ├─ routes/        (one file per module)
│  │  ├─ db/            (schema.ts, queries)
│  │  └─ lib/           (email, pdf helpers, csv)
│  ├─ web/              (React app)
│  │  ├─ pages/
│  │  ├─ components/
│  │  └─ lib/api.ts
│  └─ shared/           (zod schemas, types)
└─ tests/
```

## 8. Data model (D1)

All tables have `id` (integer primary key), `created_at`, `updated_at`. Dates stored as ISO text (`YYYY-MM-DD`). Money stored as **integer rupees**.

**Auth and people**

- `users`: email (unique), password_hash, role (`admin|teacher|student`), is_active, must_change_password
- `sessions`: user_id, expires_at, token hash
- `teachers`: user_id, name, phone
- `students`: user_id, admission_no (unique), name, class_id, phone, status (`active|inactive`)

**Academic structure**

- `academic_years`: name, is_current
- `classes`: name, academic_year_id
- `class_teachers`: class_id, teacher_id (unique pair)
- `subjects`: class_id, name

**Modules**

- `attendance`: student_id, class_id, date, status (`present|absent|late|leave`), marked_by. **Unique (student_id, date).**
- `exams`: class_id, type (`monthly|semester|degree`), name, exam_date, academic_year_id
- `exam_marks`: exam_id, student_id, subject_id, marks, max_marks, remarks. **Unique (exam_id, student_id, subject_id).**
- `fee_items`: student_id, title, amount, due_date
- `fee_payments`: fee_item_id, amount, paid_on, method, receipt_no, recorded_by
- `leaves`: student_id, from_date, to_date, reason, status (`pending|approved|rejected`), requested_by (user_id), decided_by, decided_at, decision_note
- `reading_logs`: student_id, log_date, title, progress (text), notes, entered_by
- `routine_items`: title, is_active (the checklist definition, e.g. prayer, study time)
- `routine_logs`: student_id, item_id, log_date, done (0/1), entered_by. **Unique (student_id, item_id, log_date).**
- `achievements`: student_id, title, description, category, achieved_on, image_key (R2), added_by
- `audit_log`: user_id, action, entity, entity_id, details (JSON), created_at. **Must record every fee change.**

Add indexes on `student_id`, `class_id`, and `date` columns used in filters.

## 9. Functional requirements

### 9.1 Authentication

- FR-A1: Login with email + password.
- FR-A2: Logout ends the session.
- FR-A3: Forgot/reset password by email link (token expires in 1 hour, single use).
- FR-A4: Admin can create users, deactivate users, and reset a password (sets a temporary one and `must_change_password`).
- FR-A5: Login attempts are rate limited.
- FR-A6: Admin can bulk-create students from a CSV (columns: name, admission_no, email, class, phone). Show a preview and errors before importing.

### 9.2 Students, teachers, classes

- FR-S1: Admin CRUD for classes, subjects, students, teachers.
- FR-S2: Admin assigns one or more teachers to a class.
- FR-S3: Teachers see only students in their assigned classes.
- FR-S4: Admin can promote a class to the next academic year (move students, keep history).

### 9.3 Attendance

- FR-AT1: Teacher opens a class + date and marks all students (default present) in one screen, then saves.
- FR-AT2: Editing past dates is allowed for teachers and admin. Log who changed it.
- FR-AT3: Approved leave for a date shows as `leave` in attendance.
- FR-AT4: Monthly attendance summary per student and per class (present days, absent days, percentage).
- FR-AT5: Student sees own calendar/list and percentage.

### 9.4 Fee register (admin only edits)

- FR-F1: Admin adds fee items for a student or for a whole class (bulk).
- FR-F2: Admin records payments against a fee item, with a receipt number.
- FR-F3: Show per-student totals: charged, paid, balance.
- FR-F4: Admin sees a dues list (filter by class, by overdue).
- FR-F5: Every create/update/delete is written to `audit_log`.
- FR-F6: Student sees only their own fee items, payments, balance.
- FR-F7: Teachers have **no access** to any fee endpoint.

### 9.5 Leave register

- FR-L1: Student submits a leave request (dates + reason). Status starts `pending`.
- FR-L2: A teacher of that student's class (or admin) approves or rejects, with an optional note.
- FR-L3: Teacher or admin can also create a leave directly on a student's behalf (auto-approved).
- FR-L4: Student sees the status of their own requests.
- FR-L5: Overlapping approved leaves for the same student are rejected by validation.

### 9.6 Progress card

- FR-P1: Teacher/admin creates an exam (type: monthly, semester, degree) for a class, with its subjects.
- FR-P2: Teacher/admin enters marks per student per subject (grid screen).
- FR-P3: System calculates total, percentage, and grade. **Grade boundaries are configurable by admin** (placeholder until the client gives their scale).
- FR-P4: Progress card page per student per exam type, showing all exams of that type for the academic year, with print-friendly CSS so it saves as PDF from the browser.
- FR-P5: Student sees own progress cards only.

### 9.7 Reading status

- FR-R1: Teacher/admin adds reading entries per student (date, title, progress, notes).
- FR-R2: Student sees own history, newest first.

### 9.8 Daily routine status

- FR-D1: Admin defines the routine checklist items.
- FR-D2: Teacher marks each item done/not done per student per day (class grid screen).
- FR-D3: Student sees own daily and weekly view.

### 9.9 Achievements

- FR-AC1: Teacher/admin adds an achievement (title, description, category, date, optional photo).
- FR-AC2: Photos are uploaded to R2 (max 5 MB, images only). Serve them through the Worker with an auth check, not as public URLs.
- FR-AC3: Student sees own achievements.

### 9.10 Dashboards

- Admin: total students, today's attendance, fees due, pending leaves.
- Teacher: own classes, today's attendance status, pending leave requests.
- Student: attendance %, fee balance, latest exam, recent achievements, pending leave.

## 10. Non-functional requirements

**Security (highest priority)**

- NFR-S1: Every API route checks login and role. Deny by default.
- NFR-S2: Access scope is enforced **on the server** in shared middleware/helpers (never only in the UI):
  - Student: `student.user_id == session.user_id`
  - Teacher: the student's class is in the teacher's `class_teachers`
- NFR-S3: Validate all input with Zod. Use parameterized queries (Drizzle does this).
- NFR-S4: Cookies HttpOnly + Secure + SameSite. Sessions expire after inactivity.
- NFR-S5: Secrets (email API key etc.) live in Wrangler secrets, never in the repo.
- NFR-S6: Student data is personal data. Do not log it in plain text.

**Performance:** pages load under 3 seconds on a mid-range phone with average mobile data. About 110 students, so no heavy optimization is needed.

**Usability:** mobile-first, works on screens from 360px wide. Large tap targets. Attendance and marks screens must be fast to use on a phone.

**Reliability and backup:**

- D1 point-in-time restore is enabled.
- A scheduled Worker (Cron Trigger) exports key tables to R2 weekly.
- Document the restore steps in `README.md`.

**Maintainability:** migrations via Drizzle only. No manual DB edits in production.

## 11. Rules for the agent (copy into AGENTS.md / workspace rules)

```
You are building the Student Management System described in SRS.md.

1. Read SRS.md before every task. Do not invent features beyond it.
2. Work on ONE phase at a time. Stop after finishing it and summarize.
3. Stack is fixed: Hono + TypeScript on Cloudflare Workers, D1 + Drizzle,
   R2, React + Vite + Tailwind, Zod, Vitest. Do not add other frameworks
   or databases. Ask before adding any new dependency.
4. Every API route must use auth + role middleware. Access scope
   (student = own data, teacher = own classes, fees = admin only) must
   be enforced on the server, in shared helpers, not repeated ad hoc.
5. Use Drizzle migrations for every schema change. Never edit the
   database by hand.
6. Validate all input with Zod schemas from src/shared.
7. Never hardcode secrets. Use Wrangler secrets and .dev.vars (gitignored).
8. Write tests for permissions first (who can/cannot access what),
   then for business logic.
9. Mobile-first UI. Keep components simple and consistent.
10. Before saying a phase is done: run typecheck, tests, and the local
    dev server, and list what you verified.
11. If a requirement is unclear or listed as an assumption, ask me
    instead of guessing.
12. Keep commits small with clear messages.
```

## 12. Build phases (give the agent one at a time)

Each phase has a suggested prompt. Paste the prompt, let the agent plan, **review the plan before it runs**, then review the result.

### Phase 0: Setup

**Goal:** working empty project running locally and deployable.
**Tasks:** scaffold the Worker (Hono) + Vite React app served as static assets, Wrangler config, D1 + R2 bindings, Drizzle setup, Tailwind, Vitest, lint/typecheck scripts, `.dev.vars.example`, README.
**Prompt:**

> Read SRS.md. Do Phase 0 only. Scaffold the project structure from Section 7 with Hono on Workers, a Vite React frontend served as static assets from the same Worker, D1 and R2 bindings, Drizzle, Tailwind, and Vitest. Add a `/api/health` route and a placeholder home page. Show me the plan first.

**Done when:** `npm run dev` works, `/api/health` responds, typecheck and tests pass.

### Phase 1: Auth, roles, users

**Goal:** login system with three roles and permission middleware.
**Tasks:** `users` and `sessions` tables, login/logout, password hashing, rate limiting, reset by email, role middleware, admin user management, seed script for the first admin.
**Prompt:**

> Do Phase 1 only: sections 9.1 and 10 (security). Create the users and sessions schema, login/logout, password reset by email, role middleware (`requireRole`), and an admin screen to create/deactivate users. Write permission tests first. Do not build any other module yet.

**Done when:** three roles can log in, wrong role gets 403, tests prove it.

### Phase 2: Classes, students, teachers, CSV import

**Prompt:**

> Do Phase 2 only: sections 9.2 and FR-A6. Build the academic year, classes, subjects, class_teachers, students, and teachers schema and CRUD, plus CSV import with preview and error report. Add the shared class-scope helper: a teacher can only access students in their classes; a student can only access their own record. Test both.

**Done when:** 110 sample students can be imported, teacher scoping tests pass.

### Phase 3: Attendance

**Prompt:**

> Do Phase 3 only: section 9.4 (Attendance, 9.3 in the SRS numbering: FR-AT1 to FR-AT5). Build the mark-attendance screen (mobile-friendly, default present), monthly summaries, and the student view. Use the class-scope helper.

**Done when:** a teacher can mark a class in under a minute on a phone.

### Phase 4: Progress card

> Before starting: get the client's real progress card format and grading scale.

**Prompt:**

> Do Phase 4 only: section 9.6. Build exams, subjects, marks entry grid, calculations, configurable grade boundaries, and the print-friendly progress card page for each exam type. Student view is read-only.

### Phase 5: Fee register

**Prompt:**

> Do Phase 5 only: section 9.4 (Fee register, FR-F1 to FR-F7). Admin-only write access, student read-own, teachers get 403. Write an audit_log entry on every change. Add tests proving teachers cannot read or write fees.

### Phase 6: Leave register

**Prompt:**

> Do Phase 6 only: section 9.5. Student request flow, teacher/admin approval, direct entry by staff, overlap validation, and the link to attendance status.

### Phase 7: Reading, routine, achievements

> Confirm Assumption A1 with the client first.

**Prompt:**

> Do Phase 7 only: sections 9.7, 9.8, 9.9. Reading logs, routine checklist and grid, achievements with R2 photo upload served through an authenticated route.

### Phase 8: Dashboards, polish, backups

**Prompt:**

> Do Phase 8 only: dashboards for the three roles, mobile polish, the weekly D1 export to R2 using a Cron Trigger, and the README with restore steps.

### Phase 9: Security review and handover

**Tasks:** review every route for missing auth, test with a student and teacher account trying to access other people's data, deploy to the **client's** Cloudflare account, hand over credentials, train staff.

## 13. Guidance for working with the agent

- **One phase per session.** Long, mixed tasks make agents drift.
- **Plan first.** Ask for the plan and read it before approving. Reject anything that adds features not in this SRS.
- **Tests before trust.** Permission tests are the most important tests in this project. Read them yourself.
- **Try it yourself.** After every phase, log in as each role and try to break it (for example, as a student, change the student ID in the URL).
- **Check dependencies.** If the agent wants to add a package, ask why and whether it works on Workers (no Node-only libraries).
- **Commit after each phase** so you can roll back.
- **Keep secrets out of prompts and code.**
- **Don't let it "fix" tests** by loosening permission checks. If a permission test fails, the code is wrong, not the test.

## 14. Acceptance criteria (final)

- All 7 client modules work for the roles in Section 4.
- A student can never see another student's data (verified by tests and manual attempts).
- A teacher can never see other classes or any fee data.
- 110 students imported and able to log in.
- Works on a phone.
- Backups run, and a restore has been tested once.
- Deployed in the client's Cloudflare account and documented in the README.

## 15. Open items for the client

1. Who enters reading status and daily routine (teachers or students)?
2. Do all students have email addresses?
3. Progress card format and grading scale (send a sample).
4. Fee detail: is paid/due with history enough?
5. Routine checklist items (what exactly is tracked daily)?
6. What counts as "reading status" (books, pages, portions)?
