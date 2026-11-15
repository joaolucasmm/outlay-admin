import {
  err,
  ok,
  validateEmployeeImport,
  type EmployeeField,
  type EmployeeRowInput,
  type Result,
} from '@outlay/domain';
import type { EmployeeInput } from 'contracts';
import Papa from 'papaparse';

export const MAX_ROWS = 1000;
export const MAX_BYTES = 1_000_000;

const COLUMNS: readonly EmployeeField[] = ['name', 'email', 'role', 'costCenter'];

/** Accepted header spellings → field. Matching ignores case and surrounding spaces. */
const HEADER_ALIASES: Record<string, EmployeeField> = {
  name: 'name',
  email: 'email',
  role: 'role',
  costcenter: 'costCenter',
  'cost center': 'costCenter',
  cost_center: 'costCenter',
};

export interface ImportRowError {
  /** Line in the file (the header is line 1). */
  line: number;
  row: EmployeeRowInput;
  errors: string[];
}

export interface ValidImportRow {
  line: number;
  employee: EmployeeInput;
}

/** A parsed CSV, ready to preview, import or keep in the onboarding draft. */
export interface EmployeeImportPreview {
  fileName: string;
  valid: ValidImportRow[];
  invalid: ImportRowError[];
}

const isBlank = (row: Record<string, string | undefined>) =>
  Object.values(row).every((value) => (value ?? '').trim() === '');

/**
 * Parses an employee CSV (comma, semicolon or tab separated; UTF-8 with or without BOM)
 * and validates every row with the domain rules. File-level problems (missing columns,
 * no rows, too many rows) are an error; row-level problems end up in `invalid`.
 */
export function parseEmployeeCsv(
  text: string,
  fileName: string,
  existingEmails: Iterable<string> = [],
): Result<EmployeeImportPreview, string> {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: false,
    delimitersToGuess: [',', ';', '\t'],
    transformHeader: (header) => HEADER_ALIASES[header.trim().toLowerCase()] ?? header.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const missing = COLUMNS.filter((column) => !fields.includes(column));
  if (missing.length > 0) {
    return err(
      `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Expected: ${COLUMNS.join(', ')}.`,
    );
  }

  // Keep the original position of each row so errors can point at the file's line.
  const rows = parsed.data
    .map((data, index) => ({ data, line: index + 2 }))
    .filter(({ data }) => !isBlank(data));
  if (rows.length === 0) return err('The file has no employee rows.');
  if (rows.length > MAX_ROWS) {
    return err(`The file has ${rows.length} rows; the limit is ${MAX_ROWS}.`);
  }

  const inputs: EmployeeRowInput[] = rows.map(({ data }) => ({
    name: data.name ?? '',
    email: data.email ?? '',
    role: data.role ?? '',
    costCenter: data.costCenter ?? '',
  }));
  const lineOf = (index: number) => rows[index]?.line ?? index + 2;
  const result = validateEmployeeImport(inputs, existingEmails);

  return ok({
    fileName,
    valid: result.valid.map(({ index, employee }) => ({ line: lineOf(index), employee })),
    invalid: result.invalid.map(({ index, row, errors }) => ({
      line: lineOf(index),
      row,
      errors: errors.map((e) => e.message),
    })),
  });
}

/** The rows that failed, with their problems, as a CSV the user can fix and re-upload. */
export const errorReportCsv = (invalid: readonly ImportRowError[]): string =>
  Papa.unparse({
    fields: ['line', ...COLUMNS, 'errors'],
    data: invalid.map(({ line, row, errors }) => [
      line,
      row.name,
      row.email,
      row.role,
      row.costCenter,
      errors.join('; '),
    ]),
  });

export const TEMPLATE_CSV = [
  'name,email,role,costCenter',
  'Ana Souza,ana.souza@example.com,manager,OPS',
  'Bruno Lima,bruno.lima@example.com,employee,SALES',
  'Carla Costa,carla.costa@example.com,director,FIN',
].join('\n');
