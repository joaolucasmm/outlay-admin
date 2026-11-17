import { programFromTemplate } from '@outlay/domain';
import type { ExpenseCategory, PolicyRule } from 'contracts';
import { seedTenants } from './seed';

/**
 * Every seed tenant gets the standard template, except the one still being onboarded. The
 * template lives in packages/domain (fixtures/category-template.json), shared with Java.
 */
const seeded = seedTenants
  .filter((t) => t.status !== 'provisioning')
  .map((t) => programFromTemplate(t));

export const seedCategories: ExpenseCategory[] = seeded.flatMap((p) => p.categories);
export const seedPolicyRules: PolicyRule[] = seeded.flatMap((p) => p.rules);
