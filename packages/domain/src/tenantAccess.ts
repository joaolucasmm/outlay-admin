import type { Tenant } from 'contracts';

/** A tenant that is not active is read-only for program configuration. */
export const canEditProgram = (tenant: Pick<Tenant, 'status'>): boolean =>
  tenant.status === 'active';
