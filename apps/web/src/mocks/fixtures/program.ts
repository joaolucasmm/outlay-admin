import type { ApprovalLevels, EmployeeRole, ExpenseCategory, PolicyRule, Tenant } from 'contracts';
import { seedTenants } from './seed';

type RuleSpec = [limit: number, receiptAbove: number, approvals: ApprovalLevels];

interface CategorySpec {
  code: string;
  name: string;
  glAccount: string | null;
  active: boolean;
  /** Major units in a "1x" currency; a missing role means "not allowed". */
  rules: Partial<Record<EmployeeRole, RuleSpec>>;
}

/** The default program template. Onboarding (M3) will reuse it. */
export const CATEGORY_TEMPLATE: CategorySpec[] = [
  {
    code: 'MEALS',
    name: 'Meals',
    glAccount: '6100',
    active: true,
    rules: { employee: [50, 25, 0], manager: [80, 25, 0], director: [150, 25, 0] },
  },
  {
    code: 'TRAVEL',
    name: 'Travel',
    glAccount: '6200',
    active: true,
    rules: { employee: [500, 0, 1], manager: [1000, 0, 1], director: [3000, 0, 0] },
  },
  {
    code: 'LODGING',
    name: 'Lodging',
    glAccount: '6210',
    active: true,
    rules: { employee: [200, 0, 1], manager: [300, 0, 1], director: [500, 0, 0] },
  },
  {
    code: 'OFFICE',
    name: 'Office supplies',
    glAccount: '6300',
    active: true,
    rules: { employee: [100, 30, 0], manager: [200, 30, 0], director: [300, 30, 0] },
  },
  {
    code: 'SOFTWARE',
    name: 'Software subscriptions',
    glAccount: null,
    active: false,
    rules: { employee: [50, 0, 1], manager: [200, 0, 1], director: [1000, 0, 1] },
  },
  {
    code: 'CLIENT_ENT',
    name: 'Client entertainment',
    glAccount: '6400',
    active: true,
    rules: { director: [500, 0, 2] },
  },
];

/** Rough scale so limits look plausible in each currency. Display only. */
const SCALE: Record<string, number> = { BRL: 5, MXN: 20 };

/**
 * The standard template for a tenant, in its currency. Categories whose code is in
 * `skipCodes` are left out, which makes applying the template idempotent.
 */
export function programFor(
  tenant: Pick<Tenant, 'id' | 'currency'>,
  skipCodes: ReadonlySet<string> = new Set(),
) {
  const scale = (SCALE[tenant.currency] ?? 1) * 100; // to minor units (all supported currencies have 2 decimals)
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
    for (const [role, rule] of Object.entries(spec.rules) as [EmployeeRole, RuleSpec][]) {
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

/** Every seed tenant gets the template, except the one still being onboarded. */
const seeded = seedTenants.filter((t) => t.status !== 'provisioning').map((t) => programFor(t));

export const seedCategories: ExpenseCategory[] = seeded.flatMap((p) => p.categories);
export const seedPolicyRules: PolicyRule[] = seeded.flatMap((p) => p.rules);
