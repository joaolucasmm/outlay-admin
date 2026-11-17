import type { AdminRole, CategoryCreate, TenantStatus } from 'contracts';
import { describe, expect, it } from 'vitest';
import cases from '../fixtures/program-cases.json';
import { validateCategoryFields } from './category';
import { validateEmployeeImport, validateEmployeeRow } from './employee';
import { validatePolicyRule, type PolicyRuleFields } from './policy';
import { ok } from './result';
import { programFromTemplate, type TemplateProgram } from './template';
import { programWriteAccess } from './tenantAccess';

/**
 * The tenant program rules as data in fixtures/program-cases.json. The Java tenant API
 * runs the very same cases (services/tenant-api), so both implementations stay identical.
 */
type Expect<T> =
  { ok: true; value: T } | { ok: false; errors: { field: string; message: string }[] };

const asResult = <T>(expected: Expect<T>) =>
  expected.ok ? ok(expected.value) : { ok: false, error: expected.errors };

const named = <T extends { name: string }>(list: T[]) => list.map((c) => [c.name, c] as const);

describe('programWriteAccess (shared fixture)', () => {
  it.each(cases.programWriteAccess.map((c) => [c.role, c.status, c.expect] as const))(
    '%s on a %s tenant → %s',
    (role, status, expected) => {
      const result = programWriteAccess(role as AdminRole, { status: status as TenantStatus });
      expect(result).toEqual(expected === 'ok' ? ok(true) : { ok: false, error: expected });
    },
  );
});

describe('validateCategoryFields (shared fixture)', () => {
  it.each(named(cases.categoryFields))('%s', (_name, c) => {
    expect(validateCategoryFields(c.input as Partial<CategoryCreate>)).toEqual(
      asResult(c.expect as Expect<unknown>),
    );
  });
});

describe('validatePolicyRule (shared fixture)', () => {
  it.each(named(cases.policyRule))('%s', (_name, c) => {
    expect(validatePolicyRule(c.input as PolicyRuleFields)).toEqual(
      asResult(c.expect as Expect<unknown>),
    );
  });
});

describe('validateEmployeeRow (shared fixture)', () => {
  it.each(named(cases.employeeRow))('%s', (_name, c) => {
    expect(validateEmployeeRow(c.input)).toEqual(asResult(c.expect as Expect<unknown>));
  });
});

describe('validateEmployeeImport (shared fixture)', () => {
  it.each(named(cases.employeeImport))('%s', (_name, c) => {
    const result = validateEmployeeImport(c.rows, c.existingEmails);
    expect(result.valid.map((v) => v.index)).toEqual(c.expect.valid);
    expect(result.invalid.map(({ index, errors }) => ({ index, errors }))).toEqual(
      c.expect.invalid,
    );
  });
});

describe('programFromTemplate (shared fixture)', () => {
  it.each(named(cases.template))('%s', (_name, c) => {
    expect(programFromTemplate(c.tenant, new Set(c.skipCodes))).toEqual(
      c.expect as TemplateProgram,
    );
  });

  it('applies the whole template by default', () => {
    expect(programFromTemplate({ id: 'tnt_x', currency: 'EUR' }).categories).toHaveLength(6);
  });
});
