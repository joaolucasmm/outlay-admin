import type { ExpenseCategory, PolicyRule } from 'contracts';
import { describe, expect, it } from 'vitest';
import { checkExpense, validatePolicyRule, type CheckExpenseInput, type Expense } from './policy';

describe('validatePolicyRule', () => {
  it('accepts a valid rule', () => {
    const rule = { limitMinor: 10000, receiptRequiredAboveMinor: 2500, approvalLevels: 1 } as const;
    expect(validatePolicyRule(rule)).toEqual({ ok: true, value: rule });
  });

  it('accepts a receipt threshold equal to the limit', () => {
    expect(
      validatePolicyRule({ limitMinor: 100, receiptRequiredAboveMinor: 100, approvalLevels: 0 }).ok,
    ).toBe(true);
  });

  it('rejects a receipt threshold above the limit', () => {
    expect(
      validatePolicyRule({ limitMinor: 100, receiptRequiredAboveMinor: 101, approvalLevels: 0 }),
    ).toMatchObject({ ok: false, error: [{ field: 'receiptRequiredAboveMinor' }] });
  });

  it('rejects negative, fractional and out-of-range values', () => {
    const result = validatePolicyRule({
      limitMinor: -1,
      receiptRequiredAboveMinor: 1.5,
      approvalLevels: 3 as 0,
    });
    expect(result.ok ? [] : result.error.map((e) => e.field)).toEqual([
      'limitMinor',
      'receiptRequiredAboveMinor',
      'approvalLevels',
    ]);
  });
});

const category = (code: string, active = true): ExpenseCategory => ({
  id: `cat_${code}`,
  tenantId: 't1',
  code,
  name: code.charAt(0) + code.slice(1).toLowerCase(),
  glAccount: null,
  active,
});

const rule = (code: string, overrides: Partial<PolicyRule> = {}): PolicyRule => ({
  id: `pol_${code}`,
  tenantId: 't1',
  categoryId: `cat_${code}`,
  role: 'employee',
  limitMinor: 10000,
  receiptRequiredAboveMinor: 2500,
  approvalLevels: 0,
  ...overrides,
});

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  amountMinor: 2000,
  currency: 'BRL',
  receipt: 'readable',
  ...overrides,
});

const check = (overrides: Partial<CheckExpenseInput> = {}) =>
  checkExpense(
    {
      expense: expense(),
      categoryCode: 'MEALS',
      employeeRole: 'employee',
      tenantCurrency: 'BRL',
      categories: [category('MEALS'), category('GIFTS', false)],
      rules: [rule('MEALS'), rule('GIFTS')],
      ...overrides,
    },
    { formatMoney: (minor) => `$${minor / 100}` },
  );

const codes = (r: ReturnType<typeof check>) => r.findings.map((f) => f.code);

describe('checkExpense', () => {
  it('is compliant when every check passes, explaining each one', () => {
    const result = check();
    expect(result).toMatchObject({ status: 'compliant', requiredApprovalLevels: 0 });
    expect(codes(result)).toEqual(['within_limit', 'receipt_not_required', 'auto_approved']);
    expect(result.findings[0]?.message).toBe('Within the $100 limit.');
  });

  it('accepts an amount exactly at the limit', () => {
    expect(check({ expense: expense({ amountMinor: 10000 }) }).status).toBe('compliant');
  });

  it('flags an unknown category and stops there', () => {
    const result = check({ categoryCode: 'NOPE' });
    expect(result.status).toBe('violation');
    expect(codes(result)).toEqual(['unknown_category']);
  });

  it('flags an inactive category but still explains the rest', () => {
    const result = check({ categoryCode: 'GIFTS' });
    expect(result.status).toBe('violation');
    expect(codes(result)).toEqual([
      'inactive_category',
      'within_limit',
      'receipt_not_required',
      'auto_approved',
    ]);
  });

  it('flags a category not allowed for the role (no rule)', () => {
    const result = check({ employeeRole: 'director' });
    expect(result.status).toBe('violation');
    expect(codes(result)).toEqual(['no_policy']);
    expect(result.findings[0]?.message).toBe('"Meals" is not allowed for the director role.');
  });

  it('flags an amount over the limit', () => {
    const result = check({ expense: expense({ amountMinor: 12000 }) });
    expect(result.status).toBe('violation');
    expect(result.findings[0]).toEqual({
      code: 'over_limit',
      severity: 'error',
      message: '$120 is above the $100 limit.',
    });
  });

  it.each([
    ['missing', 'A readable receipt is required above $25.'],
    ['unreadable', 'A readable receipt is required above $25, and this one could not be read.'],
  ] as const)('requires a receipt above the threshold (%s)', (receipt, message) => {
    const result = check({ expense: expense({ amountMinor: 3000, receipt }) });
    expect(result.status).toBe('violation');
    expect(result.findings).toContainEqual({
      code: 'receipt_required',
      severity: 'error',
      message,
    });
  });

  it('accepts a readable receipt above the threshold', () => {
    expect(codes(check({ expense: expense({ amountMinor: 3000 }) }))).toContain('receipt_ok');
  });

  it('does not need a receipt at or below the threshold', () => {
    const result = check({ expense: expense({ amountMinor: 2500, receipt: 'missing' }) });
    expect(result.status).toBe('compliant');
  });

  it.each([
    [1, 'Needs 1 level of approval.'],
    [2, 'Needs 2 levels of approval.'],
  ] as const)('needs approval when the rule has %i level(s)', (approvalLevels, message) => {
    const result = check({ rules: [rule('MEALS', { approvalLevels })] });
    expect(result).toMatchObject({
      status: 'needs_approval',
      requiredApprovalLevels: approvalLevels,
    });
    expect(result.findings).toContainEqual({ code: 'needs_approval', severity: 'warn', message });
  });

  it('lets a violation win over needing approval', () => {
    const result = check({
      expense: expense({ amountMinor: 50000 }),
      rules: [rule('MEALS', { approvalLevels: 2 })],
    });
    expect(result).toMatchObject({ status: 'violation', requiredApprovalLevels: 2 });
  });

  it('flags another currency and skips amount checks it cannot make', () => {
    const result = check({ expense: expense({ currency: 'USD', amountMinor: 999999 }) });
    expect(result.status).toBe('violation');
    expect(codes(result)).toEqual(['currency_mismatch', 'auto_approved']);
    expect(result.findings[0]?.message).toBe(
      "The expense is in USD, but this program's limits are in BRL.",
    );
  });

  it('matches the rule by category and role', () => {
    const result = check({
      employeeRole: 'manager',
      rules: [rule('MEALS'), rule('MEALS', { role: 'manager', limitMinor: 500 })],
    });
    expect(codes(result)).toContain('over_limit');
  });
});
