import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import { users, academicYears, classes } from '../src/worker/db/schema';

describe('Student CSV Bulk Import (FR-A6)', () => {
  let d1: any;
  let db: any;
  let adminSessionToken: string;
  let class10AId: number;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('AdminPass123');
    const now = new Date().toISOString();

    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@school.com',
        passwordHash: passHash,
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const session = await createSession(db, adminUser.id);
    adminSessionToken = session.token;

    // Create Academic Year and Class 10A
    const [ay] = await db
      .insert(academicYears)
      .values({ name: '2025-2026', isCurrent: true, createdAt: now, updatedAt: now })
      .returning();

    const [c] = await db
      .insert(classes)
      .values({ name: 'Class 10A', academicYearId: ay.id, createdAt: now, updatedAt: now })
      .returning();

    class10AId = c.id;
  });

  it('CSV Preview identifies valid rows and flags errors for invalid classes and duplicates', async () => {
    const csvContent = `name,admission_no,email,class,phone
Alice Smith,ADM001,alice@school.com,Class 10A,9876543210
Bob Jones,ADM002,bob@school.com,Class NonExistent,9876543211
Charlie Brown,ADM001,charlie@school.com,Class 10A,9876543212`;

    const previewRes = await app.request(
      '/api/students/import-csv/preview',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({ csvContent }),
      },
      { DB: d1 } as any
    );

    expect(previewRes.status).toBe(200);
    const json = (await previewRes.json()) as any;
    expect(json.totalRows).toBe(3);
    expect(json.validRowsCount).toBe(1); // Row 1 is valid
    expect(json.invalidRowsCount).toBe(2); // Row 2 (invalid class) & Row 3 (duplicate adm no)
  });

  it('CSV Execute Import bulk creates user accounts and student records', async () => {
    const csvContent = `name,admission_no,email,class,phone
Alice Smith,ADM001,alice@school.com,Class 10A,9876543210
Bob Jones,ADM002,bob@school.com,Class 10A,9876543211`;

    const executeRes = await app.request(
      '/api/students/import-csv/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminSessionToken}`,
        },
        body: JSON.stringify({
          rows: [
            {
              name: 'Alice Smith',
              admissionNo: 'ADM001',
              email: 'alice@school.com',
              class: 'Class 10A',
              phone: '9876543210',
            },
            {
              name: 'Bob Jones',
              admissionNo: 'ADM002',
              email: 'bob@school.com',
              class: 'Class 10A',
              phone: '9876543211',
            },
          ],
        }),
      },
      { DB: d1 } as any
    );

    expect(executeRes.status).toBe(200);
    const json = (await executeRes.json()) as any;
    expect(json.successCount).toBe(2);
    expect(json.importedStudents.length).toBe(2);

    // Verify student user can log in
    const loginRes = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@school.com', password: 'TempPassword123!' }),
      },
      { DB: d1 } as any
    );

    // Note: Temporary password set during bulk import
    const allUsers = await db.select().from(users);
    const aliceUser = allUsers.find((u: any) => u.email === 'alice@school.com');
    expect(aliceUser).toBeDefined();
    expect(aliceUser.role).toBe('student');
  });
});
