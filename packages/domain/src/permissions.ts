import type { AdminRole } from 'contracts';

export type Permission =
  'tenants:list' | 'tenants:create' | 'tenants:transition' | 'tenant:configure' | 'audit:read';

const GRANTS: Record<AdminRole, readonly Permission[]> = {
  support_operator: ['tenants:list', 'tenants:create', 'tenants:transition', 'audit:read'],
  program_admin: ['tenant:configure', 'audit:read'],
};

/** Single permission table, shared by the UI guards and the mock backend. */
export const can = (role: AdminRole, permission: Permission): boolean =>
  GRANTS[role].includes(permission);
