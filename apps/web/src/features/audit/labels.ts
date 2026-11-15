import type { AdminRole } from 'contracts';

/** Every audit action the system emits, with a human label. */
export const ACTION_LABELS: Record<string, string> = {
  'tenant.created': 'Tenant created',
  'tenant.activated': 'Tenant activated',
  'tenant.suspended': 'Tenant suspended',
  'tenant.reactivated': 'Tenant reactivated',
  'tenant.deprovisioned': 'Tenant deprovisioned',
  'program.template_applied': 'Template applied',
  'category.created': 'Category created',
  'category.updated': 'Category updated',
  'policy.updated': 'Policy updated',
  'employees.imported': 'Employees imported',
};

export const ENTITY_LABELS: Record<string, string> = {
  tenant: 'Tenant',
  program: 'Program',
  category: 'Category',
  policy: 'Policy grid',
  employee: 'Employees',
};

export const ROLE_OF_ACTOR: Record<AdminRole, string> = {
  support_operator: 'Support Operator',
  program_admin: 'Program Admin',
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
export const entityLabel = (entity: string) => ENTITY_LABELS[entity] ?? entity;
