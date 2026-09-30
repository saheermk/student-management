import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/worker/index';
import { createTestDb } from './setup-db';
import { hashPassword } from '../src/worker/lib/crypto';
import { createSession } from '../src/worker/lib/auth';
import {
  users,
  students,
  academicYears,
  classes,
  auditLog,
} from '../src/worker/db/schema';

describe('Fee Register Business Logic Tests (FR-F1 to FR-F5)', () => {
  let d1: any;
  let db: any;
  let adminToken: string;

  let classId: number;
  let student1Id: number;
  let student2Id: number;
  let ayId: number;

  beforeEach(async () => {
    const testDb = await createTestDb();
    d1 = testDb.d1;
    db = testDb.db;

    const passHash = await hashPassword('Password123!');
    const now = new Date().toISOString();

    // 1. Create Admin
    const [adminUser] = await db
      .insert(users)
      .values({ email: 'admin@school.com', passwordHash: passHash, role: 'admin', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    adminToken = (await createSession(db, adminUser.id)).token;

    // 2. Create Academic Year & Class
    const [ay] = await db
      .insert(academicYears)
      .values({ name: '2025-2026', isCurrent: true, createdAt: now, updatedAt: now })
      .returning();
    ayId = ay.id;

    const [c1] = await db
      .insert(classes)
      .values({ name: 'Class 5A', academicYearId: ay.id, createdAt: now, updatedAt: now })
      .returning();
    classId = c1.id;

    // 3. Create 2 Active Students
    const [s1User] = await db
      .insert(users)
      .values({ email: 'student1@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    const [s1] = await db
      .insert(students)
      .values({ userId: s1User.id, admissionNo: 'ADM-501', name: 'Zaid Malik', classId, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student1Id = s1.id;

    const [s2User] = await db
      .insert(users)
      .values({ email: 'student2@school.com', passwordHash: passHash, role: 'student', isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now })
      .returning();
    const [s2] = await db
      .insert(students)
      .values({ userId: s2User.id, admissionNo: 'ADM-502', name: 'Omar Farooq', classId, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    student2Id = s2.id;
  });

  it('Admin creates fee item for a single student (FR-F1) and audit log is recorded (FR-F5)', async () => {
    const res = await app.request(
      '/api/fees',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          studentId: student1Id,
          classId,
          academicYearId: ayId,
          title: 'Annual Admission Fee',
          amount: 5000,
          dueDate: '2026-10-15',
          remarks: 'First installment',
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(201);
    const data: any = await res.json();
    expect(data.feeItem.id).toBeDefined();
    expect(data.feeItem.amount).toBe(5000);

    // Verify Audit Log entry created (FR-F5)
    const logs = await db.select().from(auditLog);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('CREATE_FEE_ITEM');
  });

  it('Admin creates bulk fee items for a whole class (FR-F1)', async () => {
    const res = await app.request(
      '/api/fees',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          classId,
          academicYearId: ayId,
          title: 'Term 1 Tuition Fee',
          amount: 3000,
          dueDate: '2026-08-01', // Overdue date
        }),
      },
      { DB: d1 } as any
    );

    expect(res.status).toBe(201);
    const data: any = await res.json();
    expect(data.createdCount).toBe(2); // Assigned to both student1 and student2

    // Verify Audit Log entry created (FR-F5)
    const logs = await db.select().from(auditLog);
    expect(logs.some((l: any) => l.action === 'BULK_CREATE_FEE_ITEMS')).toBe(true);
  });

  it('Admin records payment, calculates charged/paid/balance, and checks dues list with overdue filter (FR-F2, FR-F3, FR-F4, FR-F5)', async () => {
    // 1. Create Overdue Fee for Student 1
    const createRes = await app.request(
      '/api/fees',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          studentId: student1Id,
          classId,
          academicYearId: ayId,
          title: 'Exam Fee',
          amount: 2000,
          dueDate: '2026-01-01', // Past overdue date
        }),
      },
      { DB: d1 } as any
    );
    const feeItemObj = ((await createRes.json()) as any).feeItem;

    // 2. Record Partial Payment of 1200
    const paymentRes = await app.request(
      '/api/fees/payments',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${adminToken}`,
        },
        body: JSON.stringify({
          feeItemId: feeItemObj.id,
          studentId: student1Id,
          amountPaid: 1200,
          paymentDate: '2026-09-22',
          receiptNo: 'RCP-2026-001',
          paymentMethod: 'cash',
        }),
      },
      { DB: d1 } as any
    );

    expect(paymentRes.status).toBe(201);
    const paymentData: any = await paymentRes.json();
    expect(paymentData.payment.receiptNo).toBe('RCP-2026-001');

    // 3. Verify Student Totals (FR-F3): Charged = 2000, Paid = 1200, Balance = 800
    const summaryRes = await app.request(
      `/api/fees/student/${student1Id}`,
      { headers: { Cookie: `session_token=${adminToken}` } },
      { DB: d1 } as any
    );
    expect(summaryRes.status).toBe(200);
    const summaryData: any = await summaryRes.json();

    expect(summaryData.totals.totalCharged).toBe(2000);
    expect(summaryData.totals.totalPaid).toBe(1200);
    expect(summaryData.totals.balance).toBe(800);
    expect(summaryData.feeItems[0].isOverdue).toBe(true);

    // 4. Admin Dues List Filter by Overdue (FR-F4)
    const duesRes = await app.request(
      `/api/fees?classId=${classId}&isOverdue=true`,
      { headers: { Cookie: `session_token=${adminToken}` } },
      { DB: d1 } as any
    );
    expect(duesRes.status).toBe(200);
    const duesData: any = await duesRes.json();

    expect(duesData.summary.overdueCount).toBe(1);
    expect(duesData.summary.dues[0].balance).toBe(800);

    // 5. Verify Audit Logs for Payment
    const logs = await db.select().from(auditLog);
    expect(logs.some((l: any) => l.action === 'RECORD_FEE_PAYMENT')).toBe(true);
  });
});
