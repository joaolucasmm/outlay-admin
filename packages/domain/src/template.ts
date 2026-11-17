import type { ApprovalLevels, EmployeeRole, ExpenseCategory, PolicyRule, Tenant } from 'contracts';
import template from '../fixtures/category-template.json';

/** One rule of the template: [limit, receiptRequiredAbove, approvalLevels], major units. */
export type TemplateRule = [limit: number, receiptAbove: number, approvals: ApprovalLevels];

export interface TemplateCategory {
  code: string;
  name: string;
  glAccount: string | null;
  active: boolean;
  /** A missing role means "not allowed". */
  rules: Partial<Record<EmployeeRole, TemplateRule>>;
}

/**
 * The standard program template, shared with the Java tenant API through
 * fixtures/category-template.json.
 */
export const CATEGORY_TEMPLATE = template.categories as TemplateCategory[];

/** Rough scale so limits look plausible in each currency. Display only. */
const SCALE: Readonly<Record<string, number>> = template.scale;

export interface TemplateProgram {
  categories: ExpenseCategory[];
  rules: PolicyRule[];
}

/**
 * The standard template for a tenant, in its currency, with stable ids. Categories whose
 * code is in `skipCodes` are left out, which makes applying the template idempotent.
 */
export function programFromTemplate(
  tenant: Pick<Tenant, 'id' | 'currency'>,
  skipCodes: ReadonlySet<string> = new Set(),
): TemplateProgram {
  // To minor units: every supported currency has 2 decimals.
  const scale = (SCALE[tenant.currency] ?? 1) * 100;
  const slug = tenant.id.replace(/^tnt_/, '');
  const categories: ExpenseCategory[] = [];
  const rules: PolicyRule[] = [];

  for (const spec of CATEGORY_TEMPLATE.filter((s) => !skipCodes.has(s.code))) {
    const categoryId = `cat_${slug}_${spec.code.toLowerCase()}`;
    categories.push({
      id: categoryId,
      tenantId: tenant.id,
      code: spec.code,
      name: spec.name,
      glAccount: spec.glAccount,
      active: spec.active,
    });
    for (const [role, rule] of Object.entries(spec.rules) as [EmployeeRole, TemplateRule][]) {
      const [limit, receiptAbove, approvals] = rule;
      rules.push({
        id: `pol_${slug}_${spec.code.toLowerCase()}_${role}`,
        tenantId: tenant.id,
        categoryId,
        role,
        limitMinor: limit * scale,
        receiptRequiredAboveMinor: receiptAbove * scale,
        approvalLevels: approvals,
      });
    }
  }
  return { categories, rules };
}
