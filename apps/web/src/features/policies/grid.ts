import { EMPLOYEE_ROLES, fromMinor, toMinor, validatePolicyRule } from '@outlay/domain';
import type {
  ApprovalLevels,
  EmployeeRole,
  ExpenseCategory,
  PolicyRule,
  PolicyRuleInput,
} from 'contracts';
import { z } from 'zod';

/** Form state of one grid cell. Money stays a string (major units) while editing. */
export interface Cell {
  allowed: boolean;
  limit: string;
  receiptAbove: string;
  approvals: '0' | '1' | '2';
}

export interface GridValues {
  cells: Record<string, Cell>;
}

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  employee: 'Employee',
  manager: 'Manager',
  director: 'Director',
};

const SEPARATOR = '__';
export const cellKey = (categoryId: string, role: EmployeeRole) =>
  `${categoryId}${SEPARATOR}${role}`;

const parseKey = (key: string): { categoryId: string; role: EmployeeRole } => {
  const at = key.lastIndexOf(SEPARATOR);
  return { categoryId: key.slice(0, at), role: key.slice(at + SEPARATOR.length) as EmployeeRole };
};

/** Server rules → form values: every (category, role) pair gets a cell, allowed or not. */
export function toGridValues(
  categories: readonly ExpenseCategory[],
  rules: readonly PolicyRule[],
  fractionDigits: number,
): GridValues {
  const cells: Record<string, Cell> = {};
  for (const category of categories) {
    for (const role of EMPLOYEE_ROLES) {
      const rule = rules.find((r) => r.categoryId === category.id && r.role === role);
      cells[cellKey(category.id, role)] = rule
        ? {
            allowed: true,
            limit: fromMinor(rule.limitMinor, fractionDigits),
            receiptAbove: fromMinor(rule.receiptRequiredAboveMinor, fractionDigits),
            approvals: String(rule.approvalLevels) as Cell['approvals'],
          }
        : { allowed: false, limit: '', receiptAbove: '', approvals: '0' };
    }
  }
  return { cells };
}

const RULE_FIELD_TO_CELL = {
  limitMinor: 'limit',
  receiptRequiredAboveMinor: 'receiptAbove',
  approvalLevels: 'approvals',
} as const;

const cellSchema = z.object({
  allowed: z.boolean(),
  limit: z.string(),
  receiptAbove: z.string(),
  approvals: z.enum(['0', '1', '2']),
});

/**
 * Validates every allowed cell: amounts are parsed in the tenant currency's decimals,
 * then checked with the same `validatePolicyRule` the backend runs.
 */
export const gridSchema = (fractionDigits: number) =>
  z.object({ cells: z.record(z.string(), cellSchema) }).superRefine(({ cells }, ctx) => {
    for (const [key, cell] of Object.entries(cells)) {
      if (!cell.allowed) continue;
      const limit = toMinor(cell.limit, fractionDigits);
      const receipt = toMinor(cell.receiptAbove, fractionDigits);
      if (!limit.ok) {
        ctx.addIssue({
          code: 'custom',
          path: ['cells', key, 'limit'],
          message: limit.error.message,
        });
      }
      if (!receipt.ok) {
        ctx.addIssue({
          code: 'custom',
          path: ['cells', key, 'receiptAbove'],
          message: receipt.error.message,
        });
      }
      if (!limit.ok || !receipt.ok) continue;
      const valid = validatePolicyRule({
        limitMinor: limit.value,
        receiptRequiredAboveMinor: receipt.value,
        approvalLevels: Number(cell.approvals) as ApprovalLevels,
      });
      if (valid.ok) continue;
      for (const error of valid.error) {
        ctx.addIssue({
          code: 'custom',
          path: ['cells', key, RULE_FIELD_TO_CELL[error.field]],
          message: error.message,
        });
      }
    }
  });

/** Validated form values → the PUT body. Only allowed cells become rules. */
export function toRuleInputs(values: GridValues, fractionDigits: number): PolicyRuleInput[] {
  return Object.entries(values.cells).flatMap(([key, cell]) => {
    if (!cell.allowed) return [];
    const limit = toMinor(cell.limit, fractionDigits);
    const receipt = toMinor(cell.receiptAbove, fractionDigits);
    if (!limit.ok || !receipt.ok) return [];
    return [
      {
        ...parseKey(key),
        limitMinor: limit.value,
        receiptRequiredAboveMinor: receipt.value,
        approvalLevels: Number(cell.approvals) as ApprovalLevels,
      },
    ];
  });
}
