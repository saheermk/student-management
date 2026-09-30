import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users, students, classes, subjects } from '../db/schema';
import {
  CsvPreviewRowResult,
  CsvPreviewResponse,
  SubjectCsvPreviewResponse,
  SubjectCsvPreviewRowResult,
} from '../../shared/types';
import { csvImportRowSchema, CsvImportRow } from '../../shared/schemas';

export function parseCsvText(csvContent: string): Record<string, string>[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  // Parse header
  const rawHeaders = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
  
  // Map raw header names to schema field names
  const headerMap: Record<number, keyof CsvImportRow> = {};
  rawHeaders.forEach((h, index) => {
    if (h.includes('name') && !h.includes('class')) headerMap[index] = 'name';
    else if (h.includes('admission') || h.includes('adm') || h.includes('reg')) headerMap[index] = 'admissionNo';
    else if (h.includes('email')) headerMap[index] = 'email';
    else if (h.includes('class')) headerMap[index] = 'class';
    else if (h.includes('phone') || h.includes('mobile')) headerMap[index] = 'phone';
  });

  const parsedRows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const rowObj: Record<string, string> = {
      name: '',
      admissionNo: '',
      email: '',
      class: '',
      phone: '',
    };

    values.forEach((val, idx) => {
      const mappedKey = headerMap[idx];
      if (mappedKey) {
        rowObj[mappedKey] = val;
      }
    });

    parsedRows.push(rowObj);
  }

  return parsedRows;
}

export async function previewStudentCsv(
  db: ReturnType<typeof drizzle>,
  csvContent: string
): Promise<CsvPreviewResponse> {
  const rawRows = parseCsvText(csvContent);

  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 0,
      results: [],
    };
  }

  // Fetch all existing classes for lookup
  const allClasses = await db.select().from(classes);
  const classMap = new Map<string, number>();
  allClasses.forEach((c) => {
    classMap.set(c.name.toLowerCase(), c.id);
  });

  // Fetch existing emails and admission numbers from DB
  const existingUsers = await db.select({ email: users.email }).from(users);
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  const existingStudents = await db.select({ admissionNo: students.admissionNo }).from(students);
  const existingAdmNos = new Set(existingStudents.map((s) => s.admissionNo.toLowerCase()));

  // Duplicate tracking inside CSV
  const csvEmails = new Set<string>();
  const csvAdmNos = new Set<string>();

  const results: CsvPreviewRowResult[] = [];
  let validCount = 0;
  let invalidCount = 0;

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Line 1 is header
    const rowErrors: string[] = [];

    // Zod schema check
    const parseRes = csvImportRowSchema.safeParse(row);
    if (!parseRes.success) {
      const fieldErrors = parseRes.error.flatten().fieldErrors;
      Object.entries(fieldErrors).forEach(([field, msgs]) => {
        if (msgs) rowErrors.push(`${field}: ${msgs.join(', ')}`);
      });
    }

    const emailLower = (row.email || '').toLowerCase();
    const admNoLower = (row.admissionNo || '').toLowerCase();
    const classNameLower = (row.class || '').toLowerCase();

    // Check class existence in DB
    if (classNameLower && !classMap.has(classNameLower)) {
      rowErrors.push(`Class "${row.class}" does not exist in database`);
    }

    // Check DB duplicates
    if (emailLower && existingEmails.has(emailLower)) {
      rowErrors.push(`Email "${row.email}" is already registered in database`);
    }
    if (admNoLower && existingAdmNos.has(admNoLower)) {
      rowErrors.push(`Admission No "${row.admissionNo}" is already registered in database`);
    }

    // Check CSV duplicates
    if (emailLower) {
      if (csvEmails.has(emailLower)) {
        rowErrors.push(`Duplicate email "${row.email}" within CSV file`);
      } else {
        csvEmails.add(emailLower);
      }
    }

    if (admNoLower) {
      if (csvAdmNos.has(admNoLower)) {
        rowErrors.push(`Duplicate admission number "${row.admissionNo}" within CSV file`);
      } else {
        csvAdmNos.add(admNoLower);
      }
    }

    const isValid = rowErrors.length === 0;
    if (isValid) validCount++;
    else invalidCount++;

    results.push({
      rowNumber,
      data: {
        name: row.name || '',
        admissionNo: row.admissionNo || '',
        email: row.email || '',
        class: row.class || '',
        phone: row.phone || '',
      },
      isValid,
      errors: rowErrors,
    });
  });

  return {
    totalRows: rawRows.length,
    validRowsCount: validCount,
    invalidRowsCount: invalidCount,
    results,
  };
}

export async function previewSubjectCsv(
  db: ReturnType<typeof drizzle>,
  csvContent: string,
  targetClassId: number
): Promise<SubjectCsvPreviewResponse> {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 0,
      results: [],
    };
  }

  // Check if first line is a header
  let startIdx = 0;
  const firstLineLower = lines[0].toLowerCase();
  if (firstLineLower.includes('subject') || firstLineLower.includes('name')) {
    startIdx = 1;
  }

  const subjectNames: { rowNumber: number; name: string }[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const rawVal = lines[i].split(',')[0].trim().replace(/^["']|["']$/g, '');
    subjectNames.push({ rowNumber: i + 1, name: rawVal });
  }

  // Fetch existing subjects for the class
  const existingSubs = await db
    .select({ name: subjects.name })
    .from(subjects)
    .where(eq(subjects.classId, targetClassId));
  const existingNames = new Set(existingSubs.map((s) => s.name.toLowerCase()));

  const csvSubjectSet = new Set<string>();
  const results: SubjectCsvPreviewRowResult[] = [];
  let validCount = 0;
  let invalidCount = 0;

  subjectNames.forEach(({ rowNumber, name }) => {
    const rowErrors: string[] = [];

    if (!name || name.trim().length === 0) {
      rowErrors.push('Subject name is required');
    } else {
      const nameLower = name.trim().toLowerCase();
      if (existingNames.has(nameLower)) {
        rowErrors.push(`Subject "${name}" already exists in this class`);
      } else if (csvSubjectSet.has(nameLower)) {
        rowErrors.push(`Duplicate subject "${name}" within CSV file`);
      } else {
        csvSubjectSet.add(nameLower);
      }
    }

    const isValid = rowErrors.length === 0;
    if (isValid) validCount++;
    else invalidCount++;

    results.push({
      rowNumber,
      data: { name },
      isValid,
      errors: rowErrors,
    });
  });

  return {
    totalRows: subjectNames.length,
    validRowsCount: validCount,
    invalidRowsCount: invalidCount,
    results,
  };
}
