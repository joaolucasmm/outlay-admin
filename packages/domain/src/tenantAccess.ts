import type { AdminRole, Tenant } from 'contracts';
import { err, ok, type Result } from './result';

/** A tenant that is not active is read-only for program configuration. */
export const canEditProgram = (tenant: Pick<Tenant, 'status'>): boolean =>
  tenant.status === 'active';

/** Onboarding (seeding the program, importing employees) only happens while provisioning. */
export const canOnboard = (tenant: Pick<Tenant, 'status'>): boolean =>
  tenant.status === 'provisioning';

export type ProgramWriteDenial = 'forbidden' | 'tenant_not_active';

/**
 * Who may change a tenant's program, and when:
 * - a Program Admin, while their tenant is active;
 * - the Support Operator, only while onboarding it (provisioning).
 * Scope (a Program Admin's own tenant) is checked by the caller.
 */
export function programWriteAccess(
  role: AdminRole,
  tenant: Pick<Tenant, 'status'>,
): Result<true, ProgramWriteDenial> {
  if (role === 'support_operator') return canOnboard(tenant) ? ok(true) : err('forbidden');
  return canEditProgram(tenant) ? ok(true) : err('tenant_not_active');
}
