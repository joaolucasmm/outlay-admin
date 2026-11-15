import type { EmployeeInput, EmployeeRole } from 'contracts';
import type { FieldError } from './category';
import { EMPLOYEE_ROLES } from './policy';
import { err, ok, type Result } from './result';

/** One row as it comes from a CSV file: raw, untrimmed strings. */
export interface EmployeeRowInput {
  name: string;
  email: string;
  role: string;
  costCenter: string;
}

export type EmployeeField = keyof EmployeeRowInput;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Validates and normalises one employee (trimmed, email and role lowercased). */
export function validateEmployeeRow(
  row: EmployeeRowInput,
): Result<EmployeeInput, FieldError<EmployeeField>[]> {
  const errors: FieldError<EmployeeField>[] = [];
  const name = row.name.trim();
  const email = normalizeEmail(row.email);
  const role = row.role.trim().toLowerCase();
  const costCenter = row.costCenter.trim();

  if (name.length === 0 || name.length > 100) {
    errors.push({ field: 'name', message: 'Name is required (up to 100 characters).' });
  }
  if (!EMAIL.test(email) || email.length > 254) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (!EMPLOYEE_ROLES.includes(role as EmployeeRole)) {
    errors.push({ field: 'role', message: 'Role must be employee, manager or director.' });
  }
  if (costCenter.length === 0 || costCenter.length > 40) {
    errors.push({ field: 'costCenter', message: 'Cost center is required (up to 40 characters).' });
  }

  return errors.length > 0
    ? err(errors)
    : ok({ name, email, role: role as EmployeeRole, costCenter });
}

export interface ValidImportRow {
  /** 0-based position in the input. */
  index: number;
  employee: EmployeeInput;
}

export interface InvalidImportRow {
  index: number;
  row: EmployeeRowInput;
  errors: FieldError<EmployeeField>[];
}

export interface ImportValidation {
  valid: ValidImportRow[];
  invalid: InvalidImportRow[];
}

/**
 * Splits rows into valid and invalid. Besides the per-row rules, an email is invalid
 * if the tenant already has it or if it appears more than once in the file (then every
 * copy is flagged, so the user decides which one to keep).
 */
export function validateEmployeeImport(
  rows: readonly EmployeeRowInput[],
  existingEmails: Iterable<string>,
): ImportValidation {
  const existing = new Set([...existingEmails].map(normalizeEmail));
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (seen.has(email)) repeated.add(email);
    seen.add(email);
  }

  const result: ImportValidation = { valid: [], invalid: [] };
  rows.forEach((row, index) => {
    const checked = validateEmployeeRow(row);
    const errors = checked.ok ? [] : [...checked.error];
    const email = normalizeEmail(row.email);
    if (checked.ok && existing.has(email)) {
      errors.push({ field: 'email', message: 'An employee with this email already exists.' });
    }
    if (checked.ok && repeated.has(email)) {
      errors.push({ field: 'email', message: 'This email appears more than once in the file.' });
    }
    if (checked.ok && errors.length === 0) {
      result.valid.push({ index, employee: checked.value });
    } else {
      result.invalid.push({ index, row, errors });
    }
  });
  return result;
}
