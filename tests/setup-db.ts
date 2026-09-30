import { Miniflare } from 'miniflare';
import { drizzle } from 'drizzle-orm/d1';

export async function createTestDb() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: ['DB'],
  });

  const d1 = await mf.getD1Database('DB');

  const sql = `
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, is_active INTEGER DEFAULT 1 NOT NULL, must_change_password INTEGER DEFAULT 0 NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions (token_hash);
CREATE TABLE IF NOT EXISTS password_reset_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used INTEGER DEFAULT 0 NOT NULL, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_unique ON password_reset_tokens (token_hash);
CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, identifier TEXT NOT NULL, attempted_at TEXT NOT NULL, success INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id INTEGER, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, details TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS academic_years (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, is_current INTEGER DEFAULT 0 NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS academic_years_name_unique ON academic_years (name);
CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, phone TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS teachers_user_id_unique ON teachers (user_id);
CREATE TABLE IF NOT EXISTS class_teachers (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS class_teacher_unique ON class_teachers (class_id, teacher_id);
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, admission_no TEXT NOT NULL, name TEXT NOT NULL, class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL, phone TEXT, status TEXT DEFAULT 'active' NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_unique ON students (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS students_admission_no_unique ON students (admission_no);
CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL, date TEXT NOT NULL, status TEXT DEFAULT 'present' NOT NULL, marked_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_date_unique ON attendance (student_id, date);
CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL, type TEXT NOT NULL, name TEXT NOT NULL, exam_date TEXT NOT NULL, academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS exam_marks (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, marks INTEGER NOT NULL, max_marks INTEGER DEFAULT 50 NOT NULL, remarks TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS exam_student_subject_unique ON exam_marks (exam_id, student_id, subject_id);
CREATE TABLE IF NOT EXISTS grade_boundaries (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, grade TEXT NOT NULL, min_percentage INTEGER NOT NULL, max_percentage INTEGER NOT NULL, classification TEXT, is_pass INTEGER DEFAULT 1 NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fee_items (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL, academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE, title TEXT NOT NULL, amount INTEGER NOT NULL, due_date TEXT NOT NULL, remarks TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fee_payments (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, fee_item_id INTEGER NOT NULL REFERENCES fee_items(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, amount_paid INTEGER NOT NULL, payment_date TEXT NOT NULL, receipt_no TEXT NOT NULL, payment_method TEXT DEFAULT 'cash' NOT NULL, remarks TEXT, recorded_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS leaves (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, from_date TEXT NOT NULL, to_date TEXT NOT NULL, reason TEXT NOT NULL, status TEXT DEFAULT 'pending' NOT NULL, requested_by INTEGER NOT NULL REFERENCES users(id), decided_by INTEGER REFERENCES users(id), decided_at TEXT, decision_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL);


`.trim();

  await d1.exec(sql);

  const db = drizzle(d1);
  return { d1, db, mf };
}
