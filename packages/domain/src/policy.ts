import type {
  ApprovalLevels,
  EmployeeRole,
  ExpenseCategory,
  PolicyCheckResult,
  PolicyFinding,
  PolicyRule,
  PolicyRuleInput,
} from 'contracts';
import type { FieldError } from './category';
import { err, ok, type Result } from './result';

export const EMPLOYEE_ROLES: readonly EmployeeRole[] = ['employee', 'manager', 'director'];

type RuleField = 'limitMinor' | 'receiptRequiredAboveMinor' | 'approvalLevels';
export type PolicyRuleFields = Pick<PolicyRuleInput, RuleField>;

const isNonNegativeInteger = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** Rules for one cell of the policy grid. Shared by the grid form and the backend. */
export function validatePolicyRule(
  rule: PolicyRuleFields,
): Result<PolicyRuleFields, FieldError<RuleField>[]> {
  const errors: FieldError<RuleField>[] = [];
  if (!isNonNegativeInteger(rule.limitMinor)) {
    errors.push({ field: 'limitMinor', message: 'The limit must be zero or more.' });
  }
  if (!isNonNegativeInteger(rule.receiptRequiredAboveMinor)) {
    errors.push({
      field: 'receiptRequiredAboveMinor',
      message: 'The receipt threshold must be zero or more.',
    });
  } else if (rule.receiptRequiredAboveMinor > rule.limitMinor) {
    errors.push({
      field: 'receiptRequiredAboveMinor',
      message: 'The receipt threshold cannot be above the limit.',
    });
  }
  if (![0, 1, 2].includes(rule.approvalLevels)) {
    errors.push({ field: 'approvalLevels', message: 'Approvals must be 0, 1 or 2.' });
  }
  return errors.length > 0 ? err(errors) : ok(rule);
}

/**
 * What the policy engine judges. Built from the receipt extraction *after* the user
 * reviewed it: the engine never sees model output or confidence scores (ADR 0003).
 */
export interface Expense {
  amountMinor: number;
  currency: string;
  receipt: 'readable' | 'unreadable' | 'missing';
}

export interface CheckExpenseInput {
  expense: Expense;
  categoryCode: string;
  employeeRole: EmployeeRole;
  tenantCurrency: string;
  categories: readonly ExpenseCategory[];
  rules: readonly PolicyRule[];
}

export interface CheckExpenseOptions {
  /** Formats minor units in the tenant currency. Injected so formatting stays at the edge. */
  formatMoney: (minor: number) => string;
}

const finding = (
  code: string,
  severity: PolicyFinding['severity'],
  message: string,
): PolicyFinding => ({ code, severity, message });

const statusOf = (findings: PolicyFinding[]): PolicyCheckResult['status'] =>
  findings.some((f) => f.severity === 'error')
    ? 'violation'
    : findings.some((f) => f.severity === 'warn')
      ? 'needs_approval'
      : 'compliant';

const result = (findings: PolicyFinding[], approvals: ApprovalLevels = 0): PolicyCheckResult => ({
  status: statusOf(findings),
  findings,
  requiredApprovalLevels: approvals,
});

/**
 * Deterministic compliance check. Runs every applicable check and returns the worst
 * status, with one explainable finding per check:
 * currency → category → rule for the role → limit → receipt → approvals.
 */
export function checkExpense(
  { expense, categoryCode, employeeRole, tenantCurrency, categories, rules }: CheckExpenseInput,
  { formatMoney }: CheckExpenseOptions,
): PolicyCheckResult {
  const findings: PolicyFinding[] = [];

  const sameCurrency = expense.currency === tenantCurrency;
  if (!sameCurrency) {
    findings.push(
      finding(
        'currency_mismatch',
        'error',
        `The expense is in ${expense.currency}, but this program's limits are in ${tenantCurrency}.`,
      ),
    );
  }

  const category = categories.find((c) => c.code === categoryCode);
  if (!category) {
    findings.push(finding('unknown_category', 'error', `There is no "${categoryCode}" category.`));
    return result(findings);
  }
  if (!category.active) {
    findings.push(
      finding('inactive_category', 'error', `The "${category.name}" category is inactive.`),
    );
  }

  const rule = rules.find((r) => r.categoryId === category.id && r.role === employeeRole);
  if (!rule) {
    findings.push(
      finding(
        'no_policy',
        'error',
        `"${category.name}" is not allowed for the ${employeeRole} role.`,
      ),
    );
    return result(findings);
  }

  // Amounts in another currency can't be compared with the limits.
  if (sameCurrency) {
    findings.push(
      expense.amountMinor > rule.limitMinor
        ? finding(
            'over_limit',
            'error',
            `${formatMoney(expense.amountMinor)} is above the ${formatMoney(rule.limitMinor)} limit.`,
          )
        : finding('within_limit', 'info', `Within the ${formatMoney(rule.limitMinor)} limit.`),
    );

    const receiptRequired = expense.amountMinor > rule.receiptRequiredAboveMinor;
    if (!receiptRequired) {
      findings.push(
        finding(
          'receipt_not_required',
          'info',
          `No receipt needed up to ${formatMoney(rule.receiptRequiredAboveMinor)}.`,
        ),
      );
    } else if (expense.receipt === 'readable') {
      findings.push(finding('receipt_ok', 'info', 'A readable receipt is attached.'));
    } else {
      findings.push(
        finding(
          'receipt_required',
          'error',
          `A readable receipt is required above ${formatMoney(rule.receiptRequiredAboveMinor)}${
            expense.receipt === 'unreadable' ? ', and this one could not be read' : ''
          }.`,
        ),
      );
    }
  }

  findings.push(
    rule.approvalLevels > 0
      ? finding(
          'needs_approval',
          'warn',
          `Needs ${rule.approvalLevels} level${rule.approvalLevels > 1 ? 's' : ''} of approval.`,
        )
      : finding('auto_approved', 'info', 'Approved automatically.'),
  );

  return result(findings, rule.approvalLevels);
}
